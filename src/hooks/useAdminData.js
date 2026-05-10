import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../lib/queryClient";
import { getSession, logout } from "../services/auth";
import {
  useRecipes, useRecipeIngredients, useIngredients,
  useActiveOrders, useSales, useExpenses, useSettings, useWasteLog,
} from "./useQueryHooks";
import { useRealtimeInvalidation } from "./useRealtimeInvalidation";
import business from "@business";

const DEFAULT_SETTINGS = { ...business.defaultSettings };

/**
 * useAdminData — Now backed by TanStack Query for caching, deduplication,
 * and automatic refetching. The public API stays the same so components
 * don't need to change.
 */
export default function useAdminData() {
  const queryClient = useQueryClient();

  // ─── Session (auth is NOT cached via React Query — it's special) ──
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSession().then(s => { setSession(s); setChecking(false); });
  }, []);

  // ─── Queries (only fetch when authenticated) ──────────────────────
  const enabled = !!session;

  const { data: ings = [], refetch: refetchIngs } = useIngredients();
  const { data: rawRecs = [] } = useRecipes();
  const { data: rawRI = [] } = useRecipeIngredients();
  const { data: sales = [] } = useSales();
  const { data: exps = [] } = useExpenses();
  const { data: activeOrders = [] } = useActiveOrders();
  const { data: sett } = useSettings();
  const { data: waste = [] } = useWasteLog();

  // ─── Merge recipe ingredients into recipes (same shape as before) ──
  const recs = useMemo(() => {
    const riMap = {};
    rawRI.forEach(r => {
      if (!riMap[r.recipe_id]) riMap[r.recipe_id] = [];
      riMap[r.recipe_id].push({ ...r, quantity: r.qty || r.quantity || 0, qty: r.qty || r.quantity || 0 });
    });
    return rawRecs.map(r => ({ ...r, ingredients: riMap[r.id] || [] }));
  }, [rawRecs, rawRI]);

  // ─── Orders (active + history combined for backward compatibility) ─
  const [historyOrders, setHistoryOrders] = useState([]);
  const orders = useMemo(() => [...activeOrders, ...historyOrders], [activeOrders, historyOrders]);

  // Load history on first auth (one-time)
  useEffect(() => {
    if (!session) return;
    import('../services/orders').then(({ fetchOrderHistory }) => {
      fetchOrderHistory().then(result => setHistoryOrders(result.data || []));
    });
  }, [session]);

  const loaded = enabled && rawRecs.length >= 0; // always true once first query settles

  // ─── Realtime → cache invalidation ────────────────────────────────
  useRealtimeInvalidation();

  // ─── New order alarm ──────────────────────────────────────────────
  const [newAlertCount, setNewAlertCount] = useState(0);
  const alarmRef = useRef(null);
  const alarmTimer = useRef(null);
  const prevOrderIds = useRef(new Set());

  useEffect(() => {
    const audio = new Audio(business.branding.sound);
    audio.loop = true;
    alarmRef.current = audio;
    const unlock = () => {
      audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      audio.pause();
      if (alarmTimer.current) clearTimeout(alarmTimer.current);
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  // Detect new orders from the query cache
  useEffect(() => {
    if (!activeOrders.length) return;
    const currentIds = new Set(activeOrders.map(o => o.id));
    const newOnes = activeOrders.filter(o => !prevOrderIds.current.has(o.id));
    prevOrderIds.current = currentIds;

    if (newOnes.length > 0 && prevOrderIds.current.size > newOnes.length) {
      // There were previous orders, so these are genuinely new
      setNewAlertCount(c => c + newOnes.length);
      if (alarmRef.current) {
        if (alarmTimer.current) clearTimeout(alarmTimer.current);
        alarmRef.current.currentTime = 0;
        alarmRef.current.play().catch(() => {});
        alarmTimer.current = setTimeout(() => {
          if (alarmRef.current) { alarmRef.current.pause(); alarmRef.current.currentTime = 0; }
        }, 10000);
      }
    }
  }, [activeOrders]);

  const ackOrders = useCallback(() => {
    if (alarmRef.current) { alarmRef.current.pause(); alarmRef.current.currentTime = 0; }
    if (alarmTimer.current) { clearTimeout(alarmTimer.current); alarmTimer.current = null; }
    setNewAlertCount(0);
  }, []);

  // ─── Setters (for backward compat — mutate + invalidate) ──────────
  const setIngs = useCallback((val) => {
    queryClient.setQueryData(queryKeys.ingredients.all, typeof val === 'function' ? val : () => val);
  }, [queryClient]);

  const setRecs = useCallback((val) => {
    // This is a derived value; just invalidate the source queries
    queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
  }, [queryClient]);

  const setSales = useCallback((val) => {
    queryClient.setQueryData(queryKeys.sales.all, typeof val === 'function' ? val : () => val);
  }, [queryClient]);

  const setExps = useCallback((val) => {
    queryClient.setQueryData(queryKeys.expenses.all, typeof val === 'function' ? val : () => val);
  }, [queryClient]);

  const setOrders = useCallback((val) => {
    // Invalidate both active and history
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  }, [queryClient]);

  const setSett = useCallback((val) => {
    queryClient.setQueryData(queryKeys.settings.all, typeof val === 'function' ? val : () => val);
  }, [queryClient]);

  // ─── loadAll (now just invalidates everything) ────────────────────
  const loadAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const doLogout = useCallback(async () => { await logout(); setSession(null); queryClient.clear(); }, [queryClient]);
  const doLogin = useCallback(async () => { const s = await getSession(); setSession(s); }, []);

  return {
    session, checking, doLogin, doLogout,
    ings, setIngs, recs, setRecs, sales, setSales,
    exps, setExps, orders, setOrders, sett: sett || DEFAULT_SETTINGS, setSett,
    waste, loaded: !!session, loadAll,
    newAlertCount, ackOrders,
    DEFAULT_SETTINGS,
  };
}

export { DEFAULT_SETTINGS };
