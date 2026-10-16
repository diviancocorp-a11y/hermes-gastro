#!/usr/bin/env node
// scripts/ci-esperar.mjs  ·  npm run ci:esperar [-- <sha>]
//
// Espera a que termine el CI (ci.yml) de un commit y lista sus jobs.
// Es la regla de CLAUDE.md "despues de cada push a main, mirar el CI" en una
// linea: el 16/oct se pushearon 12 commits sin mirarlo.
//
// Lee la API publica de GitHub (el repo es publico): sin token alcanza para
// 60 consultas por hora. Con GITHUB_TOKEN exportado usa ese limite. En la nube
// de Claude Code el fetch de Node no pasa por el proxy (que si autentica):
// correrlo con NODE_USE_ENV_PROXY=1.
//
// Sale con 0 si el CI dio verde, 1 si dio rojo (lista los jobs que fallaron)
// y 2 si no termino en el tiempo de espera o no se pudo consultar.
//
// Uso:
//   npm run ci:esperar                 # el HEAD local
//   npm run ci:esperar -- 6e055c8      # otro commit (sha corto o largo)

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = 'diviancocorp-a11y/hermes-gastro';
const WORKFLOW = 'ci.yml';
// 30s: sin token la API da 60 consultas por hora y una espera larga no puede
// gastarlas todas (el 16/oct dos vigilantes a 20s las agotaron).
const CADA_MS = 30_000;
const MAX_MS = 15 * 60_000;

/**
 * Que decir de un run de GitHub Actions y con que codigo salir.
 * @param {{ status: string, conclusion: string|null }} run
 * @param {{ name: string, conclusion: string|null }[]} jobs
 * @returns {{ terminado: boolean, codigo: number, lineas: string[] }}
 */
export function veredicto(run, jobs = []) {
  if (!run || run.status !== 'completed') {
    return { terminado: false, codigo: 2, lineas: [`· CI ${run ? run.status : 'sin arrancar'}`] };
  }
  const verde = run.conclusion === 'success';
  const lineas = [`${verde ? '✓' : '✗'} CI ${run.conclusion}`];
  for (const j of jobs) lineas.push(`  ${j.conclusion === 'success' ? '✓' : '✗'} ${j.name}: ${j.conclusion}`);
  return { terminado: true, codigo: verde ? 0 : 1, lineas };
}

// Un GITHUB_TOKEN que la API rechaza (401) no tiene que frenar nada: el repo
// es publico, asi que se sigue sin token. Paso en la nube de Claude Code el
// 16/oct.
let token = process.env.GITHUB_TOKEN || '';

class ErrorPermanente extends Error {}

async function api(ruta) {
  const url = `https://api.github.com/repos/${REPO}${ruta}`;
  const pedir = () => fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'hermes-gastro-ci-esperar',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  let res = await pedir();
  if (res.status === 401 && token) {
    token = '';
    res = await pedir();
  }
  if (res.ok) return res.json();
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    throw new ErrorPermanente('se agoto el limite de la API sin token (60/hora). '
      + 'Exportar GITHUB_TOKEN, o en la nube de Claude Code correr con NODE_USE_ENV_PROXY=1');
  }
  // 404, o 401/403 sin token, no se arreglan esperando.
  if ([401, 403, 404].includes(res.status)) throw new ErrorPermanente(`GitHub ${res.status} en ${ruta}`);
  throw new Error(`GitHub ${res.status} en ${ruta}`);
}

async function main() {
  const arg = process.argv[2];
  const sha = execSync(`git rev-parse ${arg || 'HEAD'}`, { encoding: 'utf8' }).trim();
  console.log(`Esperando el CI de ${sha.slice(0, 7)}...`);
  const hasta = Date.now() + MAX_MS;
  let ultimo = null;
  while (Date.now() < hasta) {
    try {
      const { workflow_runs: runs } = await api(`/actions/workflows/${WORKFLOW}/runs?head_sha=${sha}`);
      const run = runs?.[0];
      const jobs = run?.status === 'completed' ? (await api(`/actions/runs/${run.id}/jobs`)).jobs : [];
      const v = veredicto(run, jobs);
      if (v.terminado) {
        for (const l of v.lineas) console.log(l);
        if (run.html_url) console.log(`  ${run.html_url}`);
        return v.codigo;
      }
      if (v.lineas[0] !== ultimo) console.log(v.lineas[0]);
      ultimo = v.lineas[0];
    } catch (e) {
      if (e instanceof ErrorPermanente) {
        console.log(`✗ no se puede consultar el CI: ${e.message}`);
        return 2;
      }
      console.log(`· no se pudo consultar (${e.message}), reintento`);
    }
    await new Promise((r) => setTimeout(r, CADA_MS));
  }
  console.log(`✗ el CI no termino en ${MAX_MS / 60_000} minutos (ultimo estado: ${ultimo})`);
  return 2;
}

const ES_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (ES_MAIN) process.exitCode = await main();
