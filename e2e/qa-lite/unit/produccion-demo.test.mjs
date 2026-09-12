// A donde manda cada plato la carga de revision de Produccion.
//
// Lo que se prueba es la unica regla del script que puede fallar en silencio:
// un producto mal ruteado no rompe nada, aparece en la pantalla equivocada, y
// eso se descubre mirando el KDS y creyendo que el KDS esta mal.
//
// La regla es pura y no toca la base: el cliente de Supabase del script se
// arma recien cuando se lo corre, justamente para poder importar esto.

import test from 'node:test';
import assert from 'node:assert/strict';
import { estacionDe } from '../../../scripts/qa-lite/cargar-produccion-demo.mjs';

test('el nombre le gana a la categoria: una provoleta es entrada y va a la parrilla', () => {
  assert.equal(estacionDe({ name: 'Provoleta a la parrilla', category: 'Entradas' }), 'parrilla');
  assert.equal(estacionDe({ name: 'Bife de chorizo (300g)', category: 'Principales' }), 'parrilla');
});

test('la guarnicion no decide: el pollo grillado se cocina, no se emplata en frio', () => {
  assert.equal(estacionDe({ name: 'Pollo grillado con ensalada', category: 'Principales' }), 'parrilla');
  assert.equal(estacionDe({ name: 'Ensalada cesar', category: 'Principales' }), 'frios');
});

test('lo de la barra no cae nunca en cocina: es el corte que separa las dos pantallas', () => {
  for (const name of ['Gaseosa linea Coca-Cola', 'Vino Malbec copa', 'Agua mineral 500ml']) {
    assert.equal(estacionDe({ name, category: 'Bebidas' }), 'barra');
  }
  assert.equal(estacionDe({ name: 'Cafe cortado', category: 'Cafeteria' }), 'cafeteria');
  assert.equal(estacionDe({ name: 'Submarino', category: 'Cafeteria' }), 'cafeteria');
});

test('la categoria manda cuando el nombre no dice nada', () => {
  assert.equal(estacionDe({ name: 'Ravioles de ricota y nuez', category: 'Principales' }), 'plancha');
  assert.equal(estacionDe({ name: 'Tiramisu', category: 'Postres' }), 'postres');
});

test('un producto desconocido cae en una estacion real, no se pierde', () => {
  // Sin estacion, el plato no aparece en NINGUNA pantalla de produccion. Para
  // una carga de revision es preferible una estacion discutible a un plato
  // invisible.
  assert.equal(estacionDe({ name: 'Algo raro', category: 'Sin categoria' }), 'frios');
  assert.equal(estacionDe({}), 'frios');
  assert.equal(estacionDe(null), 'frios');
});
