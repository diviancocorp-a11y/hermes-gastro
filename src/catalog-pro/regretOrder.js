// src/catalog-pro/regretOrder.js
// Boton de arrepentimiento: el cliente puede cancelar su pedido durante los
// primeros 60 segundos. El server lo valida igual (cancel_own_order, 0082):
// pedido de este negocio, status 'new' y menos de 60s.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { resolveTenantSlug } from "../lib/activeTenant";
import { removeActiveOrder } from "../lib/activeOrders";

export const REGRET_WINDOW_MS = 60 * 1000;

/**
 * Cancela el pedido. true = cancelado.
 * Va por la edge function cancel-order del edificio, que ademas le AVISA AL
 * LOCAL por push (caso Ornela 5/jul: una cancelacion silenciosa es un pedido
 * que se prepara igual). false si ya no se puede o si no se pudo preguntar.
 */
export async function cancelOwnOrder(orderId) {
  try {
    const slug = await resolveTenantSlug();
    if (!slug || !orderId) return false;
    const { data, error } = await supabase.functions.invoke("cancel-order", {
      body: { tenant_slug: slug, order_id: orderId },
    });
    if (error || data?.ok !== true) return false;
    removeActiveOrder(orderId);
    return true;
  } catch { return false; }
}

/**
 * Segundos restantes de la ventana de arrepentimiento (tick por segundo).
 * createdAt: ISO string o ms. 0 = ventana cerrada.
 */
export function useRegretCountdown(createdAt) {
  const calc = () => {
    if (!createdAt) return 0;
    const t = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
    return Math.max(0, Math.ceil((t + REGRET_WINDOW_MS - Date.now()) / 1000));
  };
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const id = setInterval(() => {
      setLeft((prev) => {
        const next = calc();
        if (next <= 0) clearInterval(id);
        return next !== prev ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAt]);
  return left;
}
