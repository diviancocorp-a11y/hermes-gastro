// Logica pura de suscripcion-webhook: sin red ni base, para poder probarla con
// vitest (src/test/suscripcionMp.test.js).

export type Evento =
  | { tipo: "suscripcion"; id: string }
  | { tipo: "debito"; id: string };

/**
 * Que avisa MP. Los topics de suscripciones son `subscription_preapproval`
 * (la suscripcion cambio de estado) y `subscription_authorized_payment` (un
 * debito). El id viene en `data.id` (query o body) o, en el formato viejo, en
 * `id` + `topic`. Cualquier otro topic -> null (se responde 200 y se ignora).
 */
export function leerEvento(url: URL, body: Record<string, unknown> | null): Evento | null {
  const data = (body?.data ?? {}) as Record<string, unknown>;
  const tipo = String(body?.type ?? body?.topic ?? url.searchParams.get("type")
    ?? url.searchParams.get("topic") ?? "");
  const id = String(url.searchParams.get("data.id") ?? data.id ?? url.searchParams.get("id") ?? "");
  if (!/^[a-z0-9-]{1,64}$/i.test(id)) return null;
  if (tipo === "subscription_preapproval" || tipo === "preapproval") return { tipo: "suscripcion", id };
  if (tipo === "subscription_authorized_payment" || tipo === "authorized_payment") {
    return { tipo: "debito", id };
  }
  return null;
}

/**
 * Firma de MP: `x-signature: ts=<ts>,v1=<hmac>`, HMAC-SHA256 hex sobre
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con el secreto de la app.
 * Mismo esquema que valida mp-webhook. El id va en minusculas si es alfanumerico.
 */
export async function firmaValida(
  firma: string | null, requestId: string | null, dataId: string, secreto: string,
): Promise<boolean> {
  if (!firma || !secreto) return false;
  const partes = Object.fromEntries(
    firma.split(",").map((p) => p.split("=").map((x) => x.trim())),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId ?? ""};ts:${ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(manifest)));
  const esperado = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (esperado.length !== v1.length) return false;
  // Tiempo constante: con `===` se podria adivinar la firma de a un caracter.
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

/** Suma meses sin desbordar: 31/ene + 1 mes = 28 o 29/feb, no 3/mar. */
export function sumarMeses(desde: Date, meses: number): Date {
  const d = new Date(desde.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

/**
 * Hasta cuando queda pago el negocio con un debito aprobado. Se cuenta desde
 * lo que ya tenia pago si todavia no vencio (pagar antes no hace perder dias),
 * o desde hoy si ya vencio.
 */
export function nuevoPagaHasta(
  ahora: Date, pagaHastaActual: string | null | undefined, ciclo: "mensual" | "anual",
): Date {
  const actual = pagaHastaActual ? new Date(pagaHastaActual) : null;
  const base = actual && !Number.isNaN(actual.getTime()) && actual.getTime() > ahora.getTime()
    ? actual : ahora;
  return sumarMeses(base, ciclo === "anual" ? 12 : 1);
}

/**
 * Como quedo un debito, segun /authorized_payments/{id}.
 *   aprobado  · el pago salio: se corre paga_hasta.
 *   rechazado · MP dejo de reintentar (o el pago fue rechazado y la cuota se cancelo).
 *   pendiente · programado o en reintento ("recycling"): todavia no se decide nada.
 */
export function estadoDelDebito(d: Record<string, unknown> | null | undefined):
  "aprobado" | "rechazado" | "pendiente" {
  const pago = (d?.payment ?? {}) as Record<string, unknown>;
  if (pago.status === "approved") return "aprobado";
  if (d?.status === "cancelled" || (d?.status === "processed" && pago.status === "rejected")) {
    return "rechazado";
  }
  return "pendiente";
}

/**
 * Con un debito rechazado, Dante o Magnus bajan a Paris si no les queda nada
 * pago (decision del 6/nov). Paris no baja a ningun lado: queda para la
 * suspension por fecha de la 0052.
 */
export function planTrasRechazo(
  ahora: Date, planActual: string | null | undefined, pagaHasta: string | null | undefined,
): string | null {
  if (planActual !== "local" && planActual !== "cadena") return null;
  const hasta = pagaHasta ? new Date(pagaHasta) : null;
  if (hasta && hasta.getTime() > ahora.getTime()) return null;
  return "digital";
}
