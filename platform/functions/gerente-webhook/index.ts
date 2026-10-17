// gerente-webhook: Ricky le escribe a GerenteDico por Telegram y le contesta.
//
// Etapa 2 del plan de GerenteDico (HANDOFF 16/oct): conversacion con
// herramientas de SOLO LECTURA (herramientas.ts). El cerebro es OpenAI, con la
// misma key que ya usan morning-health y sentry-alerta (DICO_BRAIN).
//
// Etapa 3 (17/oct): memoria de la charla y herramienta `anotar` (anotar.ts).
// Lo que se dijo vive en gerente_mensajes y los issues propuestos en
// gerente_notas (0099). El issue se crea en GitHub solo cuando Ricky contesta
// SI a la propuesta; eso lo decide el codigo, no el modelo.
//
// Se registra en Telegram con platform/scripts/gerente-webhook.mjs (o el
// workflow "GerenteDico webhook" de GitHub, que ya tiene el token).
//
// verify_jwt=false: la llama Telegram, sin JWT. Proteccion:
//   1) header X-Telegram-Bot-Api-Secret-Token derivado del token (firma.ts);
//   2) solo se atiende el chat TELEGRAM_CHAT_ID (el de Ricky). Cualquier otro
//      chat se ignora sin contestar.
//
// Secrets (los mismos de sentry-alerta, ya cargados):
//   GERENTEDICOBOT, TELEGRAM_CHAT_ID, DICO_BRAIN, DICO_BRAIN_MODEL (opcional)
// Y para anotar: GERENTE_GITHUB_TOKEN (fine-grained, solo hermes-gastro,
// Issues: Read and write). Sin el, anotar avisa que falta y no propone nada.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
//
// Se responde 200 enseguida y se trabaja en segundo plano (waitUntil): si
// Telegram no recibe respuesta a tiempo reintenta, y la respuesta saldria dos
// veces.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { firmaDelGerente, iguales } from "./firma.ts";
import {
  cortar, diasValidos, HERRAMIENTAS, PROMPT_SISTEMA, resumirPedidos, slugValido,
} from "./herramientas.ts";
import {
  crearIssue, cuerpoDelIssue, esNo, esSi, fechaArgentina, HISTORIA_HORAS, HISTORIA_MAX,
  historiaComoMensajes, notaVencida, paraGuardar, RETENCION_DIAS, textoDePropuesta, tituloValido,
} from "./anotar.ts";

const ok = () => new Response("ok", { status: 200 });
const MAX_VUELTAS = 4;

async function telegram(token: string, metodo: string, cuerpo: Record<string, unknown>) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  } catch (e) {
    console.warn("gerente telegram:", metodo, (e as Error).message);
  }
}

async function tenantPorSlug(db: SupabaseClient, slug: string) {
  const { data } = await db.from("tenants").select("id, slug, name").eq("slug", slug).maybeSingle();
  return data;
}

// Lo que necesita `anotar` de la charla en curso, y la propuesta que deja.
type Turno = {
  chatId: string;
  pregunta: string;
  contexto: string | null;
  propuesta: { titulo: string; cuerpo: string } | null;
};

async function proponerNota(db: SupabaseClient, args: Record<string, unknown>, turno: Turno) {
  if (!Deno.env.get("GERENTE_GITHUB_TOKEN")?.trim()) {
    return { error: "No puedo anotar: falta el secret GERENTE_GITHUB_TOKEN en la function. Decile a Ricky." };
  }
  if (turno.propuesta) return { error: "Ya propusiste un issue en este mensaje: uno por vez." };
  const titulo = tituloValido(args.titulo);
  if (!titulo) return { error: "falta el titulo" };
  const cuerpo = cuerpoDelIssue({
    detalle: String(args.detalle ?? ""), pedido: turno.pregunta, contexto: turno.contexto, fecha: fechaArgentina(),
  });
  // La propuesta anterior que no se contesto queda descartada: el SI siempre
  // es para la ultima que se mostro (indice unico de la 0099).
  await db.from("gerente_notas").update({ estado: "descartada", resuelta_at: new Date().toISOString() })
    .eq("chat_id", turno.chatId).eq("estado", "pendiente");
  const { error } = await db.from("gerente_notas").insert({ chat_id: turno.chatId, titulo, cuerpo });
  if (error) return { error: `no pude guardar la propuesta: ${error.message}` };
  turno.propuesta = { titulo, cuerpo };
  return {
    propuesta: "lista",
    aviso: "El sistema le muestra el issue a Ricky debajo de tu respuesta y espera su SI. "
      + "No lo repitas ni digas que ya quedo anotado: decile en una linea que lo revise.",
  };
}

async function ejecutar(db: SupabaseClient, nombre: string, args: Record<string, unknown>, turno: Turno) {
  if (nombre === "anotar") return proponerNota(db, args, turno);

  if (nombre === "negocios") {
    const desde = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [{ data: tenants }, { data: productos }, { data: pedidos }] = await Promise.all([
      db.from("tenants").select("id, slug, name, status, plan, created_at, first_order_at, last_activity_at"),
      db.from("products").select("tenant_id").eq("active", true).eq("is_archived", false),
      db.from("orders").select("tenant_id, status, total").gte("created_at", desde),
    ]);
    return (tenants ?? []).map((t) => {
      const suyos = (pedidos ?? []).filter((p) => p.tenant_id === t.id);
      return {
        slug: t.slug, nombre: t.name, estado: t.status, plan: t.plan,
        alta: t.created_at, primer_pedido: t.first_order_at, ultima_actividad: t.last_activity_at,
        productos_activos: (productos ?? []).filter((p) => p.tenant_id === t.id).length,
        pedidos_7_dias: suyos.length,
        facturado_7_dias: Math.round(suyos.filter((p) => p.status !== "cancelled")
          .reduce((s, p) => s + (Number(p.total) || 0), 0)),
      };
    });
  }

  const slug = slugValido(args.slug);
  if (!slug) return { error: "slug invalido" };
  const t = await tenantPorSlug(db, slug);
  if (!t) return { error: `no existe el negocio ${slug}` };

  if (nombre === "pedidos") {
    const dias = diasValidos(args.dias);
    const desde = new Date(Date.now() - dias * 86400_000).toISOString();
    const { data, error } = await db.from("orders").select("status, channel, total, created_at")
      .eq("tenant_id", t.id).gte("created_at", desde);
    if (error) return { error: error.message };
    return { negocio: t.slug, ...resumirPedidos(data ?? [], dias) };
  }

  if (nombre === "productos") {
    const { data, error } = await db.from("products")
      .select("name, category, price, stock, active, is_archived").eq("tenant_id", t.id).order("name");
    if (error) return { error: error.message };
    return { negocio: t.slug, productos: data ?? [] };
  }

  return { error: `herramienta desconocida: ${nombre}` };
}

// deno-lint-ignore no-explicit-any
type Mensaje = Record<string, any>;

async function pensar(db: SupabaseClient, turno: Turno, historia: Mensaje[]): Promise<string> {
  const key = Deno.env.get("DICO_BRAIN")?.trim();
  if (!key) return "No tengo cerebro: falta el secret DICO_BRAIN en la function.";
  const model = Deno.env.get("DICO_BRAIN_MODEL")?.trim() || "gpt-4o-mini";

  const mensajes: Mensaje[] = [{ role: "system", content: PROMPT_SISTEMA }, ...historia];
  // Si Ricky contesta a un mensaje (un aviso de Sentry, una respuesta anterior),
  // ese texto es el contexto de la pregunta.
  if (turno.contexto) {
    mensajes.push({ role: "user", content: `Contexto (mensaje al que respondo):\n${turno.contexto}` });
  }
  mensajes.push({ role: "user", content: turno.pregunta });

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    let d: Mensaje;
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: 600, messages: mensajes, tools: HERRAMIENTAS }),
      });
      if (!r.ok) {
        console.error("gerente openai:", r.status, (await r.text()).slice(0, 200));
        return `No pude pensar la respuesta (OpenAI respondio ${r.status}).`;
      }
      d = await r.json();
    } catch (e) {
      return `No pude pensar la respuesta (${(e as Error).message}).`;
    }

    const msg = d.choices?.[0]?.message;
    if (!msg) return "OpenAI no devolvio respuesta.";
    const llamadas = msg.tool_calls ?? [];
    if (!llamadas.length) return String(msg.content ?? "").trim() || "(sin respuesta)";

    mensajes.push(msg);
    for (const c of llamadas) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* args vacios */ }
      let resultado: unknown;
      try {
        resultado = await ejecutar(db, c.function?.name, args, turno);
      } catch (e) {
        resultado = { error: (e as Error).message };
      }
      mensajes.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(resultado).slice(0, 12000) });
    }
  }
  return "Me quede dando vueltas con las consultas y no llegue a una respuesta. Proba preguntarlo mas concreto.";
}

const BIENVENIDA = [
  "Soy GerenteDico. Puedo consultar, no cambiar nada de los negocios:",
  "- que negocios hay y como vienen (pedidos y facturacion de la semana)",
  "- los pedidos de un negocio en los ultimos dias",
  "- los productos de un negocio",
  "Y anotar arreglos como issue de GitHub: decime \"anota que hay que arreglar X\",",
  "te muestro el texto y lo creo si contestas SI.",
  `Me acuerdo de lo que hablamos en las ultimas ${HISTORIA_HORAS} horas. /olvidar borra la charla.`,
  "Preguntame en castellano, por ejemplo: como viene crazy-miga esta semana?",
].join("\n");

async function leerHistoria(db: SupabaseClient, chatId: string): Promise<Mensaje[]> {
  const desde = new Date(Date.now() - HISTORIA_HORAS * 3600_000).toISOString();
  const { data, error } = await db.from("gerente_mensajes").select("rol, texto")
    .eq("chat_id", chatId).gte("created_at", desde)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(HISTORIA_MAX);
  if (error) console.warn("gerente historia:", error.message);
  return historiaComoMensajes(data ?? []);
}

async function guardarCharla(db: SupabaseClient, chatId: string, pregunta: string, respuesta: string) {
  const { error } = await db.from("gerente_mensajes").insert([
    { chat_id: chatId, rol: "user", texto: paraGuardar(pregunta) },
    { chat_id: chatId, rol: "assistant", texto: paraGuardar(respuesta) },
  ]);
  if (error) console.warn("gerente guardar:", error.message);
  const viejo = new Date(Date.now() - RETENCION_DIAS * 86400_000).toISOString();
  await db.from("gerente_mensajes").delete().eq("chat_id", chatId).lt("created_at", viejo);
}

/**
 * Si hay una nota esperando el SI, este mensaje la resuelve. Devuelve la
 * respuesta para Ricky si el mensaje era sobre la nota (SI o no), o null si hay
 * que seguir con la charla normal. Cualquier otro mensaje la descarta.
 */
async function resolverNota(db: SupabaseClient, chatId: string, texto: string): Promise<string | null> {
  const { data: nota } = await db.from("gerente_notas").select("id, titulo, cuerpo, created_at")
    .eq("chat_id", chatId).eq("estado", "pendiente").maybeSingle();
  if (!nota) return null;
  const ahora = new Date().toISOString();
  const vencida = notaVencida(nota.created_at);

  if (vencida || !esSi(texto)) {
    await db.from("gerente_notas").update({ estado: "descartada", resuelta_at: ahora })
      .eq("id", nota.id).eq("estado", "pendiente");
    return !vencida && esNo(texto) ? "Listo, no lo anoto." : null;
  }

  // pendiente -> creando en un solo update: si el SI llega dos veces, el
  // segundo no encuentra la fila y no crea otro issue.
  const { data: tomada } = await db.from("gerente_notas").update({ estado: "creando" })
    .eq("id", nota.id).eq("estado", "pendiente").select("id");
  if (!tomada?.length) return "Ese issue ya se estaba creando.";

  const r = await crearIssue(Deno.env.get("GERENTE_GITHUB_TOKEN")?.trim() || "", nota);
  if (!r.ok) {
    await db.from("gerente_notas").update({ estado: "fallo", resuelta_at: ahora }).eq("id", nota.id);
    return `No lo pude anotar: ${r.motivo}.`;
  }
  await db.from("gerente_notas")
    .update({ estado: "creada", issue_number: r.number, issue_url: r.url, resuelta_at: ahora }).eq("id", nota.id);
  return `Anotado: issue #${r.number}\n${r.url}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = Deno.env.get("GERENTEDICOBOT")?.trim();
  const chatRicky = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();
  if (!token || !chatRicky) return new Response("Not configured", { status: 500 });

  const recibida = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!iguales(recibida, await firmaDelGerente(token))) return new Response("Unauthorized", { status: 401 });

  // deno-lint-ignore no-explicit-any
  let update: any;
  try { update = await req.json(); } catch { return ok(); }

  const m = update?.message;
  const texto = typeof m?.text === "string" ? m.text.trim() : "";
  // Solo el chat de Ricky. A cualquier otro no se le contesta: ni confirma que
  // el bot existe.
  if (!m || String(m.chat?.id) !== chatRicky || !texto) return ok();

  const trabajo = (async () => {
    if (texto === "/start" || texto === "/ayuda") {
      await telegram(token, "sendMessage", { chat_id: chatRicky, text: BIENVENIDA });
      return;
    }
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const contestar = (text: string) => telegram(token, "sendMessage", {
      chat_id: chatRicky,
      text: cortar(text),
      reply_to_message_id: m.message_id,
      disable_web_page_preview: true,
    });

    if (texto === "/olvidar") {
      await db.from("gerente_mensajes").delete().eq("chat_id", chatRicky);
      await db.from("gerente_notas").update({ estado: "descartada", resuelta_at: new Date().toISOString() })
        .eq("chat_id", chatRicky).eq("estado", "pendiente");
      await contestar("Listo, me olvide de la charla. Arrancamos de cero.");
      return;
    }

    const sobreLaNota = await resolverNota(db, chatRicky, texto);
    if (sobreLaNota) {
      await contestar(sobreLaNota);
      await guardarCharla(db, chatRicky, texto, sobreLaNota);
      return;
    }

    await telegram(token, "sendChatAction", { chat_id: chatRicky, action: "typing" });
    const turno: Turno = {
      chatId: chatRicky,
      pregunta: texto,
      contexto: typeof m.reply_to_message?.text === "string" ? m.reply_to_message.text : null,
      propuesta: null,
    };
    const historia = await leerHistoria(db, chatRicky);
    let respuesta = await pensar(db, turno, historia);
    // La propuesta la muestra el codigo, tal cual va a GitHub: el modelo no la
    // puede resumir ni cambiar despues de guardada.
    if (turno.propuesta) respuesta += `\n\n${textoDePropuesta(turno.propuesta.titulo, turno.propuesta.cuerpo)}`;
    await contestar(respuesta);
    await guardarCharla(db, chatRicky, texto, respuesta);
  })().catch((e) => console.error("gerente:", (e as Error).message));

  EdgeRuntime.waitUntil(trabajo);
  return ok();
});
