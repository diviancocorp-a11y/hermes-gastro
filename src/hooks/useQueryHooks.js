// src/hooks/useQueryHooks.js
// TanStack Query wrappers for service functions.
// Each hook replaces a manual useState+useEffect pattern.
import { useQuery } from '@tanstack/react-query';
import { queryKeys, STALE_TIMES } from '../lib/queryClient';
import {
  fetchAllRecipes, fetchAllRecipeIngredients,
} from '../services/recipes';
import { fetchActiveOrders } from '../services/orders';
import { fetchIngredients, fetchWasteLog } from '../services/inventory';
import { fetchSales, fetchExpenses } from '../services/finance';
import { fetchSettings } from '../services/settings';

// ─── Admin queries ──────────────────────────────────────

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes.all,
    queryFn: fetchAllRecipes,
    staleTime: STALE_TIMES.products,
  });
}

export function useRecipeIngredients() {
  return useQuery({
    queryKey: ['recipeIngredients'],
    queryFn: fetchAllRecipeIngredients,
    staleTime: STALE_TIMES.products,
  });
}

export function useIngredients() {
  return useQuery({
    queryKey: queryKeys.ingredients.all,
    queryFn: fetchIngredients,
    staleTime: STALE_TIMES.ingredients,
  });
}

export function useActiveOrders() {
  return useQuery({
    queryKey: queryKeys.orders.active(),
    queryFn: fetchActiveOrders,
    staleTime: 0,            // always allow background refetch
    refetchInterval: 5_000,  // 5s fallback poll — guarantees UX works even if Realtime is down
    refetchOnWindowFocus: true,
  });
}

export function useSales() {
  return useQuery({
    queryKey: queryKeys.sales.all,
    queryFn: () => fetchSales(),
    staleTime: STALE_TIMES.finance,
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses.all,
    queryFn: () => fetchExpenses(),
    staleTime: STALE_TIMES.finance,
  });
}

export function useWasteLog() {
  return useQuery({
    queryKey: queryKeys.ingredients.waste(null),
    queryFn: () => fetchWasteLog(),
    staleTime: STALE_TIMES.finance,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: fetchSettings,
    staleTime: STALE_TIMES.settings,
  });
}
