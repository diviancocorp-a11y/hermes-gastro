// Memoria de la charla y herramienta `anotar` de GerenteDico (etapa 3).
//
// Logica pura (sin base): que historia ve el modelo, como queda el issue, que
// cuenta como SI. Y crearIssue, que habla con GitHub. index.ts hace las
// lecturas y escrituras en gerente_mensajes y gerente_notas (0099).
//
// El issue NO lo crea el modelo: la herramienta `anotar` solo deja una nota
// pendiente y el codigo le muestra a Ricky el texto exacto. Se crea cuando
// Ricky contesta SI, y eso lo decide esSi(), no OpenAI.

export const HISTORIA_MAX = 10;
export const HISTORIA_HORAS = 12;
export const RETENCION_DIAS = 30;
export const NOTA_VENCE_MIN = 15;

export const REPO = "diviancocorp-a11y/hermes-gastro";
export const LABEL = "gerentedico";

const MAX_TITULO = 80;
const MAX_CUERPO = 6000;
const MAX_TEXTO = 4000;

type Fila = { rol: string; texto: string };

/** Filas de gerente_mensajes (de la mas nueva a la mas vieja) -> mensajes para OpenAI, en orden. */
export function historiaComoMensajes(filas: Fila[]): { role: "user" | "assistant"; content: string }[] {
  return filas
    .filter((f) => (f.rol === "user" || f.rol === "assistant") && typeof f.texto === "string" && f.texto)
    .slice(0, HISTORIA_MAX)
    .reverse()
    .map((f) => ({ role: f.rol as "user" | "assistant", content: f.texto }));
}

/** Lo que entra en la columna texto (check de 4000 en la 0099). */
export function paraGuardar(texto: string): string {
  return texto.length <= MAX_TEXTO ? texto : `${texto.slice(0, MAX_TEXTO - 1)}…`;
}

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** El SI que crea el issue. Estricto a proposito: "si, pero cambia el titulo" no es un SI. */
export function esSi(texto: string): boolean {
  const t = sinTildes(String(texto ?? "")).trim().toLowerCase().replace(/[.!]+$/, "");
  return ["si", "dale", "crealo", "si, crealo", "si crealo"].includes(t);
}

/** Un no explicito: se descarta y no se le pregunta nada al modelo. */
export function esNo(texto: string): boolean {
  const t = sinTildes(String(texto ?? "")).trim().toLowerCase().replace(/[.!]+$/, "");
  return ["no", "cancelar", "cancela", "descartalo", "dejalo"].includes(t);
}

export function notaVencida(creadaEn: string, ahora = Date.now()): boolean {
  return ahora - new Date(creadaEn).getTime() > NOTA_VENCE_MIN * 60_000;
}

export function tituloValido(t: unknown): string | null {
  const v = String(t ?? "").replace(/\s+/g, " ").trim();
  if (!v) return null;
  return v.length <= MAX_TITULO ? v : `${v.slice(0, MAX_TITULO - 1)}…`;
}

function citar(texto: string, max: number): string {
  const corto = texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`;
  return corto.split("\n").map((l) => `> ${l}`).join("\n");
}

/** El cuerpo del issue. El repo es publico: lo que va aca lo ve cualquiera. */
export function cuerpoDelIssue(
  { detalle, pedido, contexto, fecha }: { detalle: string; pedido: string; contexto: string | null; fecha: string },
): string {
  const partes = [
    String(detalle ?? "").trim().slice(0, 2500) || "(sin detalle)",
    "",
    "**Pedido original (Telegram):**",
    citar(String(pedido ?? "").trim(), 1500),
  ];
  if (contexto?.trim()) partes.push("", "**Respondia a este mensaje:**", citar(contexto.trim(), 1500));
  partes.push("", "---", `Anotado por GerenteDico desde Telegram, ${fecha}.`);
  return partes.join("\n").slice(0, MAX_CUERPO);
}

/** dd/mm/aaaa en hora argentina. */
export function fechaArgentina(d = new Date()): string {
  return d.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/** Lo que ve Ricky antes del SI: el texto exacto que va a GitHub. */
export function textoDePropuesta(titulo: string, cuerpo: string): string {
  return [
    "Issue para anotar en GitHub (el repo es publico):",
    `Titulo: ${titulo}`,
    "",
    cuerpo,
    "",
    `Contesta SI para crearlo. Cualquier otra cosa lo descarta. Vence en ${NOTA_VENCE_MIN} minutos.`,
  ].join("\n");
}

export type ResultadoIssue =
  | { ok: true; number: number; url: string }
  | { ok: false; motivo: string };

/** Crea el issue. Si GitHub rechaza el label (422), lo reintenta sin label. */
export async function crearIssue(
  token: string,
  { titulo, cuerpo }: { titulo: string; cuerpo: string },
  f: typeof fetch = fetch,
): Promise<ResultadoIssue> {
  const intentar = (labels: string[] | undefined) =>
    f(`https://api.github.com/repos/${REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "GerenteDico",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(labels ? { title: titulo, body: cuerpo, labels } : { title: titulo, body: cuerpo }),
      signal: AbortSignal.timeout(15000),
    });

  let r: Response;
  try {
    r = await intentar([LABEL]);
    if (r.status === 422) r = await intentar(undefined);
  } catch (e) {
    return { ok: false, motivo: `no pude hablar con GitHub (${(e as Error).message})` };
  }
  if (r.status === 401) return { ok: false, motivo: "GitHub rechazo el token: no sirve o vencio (GERENTE_GITHUB_TOKEN)" };
  if (r.status === 403 || r.status === 404) {
    return { ok: false, motivo: `el token no tiene permiso de Issues en ${REPO} (GitHub respondio ${r.status})` };
  }
  if (!r.ok) return { ok: false, motivo: `GitHub respondio ${r.status}` };
  const d = await r.json().catch(() => ({}));
  if (!d?.number || !d?.html_url) return { ok: false, motivo: "GitHub no devolvio el numero del issue" };
  return { ok: true, number: d.number, url: d.html_url };
}
