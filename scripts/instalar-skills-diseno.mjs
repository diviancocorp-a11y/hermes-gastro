#!/usr/bin/env node
// scripts/instalar-skills-diseno.mjs
//
// Instala en .claude/skills/ las dos skills de terceros que usa /diseno,
// fijadas a un commit:
//   - impeccable            (pbakaus/impeccable, Apache 2.0)
//   - design-taste-frontend (Leonxlnx/taste-skill, MIT)
//
// ── POR QUE NO VAN COMMITEADAS ──
// Son ~4 MB de terceros que envejecen solas. Commitearlas mezcla su historia
// con la nuestra y deja copias viejas regadas; aca se fija el commit y cada
// maquina (o sesion en la nube) las baja igual. Las carpetas destino estan en
// .gitignore.
//
// ── POR QUE NO `npx impeccable install` ──
// Baja el paquete de impeccable.style, que las sesiones en la nube no alcanzan.
// GitHub si. Mismo contenido: plugin/skills/impeccable del repo oficial.
//
// Para actualizar: cambiar el SHA, correr el script, probar /diseno y commitear
// solo este archivo.
//
// Uso: npm run skills:diseno

import { mkdtempSync, rmSync, cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SKILLS = [
  {
    nombre: 'impeccable',
    repo: 'https://github.com/pbakaus/impeccable',
    sha: '8a0e198da34ebc5b936a9d5975fb7a3b1cf353b7',
    carpeta: 'plugin/skills/impeccable',
  },
  {
    nombre: 'design-taste-frontend',
    repo: 'https://github.com/Leonxlnx/taste-skill',
    sha: 'f624f37a8c650b9cc550253104925efe4c8de246',
    carpeta: 'skills/taste-skill',
  },
];

function git(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr || r.error}`);
}

const temp = mkdtempSync(join(tmpdir(), 'skills-diseno-'));
try {
  for (const s of SKILLS) {
    const dir = join(temp, s.nombre);
    git(['init', '-q', dir]);
    git(['fetch', '-q', '--depth', '1', s.repo, s.sha], dir);
    git(['checkout', '-q', 'FETCH_HEAD'], dir);
    const origen = join(dir, s.carpeta);
    if (!existsSync(join(origen, 'SKILL.md'))) throw new Error(`${s.nombre}: no hay SKILL.md en ${s.carpeta}`);
    const destino = join(ROOT, '.claude', 'skills', s.nombre);
    rmSync(destino, { recursive: true, force: true });
    cpSync(origen, destino, { recursive: true });
    console.log(`✓ ${s.nombre} @ ${s.sha.slice(0, 7)} → .claude/skills/${s.nombre}`);
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
