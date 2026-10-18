// @no-jsx-check: los <command-name> del transcript son strings, no JSX.
// Orquestador de skills (scripts/hooks/orquestador.mjs): que cada prompt reciba
// solo la indicacion que le toca, y que el candado avise al editar UI sin /diseno.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  cargarReglas, rutear, normalizar, skillsCargadasDeTexto, globARegex,
  rutaRelativa, esArchivoUi, decidirCandado,
} from '../../scripts/hooks/orquestador.mjs';

const reglas = cargarReglas();
const SCRIPT = resolve('scripts/hooks/orquestador.mjs');
const RAIZ = resolve('.');

const ids = (prompt, cargadas) => rutear(prompt, reglas, cargadas).map((r) => r.id);

describe('reglas', () => {
  it('el JSON carga y cada patron es una regex valida', () => {
    for (const regla of reglas.ruteo) {
      expect(regla.id).toBeTruthy();
      expect(regla.texto).toBeTruthy();
      for (const p of [...regla.todas.flat(), ...(regla.ninguna || [])]) {
        expect(() => new RegExp(p), `${regla.id}: ${p}`).not.toThrow();
      }
    }
    expect(['aviso', 'bloqueo']).toContain(reglas.candado.modo);
  });

  it('normaliza tildes y mayusculas', () => {
    expect(normalizar('Diseñá la PANTALLA de Migración')).toBe('disena la pantalla de migracion');
  });
});

describe('ruteo: 14 prompts de ejemplo', () => {
  const casos = [
    ['Mejorá el espaciado de los botones del checkout', ['diseno-pulir']],
    ['El header del catálogo se ve feo en el celular', ['diseno-pulir']],
    ['Armemos una pantalla nueva de reservas para el admin', ['diseno-pantalla-nueva']],
    ['Quiero rediseñar la landing desde cero', ['diseno-pantalla-nueva']],
    ['Agregá una columna discount a la tabla orders', ['mapa-base']],
    ['La RPC cerrar_ticket_de_cocina devuelve null', ['mapa-base']],
    ['Cerremos la sesión por hoy', ['cierre']],
    ['Retomemos donde quedamos ayer con el edificio', ['arranque']],
    ['Analizá la web de este competidor: fudo.com', ['competencia']],
    ['Corré los tests y decime si pasa el CI', []],
    ['La tabla de pedidos se ve mal en la pantalla de stock', ['diseno-pulir', 'mapa-base']],
    ['/diseno pulí el botón de pagar', []],
    ['Corré la prueba de carga del catálogo con k6', ['carga']],
    ['¿Cuántos usuarios aguanta el sistema?', ['carga']],
  ];
  for (const [prompt, esperado] of casos) {
    it(prompt, () => expect(ids(prompt)).toEqual(esperado));
  }

  it('pantalla nueva elige design-taste-frontend; pulir elige impeccable', () => {
    const [nueva] = rutear('Creá una pantalla nueva de turnos', reglas);
    const [pulir] = rutear('Pulí los colores del modal', reglas);
    expect(nueva.texto).toMatch(/design-taste-frontend/);
    expect(pulir.texto).toMatch(/impeccable/);
  });

  it('si la skill ya se cargo en la sesion, no la repite', () => {
    expect(ids('Mejorá los botones', new Set(['diseno']))).toEqual([]);
    expect(ids('Cerremos la sesion', new Set(['cerrardico']))).toEqual([]);
  });

  it('"disenar" un sistema que no es UI no dispara /diseno', () => {
    expect(ids('Diseñar e implementar un orquestador de hooks')).toEqual([]);
  });
});

describe('skills cargadas segun el transcript', () => {
  const linea = (o) => JSON.stringify(o);
  const usoSkill = (skill) => linea({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill } }] } });

  it('la tool Skill, su resultado y el slash command de Ricky cuentan', () => {
    const t = [
      usoSkill('anthropic-skills:analisis-competencia'),
      linea({ type: 'user', message: { content: [{ type: 'tool_result', content: 'Launching skill: dico' }] }, toolUseResult: { success: true, commandName: 'dico' } }),
      linea({ type: 'user', message: { content: '<command-message>cerrardico</command-message>\n<command-name>/cerrardico</command-name>' } }),
    ].join('\n');
    const s = skillsCargadasDeTexto(t);
    expect(s.has('analisis-competencia')).toBe(true);
    expect(s.has('dico')).toBe(true);
    expect(s.has('cerrardico')).toBe(true);
    expect(s.has('diseno')).toBe(false);
  });

  // Un grep de 'Launching skill: diseno' daria verdadero en esta sesion misma:
  // el texto aparece en la salida de cualquier comando que lo busque.
  it('el texto en la salida de un comando no cuenta como skill cargada', () => {
    const t = [
      linea({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'grep "Launching skill: diseno" *.jsonl' } }] } }),
      linea({ type: 'user', message: { content: [{ type: 'tool_result', content: '"content":"Launching skill: diseno" <command-name>/diseno</command-name>' }] }, toolUseResult: { stdout: 'Launching skill: diseno' } }),
      'esto no es json Skill',
    ].join('\n');
    expect(skillsCargadasDeTexto(t).size).toBe(0);
  });
});

describe('candado', () => {
  const entrada = (archivo, extra = {}) => ({ cwd: RAIZ, tool_name: 'Edit', tool_input: { file_path: join(RAIZ, archivo) }, ...extra });
  const nada = new Set();

  it('globs', () => {
    expect(globARegex('src/**/*.jsx').test('src/a.jsx')).toBe(true);
    expect(globARegex('src/**/*.jsx').test('src/x/y/a.jsx')).toBe(true);
    expect(globARegex('src/**/*.jsx').test('src/a.js')).toBe(false);
    expect(globARegex('index.html').test('public/index.html')).toBe(false);
  });

  it('archivos de UI y los que no', () => {
    const c = reglas.candado;
    expect(esArchivoUi('src/catalog-pro/CheckoutScreen.jsx', c)).toBe(true);
    expect(esArchivoUi('src/styles/dico-tokens.css', c)).toBe(true);
    expect(esArchivoUi('index.html', c)).toBe(true);
    expect(esArchivoUi('src/lib/tenantHost.js', c)).toBe(false);
    expect(esArchivoUi('src/test/comandera.test.jsx', c)).toBe(false);
    expect(esArchivoUi('platform/migrations/0100_x.sql', c)).toBe(false);
  });

  it('una worktree se mide desde su propia raiz', () => {
    expect(rutaRelativa(join(RAIZ, '.claude/worktrees/otra/src/App.jsx'), RAIZ)).toBe('src/App.jsx');
    expect(rutaRelativa(resolve(RAIZ, '..', 'afuera.jsx'), RAIZ)).toBe(null);
  });

  it('editar un .jsx sin /diseno cargado avisa y no bloquea', () => {
    const r = decidirCandado(entrada('src/pages/PlatformLanding.jsx'), reglas, nada, RAIZ);
    expect(r.hookEventName).toBe('PreToolUse');
    expect(r.additionalContext).toMatch(/src\/pages\/PlatformLanding\.jsx/);
    expect(r.additionalContext).toMatch(/\/diseno/);
    expect(r.permissionDecision).toBeUndefined();
  });

  it('con /diseno cargado, o en un archivo que no es UI, no dice nada', () => {
    expect(decidirCandado(entrada('src/pages/PlatformLanding.jsx'), reglas, new Set(['diseno']), RAIZ)).toBe(null);
    expect(decidirCandado(entrada('src/lib/release.js'), reglas, nada, RAIZ)).toBe(null);
  });

  it('el subagente disenador esta exento', () => {
    expect(decidirCandado(entrada('src/App.jsx', { agent_type: 'disenador' }), reglas, nada, RAIZ)).toBe(null);
  });

  it('en modo bloqueo rechaza la edicion', () => {
    const bloqueo = { ...reglas, candado: { ...reglas.candado, modo: 'bloqueo' } };
    const r = decidirCandado(entrada('src/App.jsx'), bloqueo, nada, RAIZ);
    expect(r.permissionDecision).toBe('deny');
    expect(r.permissionDecisionReason).toMatch(/\/diseno/);
  });
});

describe('el hook de punta a punta', () => {
  const correr = (modo, stdin) => spawnSync(process.execPath, [SCRIPT, modo], {
    input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: RAIZ },
  });

  it('ruteo: inyecta la indicacion como additionalContext', () => {
    const r = correr('ruteo', JSON.stringify({ prompt: 'Mejorá los colores del footer' }));
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    expect(out.hookEventName).toBe('UserPromptSubmit');
    expect(out.additionalContext).toMatch(/impeccable/);
  });

  it('ruteo: un prompt que no toca nada no imprime nada', () => {
    const r = correr('ruteo', JSON.stringify({ prompt: 'gracias' }));
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('candado: lee el transcript real y deja de avisar cuando /diseno se cargo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orquestador-'));
    const transcript = join(dir, 't.jsonl');
    const base = { cwd: RAIZ, transcript_path: transcript, tool_name: 'Edit', tool_input: { file_path: join(RAIZ, 'src/App.jsx') } };
    writeFileSync(transcript, '');
    const antes = correr('candado', JSON.stringify(base));
    expect(JSON.parse(antes.stdout).hookSpecificOutput.additionalContext).toMatch(/src\/App\.jsx/);
    writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'diseno' } }] } }) + '\n');
    const despues = correr('candado', JSON.stringify(base));
    expect(despues.status).toBe(0);
    expect(despues.stdout).toBe('');
  });

  it('nunca rompe un turno: entrada rota o modo desconocido salen 0 y mudos', () => {
    for (const [modo, stdin] of [['ruteo', '{no es json'], ['candado', ''], ['otro', '{}']]) {
      const r = correr(modo, stdin);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('');
    }
  });
});
