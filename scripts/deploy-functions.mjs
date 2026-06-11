#!/usr/bin/env node
// scripts/deploy-functions.mjs
//
// Deploya las edge functions de supabase/functions/ IDENTICAS a los tenants.
// Motivo (Sprint 4.10): el drift entre tenants ya causo bugs reales — LNP tenia
// el fix de verify_jwt en create-payment-preference y Cochi/MM no, lo que dejo
// el guest checkout de Mala Miga roto durante semanas.
//
// Requiere: Supabase CLI logueada (`npx supabase login`) o SUPABASE_ACCESS_TOKEN en env.
//
// Uso:
//   node scripts/deploy-functions.mjs --all                  # los 3 tenants
//   node scripts/deploy-functions.mjs --tenant mala-miga     # uno solo
//   node scripts/deploy-functions.mjs --tenant cochi --only submit-order,send-push
//   node scripts/deploy-functions.mjs --project-ref <ref>    # tenant nuevo (onboarding)

import { execSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_DIR = path.join(ROOT, "supabase", "functions");

// Tenants conocidos (project refs de Supabase)
const TENANTS = {
  "la-nona-pato": "rewzotanfurutjolghkf",
  "cochi":        "nzrzfknvlnddpexghynq",
  "mala-miga":    "tszcksppdglktcmzgepd",
};

// Functions que NUNCA se deployan
const SKIP = new Set([
  "afip-invoice", // STUB no funcional (auth WSAA sin implementar) — ver TAREAS-MANUALES.md
]);

// Functions PUBLICAS: van con --no-verify-jwt.
// Razon: las API keys nuevas (sb_publishable_) NO son JWT y el gateway con
// verify_jwt=true las rechaza → guest checkout roto. La proteccion real de
// estas functions es interna (rate limit, validacion server-side, auth propia).
const NO_VERIFY_JWT = new Set([
  "submit-order",
  "validate-coupon",
  "birthday-gift",      // guests sin JWT; auth interna: rate limit + birth_date validado en DB
  "hermes-daily-report", // lo llama pg_cron; rate limit 2/h (solo manda el informe a Telegram)
  "create-payment-preference",
  "mp-webhook",
  "mp-status",
  "mp-oauth-callback",
  "send-push",          // auth interna: service role o JWT admin
  "admin-users",        // auth interna: JWT owner
  "scheduled-export",   // auth interna: service role o JWT admin
  "sentry-to-telegram", // HMAC opcional de Sentry
]);

function parseArgs(argv) {
  const args = { refs: [], only: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") args.refs = Object.values(TENANTS);
    else if (a === "--tenant") {
      const slug = argv[++i];
      if (!TENANTS[slug]) {
        console.error(`Tenant desconocido: ${slug}. Conocidos: ${Object.keys(TENANTS).join(", ")}`);
        process.exit(1);
      }
      args.refs.push(TENANTS[slug]);
    }
    else if (a === "--project-ref") args.refs.push(argv[++i]);
    else if (a === "--only") args.only = new Set(argv[++i].split(",").map(s => s.trim()));
    else { console.error(`Flag desconocida: ${a}`); process.exit(1); }
  }
  return args;
}

function main() {
  const { refs, only } = parseArgs(process.argv);
  if (refs.length === 0) {
    console.log("Uso: node scripts/deploy-functions.mjs --all | --tenant <slug> | --project-ref <ref> [--only fn1,fn2]");
    process.exit(1);
  }

  const all = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(path.join(FUNCTIONS_DIR, d.name, "index.ts")))
    .map(d => d.name)
    .filter(n => !SKIP.has(n))
    .filter(n => !only || only.has(n));

  if (all.length === 0) { console.error("No hay functions para deployar."); process.exit(1); }

  console.log(`\nFunctions a deployar (${all.length}): ${all.join(", ")}`);
  console.log(`Tenants/refs (${refs.length}): ${refs.join(", ")}\n`);

  const failures = [];
  for (const ref of refs) {
    const slug = Object.keys(TENANTS).find(k => TENANTS[k] === ref) || ref;
    console.log(`\n========== ${slug} (${ref}) ==========`);
    for (const fn of all) {
      const noJwt = NO_VERIFY_JWT.has(fn) ? " --no-verify-jwt" : "";
      const cmd = `npx supabase functions deploy ${fn} --project-ref ${ref}${noJwt}`;
      process.stdout.write(`-> ${fn}${noJwt ? " (no-verify-jwt)" : ""} ... `);
      try {
        execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
        console.log("OK");
      } catch (e) {
        console.log("FALLO");
        console.error(String(e.stderr || e.message).slice(0, 400));
        failures.push(`${slug}/${fn}`);
      }
    }
  }

  console.log("\n──────────────────────────────");
  if (failures.length > 0) {
    console.error(`✗ Fallaron ${failures.length}: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("✓ Todas las functions deployadas identicas en todos los tenants.");
}

main();
