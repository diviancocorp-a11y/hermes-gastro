#!/usr/bin/env node
// scripts/hooks/orquestador.mjs
//
// Orquestador de skills de DICO: que Ricky no tenga que acordarse de cuando
// va cada skill. Dos hooks de Claude Code (registrados en .claude/settings.json),
// el mismo archivo con distinto argumento:
//
//   node scripts/hooks/orquestador.mjs ruteo     UserPromptSubmit
//   node scripts/hooks/orquestador.mjs candado   PreToolUse (Edit|Write|MultiEdit)
//
// RUTEO: lee el prompt y, con las reglas de orquestador-reglas.json (regex, sin
// LLM), inyecta SOLO la indicacion que aplica: UI -> /diseno y que skill
// estetica, base -> npm run mapa, cierre -> /cerrardico, arranque -> /dico,
// competencia -> analisis-competencia. Si no aplica ninguna, no dice nada.
//
// CANDADO: si el archivo a editar es de UI y en la sesion no se cargo la skill
// diseno, avisa (modo 'aviso') o rechaza la edicion (modo 'bloqueo'). Lo que se
// cargo sale del transcript (transcript_path), leido como JSON por linea y no
// con un grep: el texto "Launching skill: diseno" tambien aparece en cualquier
// comando que lo busque, y eso no es haber cargado la skill.
//
// Nunca puede romper un turno: cualquier error termina en salida vacia y exit 0.

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RUTA_REGLAS = join(HERE, 'orquestador-reglas.json');

export function cargarReglas(ruta = RUTA_REGLAS) {
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

// Minusculas y sin tildes: las reglas se escriben sin tildes y matchean igual
// si Ricky escribe la palabra con tilde o sin ella.
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function algunoMatchea(patrones, texto) {
  return (patrones || []).some((p) => new RegExp(p).test(texto));
}

function reglaMatchea(regla, texto) {
  const grupos = regla.todas || [];
  if (!grupos.length) return false;
  if (!grupos.every((g) => algunoMatchea(g, texto))) return false;
  return !algunoMatchea(regla.ninguna, texto);
}

// Devuelve las reglas que aplican al prompt, en el orden del JSON. De cada
// 'grupo' queda la primera; las de una skill ya cargada se saltean.
export function rutear(prompt, reglas, cargadas = new Set()) {
  const texto = normalizar(prompt);
  const gruposUsados = new Set();
  const salida = [];
  for (const regla of reglas.ruteo || []) {
    if (regla.grupo && gruposUsados.has(regla.grupo)) continue;
    if (!reglaMatchea(regla, texto)) continue;
    if (regla.grupo) gruposUsados.add(regla.grupo);
    if (regla.skill && cargadas.has(regla.skill)) continue;
    salida.push(regla);
  }
  return salida;
}

// 'plugin:diseno' cuenta como 'diseno' tambien.
function sumarSkill(set, nombre) {
  if (!nombre || typeof nombre !== 'string') return;
  const limpio = nombre.replace(/^\//, '').trim();
  if (!limpio) return;
  set.add(limpio);
  const corto = limpio.split(':').pop();
  if (corto) set.add(corto);
}

const RE_COMANDO = /<command-name>\/([\w:.-]+)<\/command-name>/g;

function comandosEnTexto(texto, set) {
  for (const m of String(texto).matchAll(RE_COMANDO)) sumarSkill(set, m[1]);
}

// Skills cargadas segun el transcript (un JSON por linea). Tres senales:
//  1. el asistente llamo a la tool Skill (tool_use name 'Skill', input.skill);
//  2. el resultado de esa tool (toolUseResult.commandName);
//  3. Ricky la escribio (<command-name>/diseno</command-name> en un mensaje suyo).
// Solo cuentan mensajes del asistente o de Ricky, nunca la salida de un comando.
export function skillsCargadasDeTexto(contenido) {
  const set = new Set();
  for (const linea of String(contenido).split('\n')) {
    if (!linea.includes('Skill') && !linea.includes('command-name') && !linea.includes('commandName')) continue;
    let entrada;
    try { entrada = JSON.parse(linea); } catch { continue; }
    const msg = entrada?.message;
    if (entrada?.type === 'assistant' && Array.isArray(msg?.content)) {
      for (const parte of msg.content) {
        if (parte?.type === 'tool_use' && parte.name === 'Skill') sumarSkill(set, parte.input?.skill);
      }
    }
    if (entrada?.type === 'user') {
      const r = entrada.toolUseResult;
      if (r && r.success !== false && typeof r.commandName === 'string') sumarSkill(set, r.commandName);
      if (typeof msg?.content === 'string') comandosEnTexto(msg.content, set);
      else if (Array.isArray(msg?.content)) {
        for (const parte of msg.content) {
          if (parte?.type === 'text') comandosEnTexto(parte.text, set);
        }
      }
    }
  }
  return set;
}

export function skillsCargadas(transcriptPath) {
  if (!transcriptPath) return new Set();
  try {
    return skillsCargadasDeTexto(readFileSync(transcriptPath, 'utf8'));
  } catch {
    return new Set();
  }
}

// Glob minimo: '**/' cualquier cantidad de carpetas, '*' dentro de una carpeta.
export function globARegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

// Ruta del archivo relativa al repo, con '/'. Un archivo dentro de otra
// worktree (.claude/worktrees/<nombre>/...) se mide relativo a esa worktree.
export function rutaRelativa(archivo, raiz) {
  if (!archivo) return null;
  const rel = relative(resolve(raiz || '.'), resolve(raiz || '.', archivo)).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..') || /^[a-zA-Z]:/.test(rel)) return null;
  return rel.replace(/^\.claude\/worktrees\/[^/]+\//, '');
}

export function esArchivoUi(rel, candado) {
  if (!rel) return false;
  const coincide = (globs) => (globs || []).some((g) => globARegex(g).test(rel));
  return coincide(candado.archivos) && !coincide(candado.excluir);
}

// Decide que devuelve el candado. null = no decir nada.
export function decidirCandado(entrada, reglas, cargadas, raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd) {
  const candado = reglas.candado;
  if (!candado) return null;
  if (entrada.agent_type && (candado.agentes_exentos || []).includes(entrada.agent_type)) return null;
  const rel = rutaRelativa(entrada.tool_input?.file_path, raiz);
  if (!esArchivoUi(rel, candado)) return null;
  if (cargadas.has(candado.skill)) return null;
  const texto = String(candado.texto).replace('{archivo}', rel);
  if (candado.modo === 'bloqueo') {
    return { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: texto };
  }
  return { hookEventName: 'PreToolUse', additionalContext: texto };
}

function leerEntrada() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function main(modo) {
  const entrada = leerEntrada();
  const reglas = cargarReglas();
  const cargadas = skillsCargadas(entrada.transcript_path);
  let salida = null;
  if (modo === 'ruteo') {
    const aplican = rutear(entrada.prompt, reglas, cargadas);
    if (aplican.length) {
      salida = {
        hookEventName: 'UserPromptSubmit',
        additionalContext: 'Orquestador DICO: ' + aplican.map((r) => r.texto).join(' | '),
      };
    }
  } else if (modo === 'candado') {
    salida = decidirCandado(entrada, reglas, cargadas);
  }
  if (salida) process.stdout.write(JSON.stringify({ hookSpecificOutput: salida }));
}

// En Windows la letra de la unidad puede llegar en minuscula o mayuscula.
const mismaRuta = (a, b) => process.platform === 'win32'
  ? resolve(a).toLowerCase() === resolve(b).toLowerCase()
  : resolve(a) === resolve(b);

if (process.argv[1] && mismaRuta(fileURLToPath(import.meta.url), process.argv[1])) {
  try {
    main(process.argv[2]);
  } catch {
    // Un aviso de menos no vale un turno roto.
  }
  process.exit(0);
}
