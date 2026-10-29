// scripts/pendientes-en-pr.mjs
// ─────────────────────────────────────────────────────────
// Para morning-health: que funciones driftearon y que migraciones no tienen
// archivo, y si el archivo que falta ya esta en un PR abierto.
//
// Nacio el 29/oct: el reporte decia "DRIFT" y "SIN ARCHIVO" sin nombres, y
// la causa era la 0113 aplicada a la base el 24/oct con el archivo esperando
// 5 dias en el PR 54. Con el numero del PR en el mensaje se resuelve con un
// merge en vez de con una investigacion.
//
// Lee la API de GitHub con GH_TOKEN (o GITHUB_TOKEN); el repo es publico, asi
// que sin token tambien anda, con el limite de 60 consultas por hora. Si la
// API falla, devuelve un mapa vacio: el reporte sale con los nombres igual.
// ─────────────────────────────────────────────────────────

import { normalizar } from './check-migraciones-sin-archivo.mjs';

const sinAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');

/** Nombres de funcion de las lineas `✗ fn: ...` / `✗ fn(args): ...` de
 *  check-functions-drift. El resumen (`✗ 2 funcion(es) con drift`) no entra. */
export function nombresDelDrift(salida) {
  const nombres = sinAnsi(salida).split('\n')
    .map((l) => l.match(/^✗ ([a-z_][a-z0-9_]*)(?:\([^)]*\))?:/i))
    .filter(Boolean)
    .map((m) => m[1]);
  return [...new Set(nombres)];
}

/** Nombres de la lista que imprime check-migraciones-sin-archivo. */
export function nombresSinArchivo(salida) {
  const lineas = sinAnsi(salida).split('\n');
  const desde = lineas.findIndex((l) => /^✗ \d+ migracion/.test(l));
  if (desde === -1) return [];
  const nombres = [];
  for (const l of lineas.slice(desde + 1)) {
    const m = l.match(/^ {4}(\S+)\s*$/);
    if (!m) break;
    nombres.push(m[1]);
  }
  return nombres;
}

/**
 * @param {{ funciones: string[], migraciones: string[] }} faltan
 * @param {{ number: number, files: { filename: string, patch?: string }[] }[]} prs
 * @returns {Map<string, number>} nombre → numero del PR que trae el archivo
 */
export function buscarEnPrs({ funciones, migraciones }, prs) {
  const donde = new Map();
  for (const pr of prs) {
    const sql = pr.files.filter((f) => /^platform\/migrations\/[^/]+\.sql$/.test(f.filename));
    for (const m of migraciones) {
      if (donde.has(m)) continue;
      if (sql.some((f) => normalizar(f.filename.split('/').pop()) === normalizar(m))) donde.set(m, pr.number);
    }
    for (const fn of funciones) {
      if (donde.has(fn)) continue;
      const re = new RegExp(`function\\s+(?:public\\.)?${fn}\\s*\\(`, 'i');
      if (sql.some((f) => re.test(f.patch || ''))) donde.set(fn, pr.number);
    }
  }
  return donde;
}

/** PRs abiertos con sus archivos. Ante cualquier error, lista vacia. */
export async function traerPrsAbiertos(repo = process.env.GITHUB_REPOSITORY || 'diviancocorp-a11y/hermes-gastro') {
  const token = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim();
  const headers = { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const get = async (path) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  try {
    const abiertos = await get('/pulls?state=open&per_page=50');
    return await Promise.all(abiertos.map(async (pr) => ({
      number: pr.number,
      files: await get(`/pulls/${pr.number}/files?per_page=100`),
    })));
  } catch (e) {
    console.log(`· PRs abiertos: no se pudieron leer (${e.message})`);
    return [];
  }
}

/** "`get_catalog`, `get_available_slots` (en el PR #54, falta mergear)".
 *  En code para que Telegram no lea el _ como cursiva. */
export function listarConPr(nombres, donde) {
  return nombres
    .map((n) => (donde.has(n) ? `\`${n}\` (en el PR #${donde.get(n)}, falta mergear)` : `\`${n}\``))
    .join(', ');
}
