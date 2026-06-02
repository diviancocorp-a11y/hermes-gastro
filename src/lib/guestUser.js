// src/lib/guestUser.js
// Identidad "guest" del catálogo público.
//
// Modelo: cualquier persona que completa un pedido queda identificada por
// (nombre + teléfono + email opcional). Se guarda en localStorage para que
// pueda ver su ranking en visitas futuras SIN necesidad de loguearse.
//
// El login formal (magic link) sólo se requiere para acceder a datos
// personales sensibles (historial detallado, direcciones, etc).
//
// Uso:
//   - submitOrder() exitoso → setGuestUser({ name, phone, email })
//   - TopCustomersCard → useGuestUser() para identidad de fallback
//   - Checkout form → prefill con getGuestUser() (futuro)

import { useState, useEffect } from "react";

const STORAGE_KEY = "hermes_guest_v1";
const STORAGE_EVENT = "hermes-guest-updated";

export function getGuestUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      id: parsed.id || null,
      name: parsed.name || "",
      phone: parsed.phone || "",
      email: parsed.email || "",
      updatedAt: parsed.updatedAt || 0,
    };
  } catch {
    return null;
  }
}

export function setGuestUser({ id, name, phone, email } = {}) {
  // Sólo persistimos si hay al menos un identificador (phone o email)
  const hasIdentity = !!(phone || email);
  if (!hasIdentity) return null;
  try {
    const data = {
      id: id || null,
      name: name || "",
      phone: phone || "",
      email: (email || "").toLowerCase().trim(),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Notificar a hooks en la misma pestaña (storage event no dispara en la pestaña que escribe)
    try { window.dispatchEvent(new Event(STORAGE_EVENT)); } catch { /* SSR safe */ }
    return data;
  } catch {
    return null;
  }
}

export function clearGuestUser() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    try { window.dispatchEvent(new Event(STORAGE_EVENT)); } catch { /* SSR safe */ }
  } catch { /* ignore */ }
}

/**
 * Hook reactivo. Devuelve guest identity o null. Se actualiza cuando otra
 * parte del código llama setGuestUser() (tanto en esta pestaña como en otras).
 */
export function useGuestUser() {
  const [guest, setGuest] = useState(getGuestUser);

  useEffect(() => {
    const handler = () => setGuest(getGuestUser());
    window.addEventListener("storage", handler);
    window.addEventListener(STORAGE_EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(STORAGE_EVENT, handler);
    };
  }, []);

  return guest;
}
