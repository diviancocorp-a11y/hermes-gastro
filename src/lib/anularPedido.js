// src/lib/anularPedido.js
//
// Reglas puras de "Anular pedido" (migracion 0149). Sin React ni red, para
// probarlas sin montar nada.

/** Roles que pueden anular un pedido completado (los mismos que valida la RPC). */
export const ROLES_ANULAR_PEDIDO = ['owner', 'manager'];

export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 300;

export function puedeAnularPedido(roles = []) {
  return (roles || []).some((r) => ROLES_ANULAR_PEDIDO.includes(r));
}

/** El motivo ya limpio, o null si no alcanza (la RPC pide 3 a 300 caracteres). */
export function motivoValido(texto) {
  const limpio = String(texto ?? '').trim();
  return limpio.length >= MOTIVO_MIN && limpio.length <= MOTIVO_MAX ? limpio : null;
}
