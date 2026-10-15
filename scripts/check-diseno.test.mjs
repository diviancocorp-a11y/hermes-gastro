// Tests del gate de diseno.
//
//   node --test scripts/check-diseno.test.mjs
//
// Lo que no puede fallar en silencio: que la deuda crezca sin avisar, o que
// --podar la agrande en vez de achicarla.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparar, podar } from './check-diseno.mjs';

const deuda = {
  'src/a.css': { 'side-tab': 2 },
  'src/b.jsx': { 'overused-font': 1 },
};

test('sin cambios no hay nuevos ni resueltos', () => {
  assert.deepEqual(comparar(deuda, deuda), { nuevos: [], resueltos: [] });
});

test('uno mas del mismo tipo en el mismo archivo cuenta como nuevo', () => {
  const actual = { ...deuda, 'src/a.css': { 'side-tab': 3 } };
  const { nuevos } = comparar(actual, deuda);
  assert.deepEqual(nuevos, [{ archivo: 'src/a.css', regla: 'side-tab', antes: 2, hoy: 3 }]);
});

test('un archivo que no estaba en la deuda cuenta como nuevo', () => {
  const actual = { ...deuda, 'src/c.css': { 'side-tab': 1 } };
  assert.equal(comparar(actual, deuda).nuevos.length, 1);
});

test('lo resuelto se reporta para sacarlo de la lista', () => {
  const actual = { 'src/a.css': { 'side-tab': 1 } };
  const { nuevos, resueltos } = comparar(actual, deuda);
  assert.equal(nuevos.length, 0);
  assert.equal(resueltos.length, 2);
});

test('podar baja las cuentas y borra lo que llego a cero', () => {
  const actual = { 'src/a.css': { 'side-tab': 1 } };
  assert.deepEqual(podar(actual, deuda), { 'src/a.css': { 'side-tab': 1 } });
});

test('podar nunca agranda la deuda', () => {
  const actual = { 'src/a.css': { 'side-tab': 5 }, 'src/c.css': { 'side-tab': 1 } };
  assert.deepEqual(podar(actual, deuda), { 'src/a.css': { 'side-tab': 2 } });
});
