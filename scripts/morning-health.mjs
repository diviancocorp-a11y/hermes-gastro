#!/usr/bin/env node
// scripts/morning-health.mjs
// ─────────────────────────────────────────────────────────
// Health check matutino del proyecto Hermes — envía a Telegram.
// Corre via GitHub Actions cron L-S 7am AR (10:00 UTC).
//
// Checks por tenant:
//   1. Catalog público accesible (HTTP 200)
//   2. Supabase REST API responde a /rest/v1/recipes (sanity DB)
//
// Output: mensaje Markdown enviado al chat_id configurado.
// ─────────────────────────────────────────────────────────

const TENANTS = [
  {
    name: 'La Nona Pato',
    url: 'https://la-nona-pato.vercel.app',
    supabase: 'https://rewzotanfurutjolghkf.supabase.co',
    anonKey: process.env.LNP_ANON_KEY,
  },
  {
    name: 'Cochi',
    url: 'https://cochi.vercel.app',
    supabase: 'https://nzrzfknvlnddpexghynq.supabase.co',
    anonKey: process.env.COCHI_ANON_KEY,
  },
  {
    name: 'Mala Miga',
    url: 'https://mala-miga.vercel.app',
    supabase: 'https://tszcksppdglktcmzgepd.supabase.co',
    anonKey: process.env.MALA_MIGA_ANON_KEY,
  },
];

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

if (!TG_TOKEN || !TG_CHAT) {
  console.error('❌ Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID');
  process.exit(1);
}

async function checkCatalog(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    return r.ok ? '✓' : `HTTP ${r.status}`;
  } catch (e) {
    return `error: ${e.name}`;
  }
}

async function checkSupabase(supabaseUrl, anonKey) {
  if (!anonKey) return 'sin anon key';
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/recipes?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(10000),
    });
    return r.ok ? '✓' : `HTTP ${r.status}`;
  } catch (e) {
    return `error: ${e.name}`;
  }
}

async function checkTenant(t) {
  const [catalog, supabase] = await Promise.all([
    checkCatalog(t.url),
    checkSupabase(t.supabase, t.anonKey),
  ]);
  const ok = catalog === '✓' && supabase === '✓';
  return { name: t.name, catalog, supabase, status: ok ? '🟢' : '🔴' };
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    console.error('Telegram API error:', r.status, body);
    process.exit(1);
  }
}

const results = await Promise.all(TENANTS.map(checkTenant));
const allOk = results.every((r) => r.status === '🟢');

const date = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const lines = [
  `🌅 *Actualización matutina del proyecto Hermes*`,
  `_${date}_`,
  '',
];

for (const r of results) {
  lines.push(`${r.status} *${r.name}*`);
  lines.push(`   Catalog: ${r.catalog}  ·  Supabase: ${r.supabase}`);
}

lines.push('');
if (allOk) {
  lines.push('✅ Todo en verde — podés arrancar el día tranquilo.');
} else {
  lines.push('⚠️ Algún tenant requiere atención. Revisar arriba.');
}

const msg = lines.join('\n');
console.log(msg);
await sendTelegram(msg);
console.log('\n✓ Enviado a Telegram');
