// Tests del inventario de acciones.
//
//   node --test scripts/pantalla/acciones.test.mjs
//
// El extractor de botones necesito tres intentos. Los dos primeros fallaban
// con JSX real y el modo de fallar era silencioso: devolvia basura que parecia
// una lista de acciones. Estos casos fijan los tres.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoDeBotones, callbacksQueRecibe, comparar } from './acciones.mjs';

test('saca el texto de un boton simple', () => {
  assert.deepEqual(
    textoDeBotones('<button type="button">Agregar insumo</button>'),
    ['Agregar insumo'],
  );
});

test('no se corta en el > de una flecha adentro de onClick', () => {
  // Este es el caso que rompia `<button[^>]*>`: el `>` de la flecha cerraba
  // la etiqueta antes de tiempo y devolvia media hoja de estilos como texto.
  const codigo = `<button onClick={() => setOverlay({ type: "editIng" })} style={{ fontSize: 12 }}>Agregar insumo</button>`;
  assert.deepEqual(textoDeBotones(codigo), ['Agregar insumo']);
});

test('sobrevive a los apostrofes del castellano', () => {
  // El barrido de comillas moria aca: un apostrofe abre una comilla que nunca
  // cierra y el resto del archivo quedaba "adentro de un string".
  const codigo = `
    // no se puede d'aca en adelante
    <button>Registrar merma</button>
    <button>Archivar insumo</button>`;
  assert.deepEqual(textoDeBotones(codigo), ['Registrar merma', 'Archivar insumo']);
});

test('se queda con el rotulo y descarta el icono', () => {
  const codigo = '<button><svg viewBox="0 0 24 24"><path d="M1 1"/></svg>Volver</button>';
  assert.deepEqual(textoDeBotones(codigo), ['Volver']);
});

test('ignora el boton cuyo rotulo entero es una expresion', () => {
  // No tiene texto fijo: queda listado por su callback, no por su texto.
  assert.deepEqual(textoDeBotones('<button>{etiqueta}</button>'), []);
});

test('no repite el mismo rotulo dos veces', () => {
  const codigo = '<button>Guardar</button><button>Guardar</button>';
  assert.deepEqual(textoDeBotones(codigo), ['Guardar']);
});

test('lista los callbacks de la firma y no las demas props', () => {
  const codigo = 'export default function Panel({ insumos, onGuardar, onCerrar, titulo = "x" }) {';
  assert.deepEqual(callbacksQueRecibe(codigo), ['onGuardar', 'onCerrar']);
});

test('comparar marca lo que estaba y no esta', () => {
  const lineas = [];
  const faltan = comparar(
    { botones: ['Agregar insumo', 'Merma'], callbacks: [], aperturas: [], escrituras: [] },
    { botones: ['Merma'], callbacks: [], aperturas: [], escrituras: [] },
    (l) => lineas.push(l),
  );
  assert.equal(faltan, 1);
  assert.ok(lineas.some((l) => l.includes('Agregar insumo')));
});

test('comparar no se confunde por mayusculas ni por un simbolo adelante', () => {
  // "✓ Agregar insumo" y "Agregar insumo" son la misma accion.
  const faltan = comparar(
    { botones: ['✓ Agregar insumo'], callbacks: [], aperturas: [], escrituras: [] },
    { botones: ['agregar insumo'], callbacks: [], aperturas: [], escrituras: [] },
    () => {},
  );
  assert.equal(faltan, 0);
});
