// La clave del owner de QA Lite no puede rotar sola.
//
// Rotaba en cada corrida de `bootstrapUser`, que corre en cada arranque del
// dev server: la sesion abierta en el navegador moria sin aviso y el error
// que se veia era «Invalid login credentials». Con dos worktrees trabajando
// contra la MISMA base local, el que levantaba ultimo echaba al otro.
//
// Lo que se prueba aca es la decision —de donde sale la clave—, sin tocar el
// disco ni la base: por eso `elegirClave` es pura y recibe lo que leyo quien
// llama.

import test from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { ARCHIVO_CLAVE, elegirClave } from '../../../platform/qa-lite/bootstrap-user.mjs';

test('con una clave guardada, la reusa: reiniciar el server no echa a nadie', () => {
  const r = elegirClave({ env: {}, guardada: 'Qa-guardada!' });
  assert.equal(r.clave, 'Qa-guardada!');
  assert.equal(r.guardar, false);
  assert.equal(r.origen, 'guardada');
});

test('sin nada guardado genera una, y avisa que hay que persistirla', () => {
  const r = elegirClave({ env: {}, guardada: null });
  assert.equal(r.origen, 'nueva');
  assert.equal(r.guardar, true);
  assert.match(r.clave, /^Qa-.+!$/);

  // Dos corridas sin guardar no pueden dar la misma: si el azar fuera fijo,
  // la clave seria adivinable desde el codigo.
  assert.notEqual(elegirClave({ env: {}, guardada: null }).clave, r.clave);
});

test('la variable de entorno pisa a la guardada, y no la sobreescribe', () => {
  const r = elegirClave({ env: { QA_LITE_PASS: 'Elegida-a-mano!' }, guardada: 'Qa-guardada!' });
  assert.equal(r.clave, 'Elegida-a-mano!');
  assert.equal(r.origen, 'entorno');
  // No se persiste: la del entorno manda mientras exista, y si desaparece
  // tiene que volver la que estaba, no quedar pisada.
  assert.equal(r.guardar, false);
});

test('una variable vacia o en blanco no cuenta como clave', () => {
  for (const vacia of ['', '   ']) {
    const r = elegirClave({ env: { QA_LITE_PASS: vacia }, guardada: 'Qa-guardada!' });
    assert.equal(r.clave, 'Qa-guardada!', `«${vacia}» se tomo como clave`);
  }
});

test('--rotar fuerza una nueva aunque haya guardada', () => {
  const r = elegirClave({ env: {}, guardada: 'Qa-guardada!', rotar: true });
  assert.equal(r.origen, 'nueva');
  assert.equal(r.guardar, true);
  assert.notEqual(r.clave, 'Qa-guardada!');
});

test('el archivo vive en el HOME, no en el repo', () => {
  // Cada worktree tiene su propio `.qa-lite/`. Guardarla ahi daria una clave
  // por carpeta contra una sola base: la rotacion volveria, disfrazada.
  assert.ok(ARCHIVO_CLAVE.startsWith(homedir()), `quedo fuera del home: ${ARCHIVO_CLAVE}`);
  assert.ok(!ARCHIVO_CLAVE.includes('hermes-gastro'), `quedo dentro del repo: ${ARCHIVO_CLAVE}`);
});
