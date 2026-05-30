import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../lib/queryClient";
import { getSession, logout } from "../services/auth";
import { captureException } from "../lib/observability.js";
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
    getSession()
      .then(s => { setSession(s); setChecking(false); })
      .catch(err => {
        // Si Supabase falla en boot, NO dejamos la app colgada en "checking".
        // Reportamos a Sentry y dejamos al user en la pantalla de login.
        captureException(err, { tags: { source: 'useAdminData.getSession' } });
        setSession(null);
        setChecking(false);
      });
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
      fetchOrderHistory()
        .then(result => setHistoryOrders(result.data || []))
        .catch(err => captureException(err, { tags: { source: 'useAdminData.fetchOrderHistory' } }));
    }).catch(err => captureException(err, { tags: { source: 'useAdminData.importOrders' } }));
  }, [session]);

  const loaded = enabled && rawRecs.length >= 0; // always true once first query settles

  // ─── Realtime → cache invalidation ────────────────────────────────
  useRealtimeInvalidation();

  // ─── New order alarm ──────────────────────────────────────────────
  // Anchored to "when the admin opened the page". Anything with
  // created_at > adminEntryTime that we haven't seen yet is genuinely new.
  // This is robust against page reloads, empty-then-populated cache, and
  // pre-existing active orders (which used to fire a false alarm).
  const [newAlertCount, setNewAlertCount] = useState(0);
  const alarmRef = useRef(null);
  const alarmTimer = useRef(null);
  const prevOrderIds = useRef(new Set());
  const adminEntryTime = useRef(Date.now());

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

  // Detect new orders from the query cache.
  // Triggers only for orders created AFTER the admin opened the page AND
  // that we haven't already counted. Resilient to:
  //   - empty initial cache → populated cache (no false alarm)
  //   - page reload with existing active orders (no false alarm)
  //   - 0 → 1 first real order (rings correctly)
  useEffect(() => {
    if (!session) return;
    const trulyNew = activeOrders.filter(o => {
      if (prevOrderIds.current.has(o.id)) return false;
      // Postgres timestamps can come as "2026-05-19 10:27:15+00" (with a
      // space instead of "T"), which `new Date()` parses as NaN on some
      // browsers. Normalize before parsing.
      const ts = o.created_at;
      if (!ts) return false;
      const normalized = typeof ts === 'string' && !ts.includes('T') ? ts.replace(' ', 'T') : ts;
      const createdAtMs = new Date(normalized).getTime();
      return !Number.isNaN(createdAtMs) && createdAtMs > adminEntryTime.current;
    });
    prevOrderIds.current = new Set(activeOrders.map(o => o.id));
    if (trulyNew.length === 0) return;

    setNewAlertCount(c => c + trulyNew.length);
    if (alarmRef.current) {
      if (alarmTimer.current) clearTimeout(alarmTimer.current);
      alarmRef.current.currentTime = 0;
      alarmRef.current.play().catch(() => {});
      alarmTimer.current = setTimeout(() => {
        if (alarmRef.current) { alarmRef.current.pause(); alarmRef.current.currentTime = 0; }
      }, 10000);
    }
  }, [activeOrders, session]);

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

  // Optimistic-friendly setter: applies the caller's update locally so the UI
  // reflects the change immediately (e.g. "Preparar" button moves the card to
  // the next column without waiting for refetch / realtime). Also invalidates
  // so the next refetch will reconcile against the server source of truth.
  // IMPORTANT: status values in DB are "new", "preparing", "active", "completed",
  // "cancelled" — see OrderStatus in src/lib/utils.jsx. Don't use the JS keys here.
  const ACTIVE_STATUSES = ['new', 'preparing', 'active'];
  const HISTORY_STATUSES = ['completed', 'cancelled'];
  const setOrders = useCallback((val) => {
    if (typeof val === 'function') {
      // Combine the current active + history view so the caller's `.map` sees
      // the full order set the same way useOrderWorkflow expects.
      const combined = [...(queryClient.getQueryData(queryKeys.orders.active()) || []), ...historyOrders];
      const next = val(combined);
      queryClient.setQueryData(queryKeys.orders.active(), next.filter(o => ACTIVE_STATUSES.includes(o.status)));
      setHistoryOrders(next.filter(o => HISTORY_STATUSES.includes(o.status)));
    } else if (Array.isArray(val)) {
      queryClient.setQueryData(queryKeys.orders.active(), val.filter(o => ACTIVE_STATUSES.includes(o.status)));
      setHistoryOrders(val.filter(o => HISTORY_STATUSES.includes(o.status)));
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  }, [queryClient, historyOrders]);

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
