// Opciones por producto y sugerencias al pedir (Cochi fase 4, 0135).
// Dos capas: la logica pura de platform/functions/submit-order/opciones.ts y el
// handler real de submit-order con un supabase falso (lo que importa: el precio
// lo calcula el servidor, el item viejo sigue andando, el texto de cocina).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarHandler, crearEstado } from './helpers/submitOrderHarness.js';
import {
  resolverOpciones, textoParaCocina, reglaVigente, aplicarSugerencias, ahoraEnZona,
} from '../../platform/functions/submit-order/opciones.ts';

const BANDEJA = [{
  id: 'proteina', name: 'Elige tenders o alitas', type: 'single', required: true,
  choices: [{ id: 'tenders', label: 'Tenders' }, { id: 'alitas', label: 'Alitas' }],
}];
const EXTRAS = [{
  id: 'extras', name: 'Extras', type: 'multiple', max: 2,
  choices: [
    { id: 'queso', label: 'Queso', price: 1.5, max_qty: 2 },
    { id: 'bacon', label: 'Bacon', price: 2 },
    { id: 'huevo', label: 'Huevo', price: 1 },
  ],
}];

describe('resolverOpciones', () => {
  it('single obligatorio: falta la eleccion', () => {
    expect(resolverOpciones(BANDEJA, []).ok).toBe(false);
  });
  it('elige una opcion valida', () => {
    const r = resolverOpciones(BANDEJA, [{ groupId: 'proteina', choiceId: 'alitas' }]);
    expect(r).toMatchObject({ ok: true, extras: 0 });
  });
  it('single no admite dos', () => {
    const r = resolverOpciones(BANDEJA, [
      { groupId: 'proteina', choiceId: 'alitas' }, { groupId: 'proteina', choiceId: 'tenders' },
    ]);
    expect(r.ok).toBe(false);
  });
  it('opcion que no existe en la base: error', () => {
    expect(resolverOpciones(BANDEJA, [{ groupId: 'proteina', choiceId: 'pizza' }]).ok).toBe(false);
    expect(resolverOpciones(BANDEJA, [{ groupId: 'otro', choiceId: 'x' }]).ok).toBe(false);
  });
  it('producto sin grupos rechaza opciones inventadas', () => {
    expect(resolverOpciones([], [{ groupId: 'a', choiceId: 'b' }]).ok).toBe(false);
    expect(resolverOpciones([], [])).toMatchObject({ ok: true, extras: 0 });
  });
  it('multiple suma precio x cantidad y respeta max y max_qty', () => {
    const r = resolverOpciones(EXTRAS, [
      { groupId: 'extras', choiceId: 'queso', qty: 2 }, { groupId: 'extras', choiceId: 'bacon' },
    ]);
    expect(r).toMatchObject({ ok: true, extras: 5 });
    expect(resolverOpciones(EXTRAS, [{ groupId: 'extras', choiceId: 'queso', qty: 3 }]).ok).toBe(false);
    const tres = ['queso', 'bacon', 'huevo'].map(c => ({ groupId: 'extras', choiceId: c }));
    expect(resolverOpciones(EXTRAS, tres).ok).toBe(false);
  });
  it('opcional sin eleccion es valido; cantidad cero o repetida no', () => {
    expect(resolverOpciones(EXTRAS, []).ok).toBe(true);
    expect(resolverOpciones(EXTRAS, [{ groupId: 'extras', choiceId: 'queso', qty: 0 }]).ok).toBe(false);
    const dup = [{ groupId: 'extras', choiceId: 'queso' }, { groupId: 'extras', choiceId: 'queso' }];
    expect(resolverOpciones(EXTRAS, dup).ok).toBe(false);
  });
  it('un precio que manda el cliente en la eleccion se ignora', () => {
    const r = resolverOpciones(EXTRAS, [{ groupId: 'extras', choiceId: 'bacon', price: 0 }]);
    expect(r.extras).toBe(2);
  });
});

describe('textoParaCocina', () => {
  it('opciones primero, nota del cliente despues, una linea', () => {
    const t = textoParaCocina(
      [{ label: 'Alitas', qty: 1 }, { label: 'Papas', qty: 2 }],
      'sin\ncebolla  por favor',
    );
    expect(t).toBe('Alitas, Papas x2 | Nota: sin cebolla por favor');
    expect(t).not.toMatch(/\n/);
  });
  it('solo nota, solo opciones o nada', () => {
    expect(textoParaCocina([], 'sin sal')).toBe('Nota: sin sal');
    expect(textoParaCocina([{ label: 'Alitas', qty: 1 }], '')).toBe('Alitas');
    expect(textoParaCocina([], undefined)).toBeNull();
  });
  it('la nota se corta a 140', () => {
    expect(textoParaCocina([], 'x'.repeat(300))).toBe(`Nota: ${'x'.repeat(140)}`);
  });
});

const REGLA = {
  id: 'r1', when_categories: ['Shawarmas'], add_product_id: 'papas', special_price: 1, max_per_item: 1,
  days: [], start_time: null, end_time: null, start_date: null, end_date: null, active: true,
};
const AHORA = { dow: 5, hm: '20:00', fecha: '2026-11-13' };

describe('sugerencias', () => {
  it('ventana por dia, hora (con cruce de medianoche) y fechas', () => {
    expect(reglaVigente({ ...REGLA, days: [0] }, AHORA)).toBe(false);
    expect(reglaVigente({ ...REGLA, days: [5] }, AHORA)).toBe(true);
    expect(reglaVigente({ ...REGLA, start_time: '22:00:00', end_time: '02:00:00' }, AHORA)).toBe(false);
    expect(reglaVigente({ ...REGLA, start_time: '18:00:00', end_time: '23:00:00' }, AHORA)).toBe(true);
    expect(reglaVigente({ ...REGLA, end_date: '2026-11-01' }, AHORA)).toBe(false);
    expect(reglaVigente({ ...REGLA, active: false }, AHORA)).toBe(false);
  });
  it('aplica con un shawarma elegible; sin elegibles, tope y regla ajena avisan', () => {
    const shaw = { productId: 's', categoria: 'Shawarmas', qty: 1 };
    const papas = (qty, suggestionId = 'r1', productId = 'papas') =>
      ({ productId, categoria: 'Extras', qty, suggestionId });
    expect(aplicarSugerencias([shaw, papas(1)], [REGLA], AHORA)[1].regla?.id).toBe('r1');
    expect(aplicarSugerencias([papas(1)], [REGLA], AHORA)[0])
      .toEqual({ regla: null, aviso: 'suggestion_limit' });
    expect(aplicarSugerencias([shaw, papas(2)], [REGLA], AHORA)[1].aviso).toBe('suggestion_limit');
    expect(aplicarSugerencias([shaw, papas(1, 'r1', 'otro')], [REGLA], AHORA)[1].aviso)
      .toBe('suggestion_invalid');
    expect(aplicarSugerencias([shaw, papas(1, 'zzz')], [REGLA], AHORA)[1].aviso)
      .toBe('suggestion_invalid');
  });
  it('ahoraEnZona devuelve dia y hora del local', () => {
    // jueves 12/nov 22:30 en Caracas (UTC-4)
    const a = ahoraEnZona('America/Caracas', new Date('2026-11-13T02:30:00Z'));
    expect(a).toEqual({ dow: 4, hm: '22:30', fecha: '2026-11-12' });
    expect(ahoraEnZona('Zona/Mala', new Date('2026-11-13T12:00:00Z')).hm).toBe('09:00');
  });
});

// ── Handler real con supabase falso (helpers/submitOrderHarness.js) ──────
const estado = crearEstado();
let handler;
beforeEach(async () => {
  Object.assign(estado, crearEstado());
  handler = await cargarHandler(estado);
});

const UUID = (n) => `00000000-0000-4000-8000-00000000000${n}`;
function pedido(items) {
  return handler(new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({ tenant_slug: 'cochi', customer: 'Ana', phone: '1155', items }),
  }));
}
function productos(lista) {
  estado.tablas.tenants = { id: 't1', settings: {}, timezone: 'America/Caracas' };
  estado.tablas.products = lista;
  estado.tablas.product_ingredients = [];
}
const itemsInsertados = () => estado.inserts.find(i => i.tabla === 'order_items')?.filas;

describe('submit-order con opciones y sugerencias', () => {
  it('item viejo {recipeId, qty}: mismo insert de siempre, sin claves nuevas', async () => {
    productos([{ id: UUID(1), name: 'Cafe', price: 100, category: 'Bebidas', active: true, option_groups: [] }]);
    const r = await pedido([{ recipeId: UUID(1), qty: 2, unitPrice: 1 }]);
    const body = await r.json();
    expect(body).toMatchObject({ ok: true, total: 200 });
    expect(body.warnings).toBeUndefined();
    const fila = itemsInsertados()[0];
    expect(fila).toMatchObject({ unit_price: 100, subtotal: 200, qty: 2 });
    const claves = Object.keys(fila);
    expect(claves).not.toContain('selection');
    expect(claves).not.toContain('note');
    expect(claves).not.toContain('suggestion_id');
  });

  it('el precio sale de la base: extras suman, el unitPrice del cliente se ignora, texto de cocina', async () => {
    productos([{ id: UUID(1), name: 'Burger', price: 10, category: 'Burgers', active: true, option_groups: EXTRAS }]);
    const r = await pedido([{
      recipeId: UUID(1), qty: 2, unitPrice: 0.01, note: 'sin cebolla',
      selection: [{ groupId: 'extras', choiceId: 'queso', qty: 2 }, { groupId: 'extras', choiceId: 'bacon' }],
    }]);
    expect((await r.json()).total).toBe(30); // (10 + 3 + 2) x 2
    const fila = itemsInsertados()[0];
    expect(fila.unit_price).toBe(15);
    expect(fila.note).toBe('Queso x2, Bacon | Nota: sin cebolla');
    expect(fila.selection).toHaveLength(2);
  });

  it('opcion invalida o faltante: 400 y no se crea nada', async () => {
    productos([{ id: UUID(1), name: 'Bandeja', price: 17, category: 'Bandejas', active: true, option_groups: BANDEJA }]);
    const sin = await pedido([{ recipeId: UUID(1), qty: 1 }]);
    expect(sin.status).toBe(400);
    const mala = await pedido([{ recipeId: UUID(1), qty: 1, selection: [{ groupId: 'proteina', choiceId: 'pizza' }] }]);
    expect(mala.status).toBe(400);
    expect(itemsInsertados()).toBeUndefined();
  });

  it('sugerencia valida: precio especial; vencida: precio normal y aviso, sin rechazar', async () => {
    productos([
      { id: UUID(1), name: 'Shawarma', price: 5, category: 'Shawarmas', active: true, option_groups: [] },
      { id: UUID(2), name: 'Papas', price: 1.5, category: 'Extras', active: true, option_groups: [] },
    ]);
    const regla = { ...REGLA, id: UUID(9), add_product_id: UUID(2) };
    estado.tablas.product_suggestions = [regla];
    const items = [{ recipeId: UUID(1), qty: 1 }, { recipeId: UUID(2), qty: 1, suggestionId: UUID(9) }];
    const ok = await (await pedido(items)).json();
    expect(ok.total).toBe(6); // 5 + papas a $1
    expect(ok.warnings).toBeUndefined();
    expect(itemsInsertados()[1]).toMatchObject({ unit_price: 1, suggestion_id: UUID(9) });

    estado.inserts = [];
    estado.tablas.product_suggestions = [{ ...regla, end_date: '2020-01-01' }];
    const vencida = await (await pedido(items)).json();
    expect(vencida.ok).toBe(true);
    expect(vencida.total).toBe(6.5); // papas a precio normal
    expect(vencida.warnings).toEqual([{ code: 'suggestion_expired', productId: UUID(2) }]);
    expect(Object.keys(itemsInsertados()[1])).not.toContain('suggestion_id');
  });

  it('un producto que no es del tenant no aparece: 400', async () => {
    productos([]);
    const r = await pedido([{ recipeId: UUID(1), qty: 1 }]);
    expect(r.status).toBe(400);
  });
});

describe('migracion 0135', () => {
  const sql = readFileSync('platform/migrations/0135_opciones_y_sugerencias_al_pedir.sql', 'utf8');
  it('la sugerencia no puede apuntar a un producto de otro tenant (trigger)', () => {
    expect(sql).toMatch(/before insert or update of add_product_id, tenant_id on public\.product_suggestions/);
    expect(sql).toMatch(/p\.id = new\.add_product_id and p\.tenant_id = new\.tenant_id/);
    expect(sql).toMatch(/revoke all on function private\.suggestion_product_same_tenant\(\) from public, anon/);
  });
});
