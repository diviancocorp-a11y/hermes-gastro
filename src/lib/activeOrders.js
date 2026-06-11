// src/lib/activeOrders.js
// Pedidos activos del dispositivo (puede haber VARIOS al mismo tiempo).
// El catalogo muestra una card de seguimiento por cada uno; cuando un pedido
// se completa o cancela, su card lo saca de la lista.
// Compat: migra el viejo cp_last_order (single) al array.

const KEY = "cp_active_orders";

export function getActiveOrders() {
  try {
    let arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(arr)) arr = [];
    const legacy = localStorage.getItem("cp_last_order");
    if (legacy && !arr.includes(legacy)) arr.push(legacy);
    return arr.slice(-5); // techo sano: 5 pedidos simultaneos
  } catch { return []; }
}

export function addActiveOrder(id) {
  if (!id) return;
  try {
    const arr = getActiveOrders().filter(x => x !== id);
    arr.push(id);
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-5)));
    localStorage.setItem("cp_last_order", id); // compat con lectores viejos
  } catch { /* empty */ }
}

export function removeActiveOrder(id) {
  try {
    const arr = getActiveOrders().filter(x => x !== id);
    localStorage.setItem(KEY, JSON.stringify(arr));
    if (localStorage.getItem("cp_last_order") === id) localStorage.removeItem("cp_last_order");
  } catch { /* empty */ }
}
