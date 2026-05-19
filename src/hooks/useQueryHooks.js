// src/hooks/useQueryHooks.js
// TanStack Query wrappers for service functions.
// Each hook replaces a manual useState+useEffect pattern.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, STALE_TIMES } from '../lib/queryClient';
import {
  fetchAllRecipes, fetchAllRecipeIngredients,
} from '../services/recipes';
import { fetchActiveOrders, fetchOrderHistory } from '../services/orders';
import { fetchIngredients, fetchWasteLog } from '../services/inventory';
import { fetchSales, fetchExpenses, fetchPurchases, fetchDashboardStats } from '../services/finance';
import { fetchCoupons } from '../services/coupons';
import { fetchSettings } from '../services/settings';
import { fetchCatalog } from '../services/catalog';

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

export function useOrderHistory(cursor) {
  return useQuery({
    queryKey: queryKeys.orders.history(cursor),
    queryFn: () => fetchOrderHistory({ before: cursor }),
    staleTime: STALE_TIMES.finance,
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

export function usePurchases() {
  return useQuery({
    queryKey: queryKeys.purchases.all,
    queryFn: () => fetchPurchases(),
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

export function useCoupons() {
  return useQuery({
    queryKey: queryKeys.coupons.all,
    queryFn: () => fetchCoupons(),
    staleTime: STALE_TIMES.coupons,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: fetchSettings,
    staleTime: STALE_TIMES.settings,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: fetchDashboardStats,
    staleTime: STALE_TIMES.orders,
  });
}

// ─── Catalog (public) ───────────────────────────────────

export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: STALE_TIMES.products,
  });
}
