// src/hooks/useTasaCatalogo.js
// Tasa vigente para el catalogo PUBLICO: RPC get_exchange_rate(slug), que no
// necesita sesion. (El del panel es useMonedaDoble y lee la tabla con RLS.)
//
// Un tenant sin moneda secundaria no hace ninguna consulta y devuelve
// `activa: false`: nadie renderiza nada extra.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { tasaVencida } from '../lib/moneda';

/** Normaliza lo que devuelve la RPC (o null). Puro. */
export function leerTasa(fila, secundaria, zona, ahora = new Date()) {
  const rate = Number(fila?.rate);
  if (!fila || !(rate > 0) || (secundaria && fila.quote_currency !== secundaria)) return null;
  return { rate, fecha: String(fila.effective_date || '').slice(0, 10), fuente: fila.source || null, vencida: tasaVencida(fila.effective_date, ahora, zona) };
}

export default function useTasaCatalogo({ slug, principal, secundaria, zona } = {}) {
  const activa = Boolean(slug && secundaria && secundaria !== principal);
  const [estado, setEstado] = useState({ tasa: null, cargando: activa, error: false });

  useEffect(() => {
    if (!activa) { setEstado({ tasa: null, cargando: false, error: false }); return undefined; }
    let vivo = true;
    setEstado(e => ({ ...e, cargando: true }));
    supabase.rpc('get_exchange_rate', { p_tenant_slug: slug }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setEstado({ tasa: null, cargando: false, error: true }); return; }
      setEstado({ tasa: leerTasa(data, secundaria, zona), cargando: false, error: false });
    });
    return () => { vivo = false; };
  }, [activa, slug, secundaria, zona]);

  return { activa, principal, secundaria, ...estado };
}
