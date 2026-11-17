#!/usr/bin/env node
// scripts/dominios-tenants.mjs  ·  node scripts/dominios-tenants.mjs [--solo-mirar]
//
// Cada tenant vive en <slug>.divianco.app. El DNS esta en Cloudflare, asi que
// el comodin *.divianco.app de Vercel queda "Invalid Configuration" y Vercel
// NO emite un certificado que cubra a todos: cada subdominio tiene que estar
// cargado en el proyecto para tener el suyo. El 17/nov mia-estudio estuvo
// caido con un certificado vencido porque se habia cargado "miaestudio".
//
// Este script compara los tenants vivos (active + trial) con los dominios del
// proyecto hermes-platform y agrega los que faltan. Es idempotente. Lo usan:
//   - create-owner, apenas da de alta un tenant;
//   - morning-health, cada turno (cubre tambien el alta self-service).
//
// Env: VERCEL_TOKEN (token con permiso sobre el proyecto). Opcionales:
// VERCEL_TEAM_ID y VERCEL_PROJECT (por defecto los del edificio).
// Sin token no rompe: devuelve { sinToken: true }.

import { fileURLToPath } from 'node:url';
import { tenantsAMirar } from './tenants-vivos.mjs';

const TEAM = 'team_E5ATCc0AjW66Ej0axz7l5SSg';
const PROYECTO = 'hermes-platform';
export const RAIZ = 'divianco.app';

export const dominioDe = (slug) => `${String(slug).trim().toLowerCase()}.${RAIZ}`;

/** Que dominios de tenants faltan en el proyecto. Puro. */
export function faltantes(slugs, dominiosDelProyecto) {
  const hay = new Set(dominiosDelProyecto.map((d) => String(d).toLowerCase()));
  return [...new Set(slugs.filter(Boolean).map(dominioDe))].filter((d) => !hay.has(d)).sort();
}

/**
 * @param {string[]} slugs
 * @param {{ env?: object, fetchImpl?: typeof fetch, soloMirar?: boolean }} [o]
 * @returns {Promise<{ sinToken?: true, faltaban: string[], agregados: string[], errores: string[] }>}
 */
export async function asegurarDominios(slugs, { env = process.env, fetchImpl = fetch, soloMirar = false } = {}) {
  const token = String(env.VERCEL_TOKEN || '').trim();
  if (!token) return { sinToken: true, faltaban: [], agregados: [], errores: [] };
  const team = String(env.VERCEL_TEAM_ID || TEAM).trim();
  const proyecto = encodeURIComponent(String(env.VERCEL_PROJECT || PROYECTO).trim());
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = `https://api.vercel.com`;

  const r = await fetchImpl(`${base}/v9/projects/${proyecto}/domains?teamId=${team}&limit=100`, { headers });
  if (!r.ok) return { faltaban: [], agregados: [], errores: [`no se pudo leer los dominios del proyecto (HTTP ${r.status})`] };
  const { domains = [] } = await r.json();
  const faltaban = faltantes(slugs, domains.map((d) => d.name));

  const agregados = [];
  const errores = [];
  if (!soloMirar) {
    for (const name of faltaban) {
      const a = await fetchImpl(`${base}/v10/projects/${proyecto}/domains?teamId=${team}`, {
        method: 'POST', headers, body: JSON.stringify({ name }),
      });
      if (a.ok) agregados.push(name);
      else errores.push(`${name}: HTTP ${a.status} ${(await a.text()).slice(0, 160)}`);
    }
  }
  return { faltaban, agregados, errores };
}

// ---- CLI ----
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const soloMirar = process.argv.includes('--solo-mirar');
  const lista = await tenantsAMirar();
  const slugs = [...lista.activos, ...(lista.enCarga || [])];
  const r = await asegurarDominios(slugs, { soloMirar });
  if (r.sinToken) {
    console.error('Falta VERCEL_TOKEN en el entorno: no se pueden revisar los dominios.');
    process.exitCode = 1;
  } else {
    console.log(`${slugs.length} tenant(s); faltaban: ${r.faltaban.join(', ') || 'ninguno'}`);
    if (r.agregados.length) console.log(`agregados: ${r.agregados.join(', ')}`);
    for (const e of r.errores) console.error(`✗ ${e}`);
    if (r.errores.length || (soloMirar && r.faltaban.length)) process.exitCode = 1;
  }
}
