// src/catalog-pro/regretOrder.js
// Boton de arrepentimiento: el cliente puede cancelar su pedido durante los
// primeros 60 segundos (el server lo valida igual: status=new + <60s).
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { removeActiveOrder } from "../lib/activeOrders";

export const REGRET_WINDOW_MS = 60 * 1000;

/** Cancela el pedido (server-side valida ventana y estado). true = cancelado */
export async function cancelOwnOrder(orderId) {
  // Via principal: edge function cancel-order — cancela con autoria 'customer'
  // y AVISA AL ADMIN por push (caso Ornela 5/jul: cancelacion silenciosa).
  try {
    const { data, error } = await supabase.functions.invoke("cancel-order", { body: { order_id: orderId } });
    if (!error && data?.ok === true) { removeActiveOrder(orderId); return true; }
    if (!error && data?.ok === false) return false; // ventana cerrada: el RPC diria lo mismo
  } catch { /* function caida o chunk desfasado: probamos el RPC */ }
  // Fallback (compat): mismo efecto server-side, sin push al admin.
  try {
    const { data, error } = await supabase.rpc("cancel_own_order", { p_order_id: orderId });
    if (error) return false;
    if (data === true) removeActiveOrder(orderId);
    return data === true;
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
