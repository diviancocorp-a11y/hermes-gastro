#!/usr/bin/env node
// scripts/check-carpetas-de-fork.mjs
// Gate de los PRs que vienen de un fork: un disenador externo solo puede tocar
// las carpetas que Ricky le habilito en scripts/disenadores.json.
//
//   "<login-github>": { "tenant": "cochi", "carpetas": ["src/catalog-pro/plantillas/cochi/"] }
//
// - Login sin entrada => el PR se rechaza ("pedile a Ricky").
// - Un archivo fuera de sus carpetas => el PR se rechaza y se listan los archivos.
// - Un renombre cuenta por origen y por destino: no se puede sacar un archivo de
//   afuera ni dejarlo afuera.
// - Las carpetas se comparan por prefijo EXACTO (`cochi/` no habilita `cochi-otro/`).
//
// Lo corre .github/workflows/carpetas-de-fork.yml (pull_request_target, solo forks).
// Variables: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, PR_LOGIN. Sin dependencias.
// Exit 0 todo ok; 1 hay archivos fuera o el usuario no esta habilitado; 2 fallo la consulta.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const normalizar = (ruta) => String(ruta || '').replace(/\\/g, '/').replace(/^\.\//, '');

/**
 * Funcion pura. `archivos`: [{ filename, previous_filename? }] como los da
 * GET /pulls/{n}/files (tambien acepta strings). `permisos`: el objeto
 * `disenadores` de disenadores.json.
 * @returns {{ ok: boolean, motivo: string, fuera: string[] }}
 */
export function revisarArchivos({ archivos = [], login, permisos = {} }) {
  const entrada = Object.hasOwn(permisos, login) ? permisos[login] : null;
  if (!entrada || !Array.isArray(entrada.carpetas) || entrada.carpetas.length === 0) {
    return { ok: false, motivo: 'usuario no habilitado: pedile a Ricky', fuera: [] };
  }
  const carpetas = entrada.carpetas.map((c) => {
    const n = normalizar(c);
    return n.endsWith('/') ? n : `${n}/`;
  });
  const rutas = [];
  for (const a of archivos) {
    if (typeof a === 'string') { rutas.push(normalizar(a)); continue; }
    if (a?.filename) rutas.push(normalizar(a.filename));
    if (a?.previous_filename) rutas.push(normalizar(a.previous_filename));
  }
  const fuera = [...new Set(rutas.filter((r) => !carpetas.some((c) => r.startsWith(c)) || r.split('/').includes('..')))];
  if (fuera.length) {
    return { ok: false, motivo: `el PR toca archivos fuera de ${carpetas.join(', ')}`, fuera };
  }
  return { ok: true, motivo: 'todo dentro de las carpetas habilitadas', fuera: [] };
}

async function archivosDelPr({ token, repo, numero }) {
  const archivos = [];
  for (let pagina = 1; pagina <= 30; pagina += 1) {
    const r = await fetch(`https://api.github.com/repos/${repo}/pulls/${numero}/files?per_page=100&page=${pagina}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!r.ok) throw new Error(`GitHub respondio ${r.status} al listar los archivos del PR`);
    const lote = await r.json();
    archivos.push(...lote);
    if (lote.length < 100) break;
  }
  return archivos;
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, PR_NUMBER: numero, PR_LOGIN: login } = process.env;
  if (!token || !repo || !numero || !login) {
    console.error('Faltan GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER o PR_LOGIN.');
    process.exit(2);
  }
  const raiz = dirname(fileURLToPath(import.meta.url));
  const { disenadores = {} } = JSON.parse(readFileSync(resolve(raiz, 'disenadores.json'), 'utf-8'));

  let archivos;
  try {
    archivos = await archivosDelPr({ token, repo, numero });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }

  const r = revisarArchivos({ archivos, login, permisos: disenadores });
  if (r.ok) {
    console.log(`OK (${login}): ${archivos.length} archivo(s), ${r.motivo}`);
    return;
  }
  console.error(`RECHAZADO (${login}): ${r.motivo}`);
  for (const f of r.fuera) console.error(`  fuera de lugar: ${f}`);
  console.error('Un fork solo puede tocar su carpeta (ver el LEEME.md de la plantilla). Saca esos cambios del PR.');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
