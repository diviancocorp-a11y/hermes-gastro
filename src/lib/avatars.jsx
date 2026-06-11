// src/lib/avatars.jsx
// Avatares de clientes (ilustraciones que paso Ricky, recortadas de
// "Linea de 8 avatares" — son 10: 4 hombres, 5 mujeres y el capibara).
//
// Asignacion: deterministica por nombre (hash + heuristica de genero es-AR)
// — el cliente arranca con uno asignado y puede CAMBIARLO desde Mi Cuenta.
// La eleccion se guarda en customers.avatar_key (RPC set_customer_avatar)
// para que el ranking se la muestre a todos, y en localStorage para verla
// al instante en este dispositivo.
import m1 from "../assets/avatars/m1.png"; // lentes
import m2 from "../assets/avatars/m2.png"; // barba
import m3 from "../assets/avatars/m3.png"; // camiseta argentina
import m4 from "../assets/avatars/m4.png"; // gaucho
import f1 from "../assets/avatars/f1.png"; // rulos
import f2 from "../assets/avatars/f2.png"; // colorada
import f3 from "../assets/avatars/f3.png"; // colita + saco
import f4 from "../assets/avatars/f4.png"; // punk
import f5 from "../assets/avatars/f5.png"; // tocado de colores
import capi from "../assets/avatars/capi.png"; // capibara con mate

export const AVATARS = { m1, m2, m3, m4, f1, f2, f3, f4, f5, capi };
export const AVATAR_KEYS = Object.keys(AVATARS);

const MALE_KEYS = ["m1", "m2", "m3", "m4"];
const FEMALE_KEYS = ["f1", "f2", "f3", "f4", "f5"];

const LS_KEY = "cp_avatar_key";
export function getLocalAvatarKey() {
  try { const k = localStorage.getItem(LS_KEY); return AVATARS[k] ? k : null; } catch { return null; }
}
export function setLocalAvatarKey(key) {
  try { if (AVATARS[key]) localStorage.setItem(LS_KEY, key); } catch { /* empty */ }
}

// Hash simple y estable (mismo nombre → mismo numero)
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Heuristica es-AR: primer nombre terminado en 'a' → femenino.
const MALE_EXCEPTIONS = new Set(["joshua", "elia", "nicola", "luca", "matias", "tobias", "elias", "jeremias"]);
function isFemaleName(name) {
  const first = (name || "").trim().toLowerCase().split(/\s+/)[0].normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!first) return false;
  if (MALE_EXCEPTIONS.has(first)) return false;
  return first.endsWith("a") || first.endsWith("ia");
}

/** Clave de avatar deterministica por nombre. Sin nombre → capibara. */
export function avatarKeyFor(name) {
  const key = (name || "").trim().toLowerCase();
  if (!key || key === "cliente" || key === "sin nombre" || key === "venta manual") return "capi";
  const set = isFemaleName(key) ? FEMALE_KEYS : MALE_KEYS;
  return set[hashStr(key) % set.length];
}

/**
 * Burbuja de avatar.
 *   <Avatar name="Cami R." size={40} />            → deterministico
 *   <Avatar name="..." avatarKey="f4" size={40} /> → eleccion explicita
 */
export function Avatar({ name, avatarKey, size = 40, style }) {
  const key = avatarKey && AVATARS[avatarKey] ? avatarKey : avatarKeyFor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, overflow: "hidden",
      flexShrink: 0, background: "#fff", ...style,
    }}>
      <img src={AVATARS[key]} alt="" draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}
