// submit-order: entrada que no es texto responde 400, no 500 (Cochi fase 5).
// Antes `(body.customer || "").trim()` reventaba con un numero y caia al catch
// general como 500.
import { describe, it, expect, beforeEach } from 'vitest';
import { cargarHandler, crearEstado } from './helpers/submitOrderHarness.js';

const UUID = '00000000-0000-4000-8000-000000000001';
let estado, handler;

beforeEach(async () => {
  estado = crearEstado();
  estado.tablas.tenants = { id: 't1', settings: {}, timezone: 'America/Caracas' };
  estado.tablas.products = [{ id: UUID, name: 'Cafe', price: 100, category: 'Bebidas', active: true, option_groups: [] }];
  estado.tablas.product_ingredients = [];
  handler = await cargarHandler(estado);
});

const base = { tenant_slug: 'cochi', customer: 'Ana', phone: '1155', items: [{ recipeId: UUID, qty: 1 }] };
const llamar = (extra, crudo) => handler(new Request('http://x', {
  method: 'POST', body: crudo ?? JSON.stringify({ ...base, ...extra }),
}));

describe('submit-order: tipos de entrada', () => {
  it('el pedido normal sigue entrando', async () => {
    const r = await llamar({});
    expect(r.status).toBe(200);
    expect((await r.json()).total).toBe(100);
  });

  for (const [campo, valor] of [
    ['customer', 123], ['customer', {}], ['customer', ['x']], ['customer', true],
    ['phone', 1155123456], ['phone', {}],
    ['email', 42], ['note', 7], ['gift_note', {}], ['address', 99], ['tenant_slug', 5],
  ]) {
    it(`${campo} = ${JSON.stringify(valor)} -> 400 y no se crea nada`, async () => {
      const r = await llamar({ [campo]: valor });
      expect(r.status).toBe(400);
      expect((await r.json()).error).toBeTruthy();
      expect(estado.inserts).toHaveLength(0);
    });
  }

  it('customer null o vacio sigue siendo "faltan datos" (400, mismo mensaje)', async () => {
    for (const customer of [null, '', '   ']) {
      const r = await llamar({ customer });
      expect(r.status).toBe(400);
      expect((await r.json()).error).toMatch(/nombre y telefono son obligatorios/);
    }
  });

  it('cuerpo que no es un objeto JSON o item que no es objeto -> 400', async () => {
    expect((await llamar({}, 'no-es-json')).status).toBe(400);
    expect((await llamar({}, '[1,2]')).status).toBe(400);
    expect((await llamar({}, 'null')).status).toBe(400);
    expect((await llamar({ items: [null] })).status).toBe(400);
    expect((await llamar({ items: ['x'] })).status).toBe(400);
  });
});
