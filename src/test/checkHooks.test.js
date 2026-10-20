import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { erroresHooks } from '../../scripts/check-hooks.mjs';

const temporales = [];
afterEach(() => {
  for (const root of temporales.splice(0)) rmSync(root, { recursive: true, force: true });
});

function preparar(command) {
  const root = mkdtempSync(join(tmpdir(), 'check-hooks-'));
  temporales.push(root);
  mkdirSync(join(root, '.claude'));
  mkdirSync(join(root, 'scripts'));
  writeFileSync(join(root, '.claude/settings.json'), JSON.stringify({ hooks: {
    UserPromptSubmit: [{ hooks: [{ type: 'command', command }] }],
  } }));
  return root;
}

it('detecta el hook viejo borrado, incluso con argumentos', () => {
  const root = preparar('node "${CLAUDE_PROJECT_DIR}/scripts/linea-diseno.mjs" ruteo');
  expect(erroresHooks(root)).toEqual([
    'UserPromptSubmit: script de hook inexistente o ilegible: scripts/linea-diseno.mjs',
  ]);
});

it('acepta un script existente entre comillas y con argumentos', () => {
  const root = preparar('node "${CLAUDE_PROJECT_DIR}/scripts/valido.mjs" candado');
  writeFileSync(join(root, 'scripts/valido.mjs'), '');
  expect(erroresHooks(root)).toEqual([]);
});

it('rechaza un directorio usado como script', () => {
  const root = preparar('node ./scripts/directorio.mjs');
  mkdirSync(join(root, 'scripts/directorio.mjs'));
  expect(erroresHooks(root)).toHaveLength(1);
});

it('no intenta ejecutar comandos externos', () => {
  expect(erroresHooks(preparar('herramienta-global --version'))).toEqual([]);
});

it('no oculta settings JSON invalido', () => {
  const root = preparar('node scripts/no-existe.mjs');
  writeFileSync(join(root, '.claude/settings.json'), '{');
  expect(() => erroresHooks(root)).toThrow();
});
