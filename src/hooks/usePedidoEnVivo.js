// src/hooks/usePedidoEnVivo.js
// El pedido del comprador, actualizado solo mientras todavia puede cambiar.
//
// Es polling y no Realtime a proposito: Realtime aplica la RLS de `orders`, y
// el comprador sin sesion no puede leer su pedido, asi que el canal nunca le
// entregaba un cambio (la pantalla decia "en tiempo real" y no se movia).
//
// Deja de preguntar cuando el pedido llega a un estado final, y no pregunta
// con la pestania oculta: al volver a ella trae el estado enseguida.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrderTracker, ESTADOS_FINALES } from '../services/orderTracker';

export const CADA_MS = 15000;

/**
 * @returns {{ pedido, cargando, noEncontrado, fallo, cambio }}
 *   cambio: se incrementa cada vez que el estado cambia despues de la primera
 *           carga (para un feedback visual).
 */
export default function usePedidoEnVivo(orderId, { cadaMs = CADA_MS } = {}) {
  const [estado, setEstado] = useState({
    pedido: null, cargando: !!orderId, noEncontrado: false, fallo: false, cambio: 0,
  });
  const ultimoStatus = useRef(null);

  const traer = useCallback(async () => {
    const { pedido, fallo } = await fetchOrderTracker(orderId);
    setEstado((prev) => {
      // Un fallo de red no borra lo que ya se estaba mostrando.
      if (fallo) return { ...prev, cargando: false, fallo: true };
      const cambio = pedido && ultimoStatus.current && pedido.status !== ultimoStatus.current
        ? prev.cambio + 1
        : prev.cambio;
      ultimoStatus.current = pedido?.status ?? null;
      return { pedido, cargando: false, noEncontrado: !pedido, fallo: false, cambio };
    });
    return pedido;
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return undefined;
    let vivo = true;
    let terminado = false;
    let timer = null;

    const oculta = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const programar = () => { timer = setTimeout(ciclo, cadaMs); };
    async function ciclo() {
      if (!vivo || terminado) return;
      if (oculta()) { programar(); return; }
      const pedido = await traer();
      if (!vivo) return;
      if (pedido && ESTADOS_FINALES.includes(pedido.status)) { terminado = true; return; }
      programar();
    }
    const alVolver = () => {
      if (oculta() || !vivo || terminado) return;
      clearTimeout(timer);
      ciclo();
    };

    ciclo();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [orderId, cadaMs, traer]);

  return estado;
}
