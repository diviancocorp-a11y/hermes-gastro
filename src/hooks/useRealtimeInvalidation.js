// src/hooks/useRealtimeInvalidation.js
// Subscribes to Supabase Realtime and invalidates the corresponding
// React Query cache entries so data stays fresh without polling.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryClient';

/**
 * Table → query key mapping for cache invalidation.
 * When a row changes in a table, we invalidate all related queries.
 */
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
 * Call once inside the authenticated admin layout.
 */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
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

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
