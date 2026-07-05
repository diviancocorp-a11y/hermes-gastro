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
  combo_items:         [['comboItems'], queryKeys.recipes.all],
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
 * causes the server to reject the connection. We wait until supabase-js
 * reports a session, then subscribe. We also call realtime.setAuth() with
 * the user's access_token on every auth change, so RLS policies that depend
 * on auth.uid() / auth.role() evaluate correctly in the Realtime context.
 *
 * Without setAuth(): the WS uses the anon key, RLS policies like
 * `auth.uid() IS NOT NULL` fail, and INSERT events for anonymous orders
 * (user_id=NULL) never reach the admin.
 */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      setAuthReady(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Re-autenticar Realtime en CADA cambio de auth (login, token refresh, signout)
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      setAuthReady(!!session);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authReady) return; // do NOT open WS without a session

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
