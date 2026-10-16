// Logica pura de sentry-alerta: firma, lectura del payload y armado del
// mensaje. Sin Deno ni Supabase a proposito: la importan la function y los
// tests (src/test/sentryAlerta.test.js).

const enc = new TextEncoder();

function aHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparacion en tiempo constante: no filtra cuantos caracteres coinciden. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Sentry firma cada webhook de una integracion interna con el Client Secret:
 *   sentry-hook-signature = HMAC_SHA256(key = client secret, msg = body crudo), hex
 * Sin esto cualquiera que conozca la URL podria mandarle alertas falsas a Ricky.
 */
export async function firmaValida(secreto: string, cuerpo: string, firma: string | null): Promise<boolean> {
  if (!secreto || !firma) return false;
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const esperada = aHex(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(cuerpo))));
  return iguales(esperada, firma.trim().toLowerCase());
}

export interface Alerta {
  titulo: string;
  donde: string;
  nivel: string;
  link: string;
  negocio: string | null;
  pantalla: string | null;
  release: string | null;
  regla: string | null;
}

type Dict = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** `crazy-miga.divianco.app/checkout` -> `crazy-miga`. La raiz o www no son negocio. */
export function negocioDeUrl(url: unknown): string | null {
  const s = str(url);
  if (!s) return null;
  try {
    const host = new URL(s).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9-]+)\.divianco\.app$/);
    return m && m[1] !== "www" ? m[1] : null;
  } catch {
    return null;
  }
}

function tag(tags: unknown, nombre: string): string | null {
  if (!Array.isArray(tags)) return null;
  for (const t of tags) {
    if (Array.isArray(t) && t[0] === nombre) return str(t[1]);
    if (t && typeof t === "object" && (t as Dict).key === nombre) return str((t as Dict).value);
  }
  return null;
}

/**
 * Lo que importa del webhook, venga de una regla de alerta (`event_alert`,
 * data.event) o de la suscripcion a issues (`issue` created, data.issue).
 * Devuelve null si no es algo para avisar.
 */
export function leerAlerta(recurso: string | null, body: Dict): Alerta | null {
  const data = (body?.data ?? {}) as Dict;
  if (recurso === "event_alert") {
    const e = (data.event ?? {}) as Dict;
    const req = (e.request ?? {}) as Dict;
    const url = str(req.url) ?? tag(e.tags, "url");
    return {
      titulo: str(e.title) ?? "Error sin titulo",
      donde: str(e.culprit) ?? "",
      nivel: str(e.level) ?? "error",
      link: str(e.web_url) ?? str(e.issue_url) ?? "",
      negocio: negocioDeUrl(url),
      pantalla: tag(e.tags, "screen"),
      release: str(e.release),
      regla: str(data.triggered_rule),
    };
  }
  if (recurso === "issue" && body?.action === "created") {
    const i = (data.issue ?? {}) as Dict;
    return {
      titulo: str(i.title) ?? "Error sin titulo",
      donde: str(i.culprit) ?? "",
      nivel: str(i.level) ?? "error",
      link: str(i.web_url) ?? str(i.permalink) ?? "",
      negocio: null,
      pantalla: null,
      release: null,
      regla: null,
    };
  }
  return null;
}

/** Telegram con parse_mode HTML: lo unico que hay que escapar son estos tres. */
export function h(s: unknown): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

export function armarMensaje(a: Alerta, explicacion: string | null): string {
  const lineas = [
    `🚨 <b>Error nuevo en Dico</b>${a.negocio ? ` · <b>${h(a.negocio)}</b>` : ""}`,
    "",
    `<b>${h(a.titulo)}</b>`,
  ];
  if (a.donde) lineas.push(`en <code>${h(a.donde)}</code>`);
  const datos = [a.pantalla && `pantalla ${a.pantalla}`, a.release && `version ${a.release}`, a.nivel !== "error" && a.nivel]
    .filter(Boolean).join(" · ");
  if (datos) lineas.push(h(datos));
  if (explicacion) lineas.push("", `🧠 ${h(explicacion)}`);
  if (a.link) lineas.push("", `<a href="${h(a.link)}">Ver en Sentry</a>`);
  return lineas.join("\n");
}

/** Lo que se le pasa a DICO_BRAIN: solo lo del error, sin datos de clientes. */
export function resumenParaCerebro(a: Alerta): string {
  return [
    `Error: ${a.titulo}`,
    a.donde && `Donde: ${a.donde}`,
    a.negocio && `Negocio: ${a.negocio}`,
    a.pantalla && `Pantalla: ${a.pantalla}`,
  ].filter(Boolean).join("\n");
}
