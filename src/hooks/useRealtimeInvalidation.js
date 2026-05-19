// src/hooks/useRealtimeInvalidation.js
// Subscribes to Supabase Realtime and invalidates the corresponding
// React Query cache entries so data stays fresh without polling.
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryClient';

const TABLE_KEYS = {
  orders:              [queryKeys.orders.all, queryKeys.dashboard.stats],
  order_items:         [queryKeys.orders.all],
  recipes:             [queryKeys.recipes.all, ['catalog']],
  ingredients:         [queryKeys.ingredients.all],
  recipe_ingredients:  [['recipeIngredients'], queryKeys.recipes.all],
  sales:               [queryKeys.sales.all, queryKeys.dashboard.stats],
  expenses:            [queryKeys.expenses.all, queryKeys.dashboard.stats],
  purchases:           [queryKeys.purchases.all],
  waste_log:           [queryKeys.ingredients.waste(null)],
  coupons:             [queryKeys.coupons.all],
  settings:            [queryKeys.settings.all, ['catalog']],
};

const TABLES = Object.keys(TABLE_KEYS);

/**
 * Subscribe to Supabase Realtime for all admin-relevant tables.
 *
 * Why the auth gate: opening the WebSocket before the session is hydrated
 * causes the server to reject the connection ("WebSocket is closed before
 * the connection is established"). We wait until supabase-js reports a
 * session, then subscribe. Also reconnects on auth state changes (signIn /
 * token refresh) so the channel always uses a fresh access token.
 */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);

  // Track auth readiness — gate the channel subscription on a valid session.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setAuthReady(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(!!session);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authReady) return; // do NOT open WS without a session

    // Single channel, single subscribe. The previous version retried on CLOSED
    // and called removeChannel inside the subscribe callback — that triggers
    // another CLOSED, which loops forever ("Maximum call stack size exceeded").
    // Keep it simple: if the WS drops, the 5s polling fallback takes over.
    // Supabase realtime auto-reconnects internally for transient drops.
    const channel = supabase.channel('cache-invalidation');

    TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          const keys = TABLE_KEYS[table] || [];
          keys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        },
      );
    });

    let logged = false;
    channel.subscribe((status, err) => {
      // Log only the first transition for each channel — no recursion possible.
      if (logged) return;
      if (status === 'SUBSCRIBED') {
        logged = true;
        console.info('[realtime] SUBSCRIBED');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        logged = true;
        console.warn('[realtime]', status, '— falling back to 5s polling', err || '');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authReady, queryClient]);
}
