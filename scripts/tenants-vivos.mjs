#!/usr/bin/env node
// scripts/tenants-vivos.mjs  ·  node scripts/tenants-vivos.mjs
//
// Que negocios mira el control diario. Salen de la BASE, no de una lista a
// mano: el 16/oct SMOKE_TENANTS todavia decia mala-miga (borrado el 27/sep) y
// no tenia crazy-miga, el unico que vende. Con esto un cliente nuevo entra
// solo el dia que se activa.
//
// - `active`: se mira y, si el catalogo se cae o queda vacio, da rojo.
// - `trial`: dado de alta pero sin activar (sin productos todavia, p.ej.
//   Monare): se lista como "en carga", sin rojo.
// - `dormant`: no se mira.
//
// Lee con la service role (PLATFORM_SUPABASE_URL +
// PLATFORM_SUPABASE_SERVICE_ROLE_KEY). Sin credenciales, o si la base no
// contesta, cae a la variable SMOKE_TENANTS como antes.
//
// Como CLI imprime los slugs activos separados por coma: el workflow del
// smoke lo usa para armar SMOKE_TENANTS antes de correr Playwright.

import { fileURLToPath } from 'node:url';

/** Lista de la variable SMOKE_TENANTS, sin vacios. */
export const deVariable = (valor) => String(valor || '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * @param {{ slug: string, status: string }[]} filas
 * @returns {{ activos: string[], enCarga: string[] }}
 */
export function clasificar(filas) {
  const de = (estado) => filas.filter((t) => t.status === estado).map((t) => t.slug).sort();
  return { activos: de('active'), enCarga: de('trial') };
}

/**
 * @returns {Promise<{ fuente: 'base'|'variable', activos: string[], enCarga: string[], aviso?: string }>}
 */
export async function tenantsAMirar(env = process.env) {
  const url = (env.PLATFORM_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const respaldo = (aviso) => ({ fuente: 'variable', activos: deVariable(env.SMOKE_TENANTS), enCarga: [], aviso });
  if (!url || !key) return respaldo('sin credenciales de la base: se usa SMOKE_TENANTS');
  try {
    const r = await fetch(`${url}/rest/v1/tenants?select=slug,status&status=in.(active,trial)`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return respaldo(`la base contesto HTTP ${r.status}: se usa SMOKE_TENANTS`);
    return { fuente: 'base', ...clasificar(await r.json()) };
  } catch (e) {
    return respaldo(`la base no contesto (${e.name}): se usa SMOKE_TENANTS`);
  }
}

const ES_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (ES_MAIN) {
  const t = await tenantsAMirar();
  if (t.aviso) console.error(`· ${t.aviso}`);
  console.log(t.activos.join(','));
}
