// supabase/functions/sentry-to-telegram/index.ts
// Recibe webhooks de Sentry y reenvía el error formateado a Telegram (Claudia).
//
// Sentry → Settings → Integrations → Internal Integration → Webhook URL
// apuntada a esta función. Reusa el mismo bot+chat de morning-health.
//
// Seguridad: validamos el header `Sentry-Hook-Signature` con SENTRY_CLIENT_SECRET
// (HMAC-SHA256 del body) para rechazar webhooks falsos. Si no está seteado,
// aceptamos sin verificar (modo dev).
//
// Env vars (setear en Supabase Project Settings → Functions → Secrets):
//   - TELEGRAM_BOT_TOKEN     (mismo que morning-health)
//   - TELEGRAM_CHAT_ID       (mismo que morning-health)
//   - SENTRY_CLIENT_SECRET   (opcional, recomendado — del Internal Integration)

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("POST only", { status: 405 });
  }

  const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");
  const SENTRY_SECRET = Deno.env.get("SENTRY_CLIENT_SECRET");

  if (!TG_TOKEN || !TG_CHAT) {
    return new Response("Missing Telegram credentials", { status: 500 });
  }

  const rawBody = await req.text();

  // ── Verificación de firma (opcional pero recomendado) ──
  if (SENTRY_SECRET) {
    const sig = req.headers.get("sentry-hook-signature") || "";
    const valid = await verifySentrySignature(rawBody, sig, SENTRY_SECRET);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const message = formatSentryEvent(payload);
  if (!message) {
    // Ping de health-check o evento no soportado → 200 silencioso
    return new Response("ok", { status: 200 });
  }

  // ── Mandar a Telegram ──
  const tgRes = await fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    }
  );

  if (!tgRes.ok) {
    const body = await tgRes.text();
    console.error("Telegram API error:", tgRes.status, body);
    return new Response("Telegram delivery failed", { status: 502 });
  }

  return new Response("ok", { status: 200 });
});

// ────────────────────────────────────────────────────────
// Verificación HMAC-SHA256 del header Sentry-Hook-Signature
async function verifySentrySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex === signature;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────
// Formatea el payload de Sentry en un mensaje legible para Telegram
function formatSentryEvent(payload: any): string | null {
  // Sentry manda distintas acciones — sólo nos interesan "issue.created" y similares
  const action = payload.action;
  const data = payload.data?.issue || payload.data?.event;
  if (!data && !payload.event) return null;

  const evt = payload.event || payload.data?.event || data;
  const issue = payload.data?.issue;

  const title = evt?.title || issue?.title || "Error sin título";
  const culprit = evt?.culprit || issue?.culprit || "";
  const env = evt?.environment || issue?.environment || "production";
  const tags = Array.isArray(evt?.tags)
    ? Object.fromEntries(evt.tags)
    : (evt?.tags || {});
  const tenant = tags.tenant_name || tags.tenant || "desconocido";
  const release = evt?.release || issue?.metadata?.release || "—";

  // User
  const user = evt?.user || {};
  const userInfo = user.email
    ? `${user.email}`
    : user.id
      ? `id:${user.id}`
      : "anónimo";

  // URL al evento en Sentry
  const url = payload.data?.issue?.web_url || payload.data?.event?.web_url || "";

  // Stack: primera línea relevante
  const stack = evt?.exception?.values?.[0]?.stacktrace?.frames?.slice(-3)
    .map((f: any) => `  ${f.function || "?"} @ ${(f.filename || "").split("/").pop()}:${f.lineno || "?"}`)
    .join("\n");

  const lines = [
    `🚨 *Hermes Error*`,
    ``,
    `*${escapeMd(title)}*`,
    culprit ? `\`${escapeMd(culprit)}\`` : "",
    ``,
    `🏢 Cliente: *${escapeMd(tenant)}*`,
    `👤 Usuario: ${escapeMd(userInfo)}`,
    `🌐 Env: ${escapeMd(env)} · Release: \`${escapeMd(release)}\``,
    stack ? `\n*Stack:*\n\`\`\`\n${stack}\n\`\`\`` : "",
    url ? `\n[Ver en Sentry](${url})` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

function escapeMd(s: string): string {
  return String(s || "")
    .replace(/\*/g, "")
    .replace(/_/g, "\\_")
    .replace(/`/g, "'")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")");
}
