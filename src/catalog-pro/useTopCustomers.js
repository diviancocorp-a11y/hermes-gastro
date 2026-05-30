// src/catalog-pro/useTopCustomers.js
// Hooks para el ranking semanal del catálogo.
//
// useWeeklyTop()    → top 5 público (sin auth requerido)
// useMyRanking()    → posición personal del user logueado (null si no logueado)
//
// Los 2 hooks tienen cache simple en memoria (5 min) para evitar pegarle al
// SQL en cada navegación. El catálogo abre/cierra pantallas seguido y no
// necesitamos data 100% live.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { captureException } from "../lib/observability.js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let _topCache = { data: null, fetchedAt: 0 };
let _myCache = { key: "", data: null, fetchedAt: 0 };

export function useWeeklyTop() {
  const [top, setTop] = useState(_topCache.data);
  const [loading, setLoading] = useState(!_topCache.data);

  useEffect(() => {
    const fresh = Date.now() - _topCache.fetchedAt < CACHE_TTL_MS;
    if (_topCache.data && fresh) {
      setTop(_topCache.data);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_weekly_top");
      if (cancelled) return;
      if (error) {
        captureException(error, { tags: { source: "useWeeklyTop" } });
        setTop([]);
      } else {
        _topCache = { data: data || [], fetchedAt: Date.now() };
        setTop(data || []);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { top: top || [], loading };
}

export function useMyRanking({ email, phone } = {}) {
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email && !phone) {
      setRanking(null);
      return;
    }
    const key = `${(email || "").toLowerCase()}|${phone || ""}`;
    const fresh = Date.now() - _myCache.fetchedAt < CACHE_TTL_MS;
    if (_myCache.key === key && fresh) {
      setRanking(_myCache.data);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_my_ranking", {
        my_email: email || null,
        my_phone: phone || null,
      });
      if (cancelled) return;
      if (error) {
        captureException(error, { tags: { source: "useMyRanking" } });
        setRanking(null);
      } else {
        // RPC devuelve array (puede estar vacío si el user no tiene pedidos esta semana)
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        _myCache = { key, data: row, fetchedAt: Date.now() };
        setRanking(row);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [email, phone]);

  return { ranking, loading };
}
