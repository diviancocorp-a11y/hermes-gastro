// Reglas puras de la reserva online. Sin red ni Deno: se prueban desde vitest
// (src/test/reservaOnline.test.js) y las usa index.ts.
//
// Todo lo que decide dinero, horario o profesional se calcula ACA, del lado del
// servidor, con lo que dice la base. El navegador solo propone: nunca manda el
// monto de la sena ni el tiempo de traslado.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_DIAS_CONSULTA = 14;

export const esUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v.trim());

/** Solo digitos; entre 8 y 15 (largo de un numero con codigo de pais). */
export function limpiarTelefono(v: unknown): string | null {
  const n = String(v ?? "").replace(/\D/g, "");
  return n.length >= 8 && n.length <= 15 ? n : null;
}

export function limpiarEmail(v: unknown): string | null {
  const e = String(v ?? "").trim().toLowerCase();
  if (!e) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200 ? e : null;
}

/** 'YYYY-MM-DD' real (no 2026-02-31). */
export function diaValido(v: unknown): v is string {
  if (typeof v !== "string" || !DIA.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

export function rangoDeConsulta(desde: unknown, hasta: unknown): { desde: string; hasta: string } | { error: string } {
  if (!diaValido(desde) || !diaValido(hasta)) return { error: "Fechas invalidas" };
  const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000;
  if (dias < 0) return { error: "El rango esta al reves" };
  if (dias > MAX_DIAS_CONSULTA) return { error: `Pedi hasta ${MAX_DIAS_CONSULTA} dias por vez` };
  return { desde, hasta };
}

export type Modalidad = "local" | "home";

export interface PedidoDeReserva {
  tenant_slug: string;
  service_id: string;
  staff_id: string | null;
  starts_at: string; // ISO normalizado a UTC
  location_kind: Modalidad;
  zone_id: string | null;
  address: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  client_request_id: string | null;
}

/** Valida el body de `create`. Devuelve el pedido limpio o el motivo. */
export function validarPedido(b: Record<string, unknown>): { ok: true; pedido: PedidoDeReserva } | { ok: false; error: string } {
  const slug = String(b.tenant_slug ?? "").trim().toLowerCase();
  if (!slug) return { ok: false, error: "Falta el negocio" };
  if (!esUuid(b.service_id)) return { ok: false, error: "Elegi un servicio" };

  const staff = b.staff_id == null || b.staff_id === "" || b.staff_id === "any" ? null : b.staff_id;
  if (staff !== null && !esUuid(staff)) return { ok: false, error: "Profesional invalida" };

  const t = Date.parse(String(b.starts_at ?? ""));
  if (!Number.isFinite(t)) return { ok: false, error: "Elegi un horario" };

  const modalidad: Modalidad = b.location_kind === "home" ? "home" : "local";
  const zona = b.zone_id == null || b.zone_id === "" ? null : b.zone_id;
  if (zona !== null && !esUuid(zona)) return { ok: false, error: "Zona invalida" };
  const direccion = String(b.address ?? "").trim().slice(0, 300) || null;
  if (modalidad === "home" && !direccion) return { ok: false, error: "Falta la direccion" };

  const nombre = String(b.customer_name ?? "").trim().slice(0, 120);
  if (!nombre) return { ok: false, error: "Falta el nombre" };
  const tel = limpiarTelefono(b.customer_phone);
  if (!tel) return { ok: false, error: "El telefono no parece valido" };
  const rawEmail = String(b.customer_email ?? "").trim();
  const email = limpiarEmail(rawEmail);
  if (rawEmail && !email) return { ok: false, error: "El correo no parece valido" };

  const rawKey = String(b.client_request_id ?? "").trim();
  return {
    ok: true,
    pedido: {
      tenant_slug: slug,
      service_id: String(b.service_id).trim().toLowerCase(),
      staff_id: staff ? String(staff).toLowerCase() : null,
      starts_at: new Date(t).toISOString(),
      location_kind: modalidad,
      zone_id: modalidad === "home" ? (zona ? String(zona).toLowerCase() : null) : null,
      address: modalidad === "home" ? direccion : null,
      customer_name: nombre,
      customer_phone: tel,
      customer_email: email,
      notes: String(b.notes ?? "").trim().slice(0, 500) || null,
      client_request_id: esUuid(rawKey) ? rawKey.toLowerCase() : null,
    },
  };
}

export interface ReglasDeSena {
  deposit_mode: string | null;
  deposit_value: number | string | null;
}

/**
 * Cuanto se pide de sena. El precio sale de la base. Nunca mas que el servicio
 * (una sena mayor al precio no tiene sentido) y siempre entero en pesos.
 */
export function montoDeSena(reglas: ReglasDeSena | null | undefined, precio: number): number {
  if (!reglas || !reglas.deposit_mode || reglas.deposit_mode === "none") return 0;
  const valor = Number(reglas.deposit_value);
  const p = Number(precio);
  if (!Number.isFinite(valor) || valor <= 0 || !Number.isFinite(p) || p <= 0) return 0;
  const bruto = reglas.deposit_mode === "percent" ? (p * valor) / 100 : valor;
  return Math.min(Math.round(bruto), Math.round(p));
}

export interface HuecoLibre { staff_id: string; starts_at: string; ends_at: string }

/**
 * De los huecos que calculo la base, el que corresponde al horario pedido.
 * Compara instantes (no strings: la base devuelve +00:00 y el navegador 'Z').
 * Con profesional pedida, tiene que ser ELLA; sin pedir, la que menos turnos
 * tiene ese dia para repartir la carga (empata por orden estable de id).
 */
export function elegirHueco(
  huecos: HuecoLibre[],
  startsAtISO: string,
  staffPedida: string | null,
  cargaPorStaff: Record<string, number> = {},
): HuecoLibre | null {
  const t = Date.parse(startsAtISO);
  const posibles = huecos.filter(h => Date.parse(h.starts_at) === t
    && (staffPedida === null || h.staff_id === staffPedida));
  if (!posibles.length) return null;
  return [...posibles].sort((a, b) =>
    (cargaPorStaff[a.staff_id] ?? 0) - (cargaPorStaff[b.staff_id] ?? 0)
    || a.staff_id.localeCompare(b.staff_id))[0];
}

/**
 * Si la clienta todavia puede cancelar sola. Pasado el plazo tiene que hablar
 * con el negocio (la sena es del negocio).
 */
export function puedeCancelarSola(startsAtISO: string, ahoraMs: number, ventanaHoras: number): boolean {
  const t = Date.parse(startsAtISO);
  if (!Number.isFinite(t)) return false;
  return t - ahoraMs >= Math.max(0, Number(ventanaHoras) || 0) * 3600000;
}

/** Minutos que se retiene el hueco esperando la sena, con un piso razonable. */
export function vencimientoDeRetencion(ahoraMs: number, minutos: number): string {
  const m = Math.max(5, Math.min(120, Math.round(Number(minutos) || 30)));
  return new Date(ahoraMs + m * 60000).toISOString();
}

/** external_reference de MercadoPago para una sena: no se confunde con un pedido. */
export const REF_SENA = "turno:";
export const refDeSena = (appointmentId: string) => `${REF_SENA}${appointmentId}`;
export function turnoDeRef(ref: unknown): string | null {
  const s = String(ref ?? "");
  if (!s.startsWith(REF_SENA)) return null;
  const id = s.slice(REF_SENA.length);
  return esUuid(id) ? id.toLowerCase() : null;
}
