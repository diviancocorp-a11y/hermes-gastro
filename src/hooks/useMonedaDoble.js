// src/hooks/useMonedaDoble.js
// { monedaPrincipal, monedaSecundaria, tasa, vencida, fecha, origen } del
// tenant del panel. Un tenant sin `secondary_currency` devuelve
// monedaSecundaria: null y no hace ninguna consulta: nadie renderiza nada extra.
//
// Se llama UNA vez en PlatformAdmin y el resultado baja por props.

import { useCallback, useEffect, useState } from 'react';
import { fetchTasaVigente } from '../services/platformTasas';
import { tasaVencida } from '../lib/moneda';

export default function useMonedaDoble(tenant) {
  const tenantId = tenant?.id || null;
  const monedaPrincipal = tenant?.currency || 'ARS';
  const monedaSecundaria = tenant?.secondary_currency || null;
  const zona = tenant?.timezone || 'America/Caracas';
  const [fila, setFila] = useState(null);
  const [cargando, setCargando] = useState(false);

  const recargar = useCallback(async () => {
    if (!tenantId || !monedaSecundaria) { setFila(null); return null; }
    setCargando(true);
    try {
      const v = await fetchTasaVigente(tenantId, monedaPrincipal, monedaSecundaria);
      setFila(v);
      return v;
    } catch {
      setFila(null);
      return null;
    } finally {
      setCargando(false);
    }
  }, [tenantId, monedaPrincipal, monedaSecundaria]);

  useEffect(() => { recargar(); }, [recargar]);

  if (!monedaSecundaria) {
    return { monedaPrincipal, monedaSecundaria: null, tasa: null, vencida: false, fecha: null, origen: null, zona, cargando: false, recargar };
  }
  const tasa = fila ? Number(fila.rate) : null;
  return {
    monedaPrincipal,
    monedaSecundaria,
    tasa,
    vencida: tasa == null ? true : tasaVencida(fila.effective_date, new Date(), zona),
    fecha: fila?.effective_date || null,
    origen: fila?.source || null,
    zona,
    cargando,
    recargar,
  };
}
