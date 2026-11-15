// Opciones por producto y sugerencias al pedir: logica PURA de submit-order.
//
// Sin imports de Deno ni de Supabase a proposito: la prueba la corre vitest
// (src/test/opcionesPedido.test.js) y el front tiene un espejo para mostrar el
// precio en vivo (src/lib/opcionesPedido.js) que un test compara contra esto.
// El front nunca decide el precio: el servidor lo recalcula desde la base.

export type Choice = { id: string; label: string; price?: number; max_qty?: number };
export type Group = {
  id: string; name: string; type: "single" | "multiple";
  required?: boolean; min?: number; max?: number; choices: Choice[];
};
export type Eleccion = { groupId: string; choiceId: string; qty?: number };

export type ResultadoOpciones =
  | { ok: true; extras: number; elegidas: { group: string; choice: string; label: string; qty: number; price: number }[] }
  | { ok: false; error: string };

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Valida lo que eligio el cliente contra los grupos del producto (los de la base). */
export function resolverOpciones(groups: unknown, seleccion: unknown): ResultadoOpciones {
  const grupos: Group[] = Array.isArray(groups) ? groups as Group[] : [];
  const elecciones: Eleccion[] = Array.isArray(seleccion) ? seleccion as Eleccion[] : [];
  if (elecciones.length > 60) return { ok: false, error: "Demasiadas opciones elegidas" };
  if (!grupos.length && elecciones.length) return { ok: false, error: "Este producto no tiene opciones" };

  const vistas = new Set<string>();
  const porGrupo: Record<string, number> = {};
  const elegidas: { group: string; choice: string; label: string; qty: number; price: number }[] = [];
  let extras = 0;

  for (const e of elecciones) {
    const grupo = grupos.find((g) => g.id === e?.groupId);
    if (!grupo) return { ok: false, error: "Opcion invalida" };
    const choice = grupo.choices.find((c) => c.id === e?.choiceId);
    if (!choice) return { ok: false, error: `Opcion invalida en "${grupo.name}"` };
    const clave = `${grupo.id}:${choice.id}`;
    if (vistas.has(clave)) return { ok: false, error: `Opcion repetida en "${grupo.name}"` };
    vistas.add(clave);

    const tope = grupo.type === "single" ? 1 : (choice.max_qty ?? 99);
    const qty = Math.round(Number(e.qty ?? 1));
    if (!Number.isFinite(qty) || qty < 1 || qty > tope) {
      return { ok: false, error: `Cantidad invalida en "${grupo.name}"` };
    }
    porGrupo[grupo.id] = (porGrupo[grupo.id] || 0) + 1;
    const price = Math.max(0, Number(choice.price) || 0);
    extras += price * qty;
    elegidas.push({ group: grupo.id, choice: choice.id, label: choice.label, qty, price });
  }

  for (const g of grupos) {
    const n = g.choices.length;
    const min = g.min ?? (g.required ? 1 : 0);
    const max = g.max ?? (g.type === "single" ? 1 : n);
    const cuantas = porGrupo[g.id] || 0;
    if (cuantas < min) return { ok: false, error: `Elegi al menos ${min} en "${g.name}"` };
    if (cuantas > max) return { ok: false, error: `Elegi como maximo ${max} en "${g.name}"` };
  }

  // Orden estable: el de los grupos del producto, no el del cliente.
  elegidas.sort((a, b) =>
    grupos.findIndex((g) => g.id === a.group) - grupos.findIndex((g) => g.id === b.group)
  );
  return { ok: true, extras: redondear(extras), elegidas };
}

/** Nota limpia: una sola linea, sin espacios de mas, tope 140. */
export function limpiarNota(nota: unknown): string {
  return String(nota ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
}

/**
 * Texto de order_items.note para la comandera de 58 mm (32 columnas, una linea
 * que la termica corta sola): opciones primero, nota del cliente despues.
 *   "Alitas, Papas x2 | Nota: sin cebolla"
 * Sin nombre del grupo: ocuparia el ancho que no hay. Vacio => null.
 */
export function textoParaCocina(
  elegidas: { label: string; qty: number }[],
  nota: unknown,
): string | null {
  const opciones = elegidas.map((e) => (e.qty > 1 ? `${e.label} x${e.qty}` : e.label)).join(", ");
  const limpia = limpiarNota(nota);
  const partes = [opciones, limpia ? `Nota: ${limpia}` : ""].filter(Boolean);
  return partes.length ? partes.join(" | ") : null;
}

// ── Sugerencias ───────────────────────────────────────────────────────

export type Regla = {
  id: string; when_categories: string[]; add_product_id: string;
  special_price: number | null; max_per_item: number;
  days: number[]; start_time: string | null; end_time: string | null;
  start_date: string | null; end_date: string | null; active: boolean;
};
export type Ahora = { dow: number; hm: string; fecha: string };

/** Dia (0=domingo), HH:MM y fecha YYYY-MM-DD en la zona del local. */
export function ahoraEnZona(timezone: string | null | undefined, fecha = new Date()): Ahora {
  let tz = timezone || "America/Argentina/Buenos_Aires";
  let partes: Record<string, string> = {};
  const armar = (zona: string) => {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: zona, hour12: false, weekday: "short", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    return Object.fromEntries(f.formatToParts(fecha).map((p) => [p.type, p.value]));
  };
  try { partes = armar(tz); } catch { tz = "America/Argentina/Buenos_Aires"; partes = armar(tz); }
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hh = partes.hour === "24" ? "00" : partes.hour;
  return {
    dow: Math.max(0, dias.indexOf(partes.weekday)),
    hm: `${hh}:${partes.minute}`,
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
  };
}

/** La regla vale ahora: activa, dentro de fechas, dias y horas (con cruce de medianoche). */
export function reglaVigente(r: Regla, ahora: Ahora): boolean {
  if (!r || r.active === false) return false;
  if (r.start_date && ahora.fecha < r.start_date) return false;
  if (r.end_date && ahora.fecha > r.end_date) return false;
  if (Array.isArray(r.days) && r.days.length && !r.days.includes(ahora.dow)) return false;
  const ini = r.start_time?.slice(0, 5);
  const fin = r.end_time?.slice(0, 5);
  if (ini && fin) {
    const dentro = ini <= fin ? ahora.hm >= ini && ahora.hm <= fin : ahora.hm >= ini || ahora.hm <= fin;
    if (!dentro) return false;
  }
  return true;
}

export type LineaSug = { productId: string; categoria: string | null; qty: number; suggestionId?: string | null };

/**
 * Devuelve, por linea, la regla que SI aplica (o null). Una linea con
 * suggestionId invalida no se rechaza: se cobra normal y queda como aviso.
 * Tope: unidades elegibles (lineas sin sugerencia de las categorias de la
 * regla) x max_per_item, repartido en el orden del pedido.
 */
export function aplicarSugerencias(
  lineas: LineaSug[],
  reglas: Regla[],
  ahora: Ahora,
): { regla: Regla | null; aviso: string | null }[] {
  const presupuesto: Record<string, number> = {};
  for (const r of reglas) {
    const elegibles = lineas.reduce(
      (s, l) => s + (!l.suggestionId && l.categoria && r.when_categories.includes(l.categoria) &&
          l.productId !== r.add_product_id ? l.qty : 0),
      0,
    );
    presupuesto[r.id] = elegibles * Math.max(1, r.max_per_item || 1);
  }
  return lineas.map((l) => {
    if (!l.suggestionId) return { regla: null, aviso: null };
    const r = reglas.find((x) => x.id === l.suggestionId);
    if (!r) return { regla: null, aviso: "suggestion_invalid" };
    if (!reglaVigente(r, ahora)) return { regla: null, aviso: "suggestion_expired" };
    if (r.add_product_id !== l.productId) return { regla: null, aviso: "suggestion_invalid" };
    if (presupuesto[r.id] < l.qty) return { regla: null, aviso: "suggestion_limit" };
    presupuesto[r.id] -= l.qty;
    return { regla: r, aviso: null };
  });
}
