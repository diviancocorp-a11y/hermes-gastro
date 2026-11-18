// Cupones ampliados (Cochi fase 6, 0144). Handler real de submit-order con
// supabase falso + la logica pura del servidor y su espejo del checkout.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarHandler, crearEstado } from './helpers/submitOrderHarness.js';
import * as srv from '../../platform/functions/submit-order/cupones.ts';
import * as front from '../lib/cupones.js';

const UUID = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const HOY = () => new Date().toISOString().slice(0, 10);

async function montar({ tenant = {}, precio = 9.5, cupon, rpcs } = {}) {
  const estado = crearEstado();
  estado.tablas.tenants = { id: 't1', settings: {}, timezone: 'America/Caracas', currency: 'USD', secondary_currency: 'VES', ...tenant };
  estado.tablas.products = [{ id: UUID(1), name: 'Bandeja', price: precio, category: 'Bandejas', active: true, option_groups: [] }];
  estado.tablas.product_ingredients = [];
  estado.tablas.exchange_rates = [{ rate: 800, effective_date: HOY(), source: 'manual', created_at: new Date().toISOString() }];
  if (cupon !== undefined) estado.tablas.coupons = cupon;
  if (rpcs) Object.assign(estado.rpcRespuestas, rpcs);
  const handler = await cargarHandler(estado);
  const pedir = async (extra = {}) => {
    const res = await handler(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ tenant_slug: 'cochi', customer: 'Ana', phone: '0414-555', items: [{ recipeId: UUID(1), qty: 2 }], coupon_code: 'CUPON', ...extra }),
    }));
    return { status: res.status, body: await res.json() };
  };
  return { estado, pedir };
}
const orden = (estado) => estado.inserts.find(i => i.tabla === 'orders')?.filas;

// Un cupon de antes de la 0144: solo las columnas de la 0012.
const viejo = { id: UUID(7), discount_pct: 10, expires_at: null, email: null, used: false };

describe('regresion: cupon viejo (solo pct) igual que hoy', () => {
  it('USD: 10% de 19.00 = 1.90, con centavos', async () => {
    const { estado, pedir } = await montar({ cupon: viejo });
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, discount: 1.9, total: 17.1 });
    expect(orden(estado)).toMatchObject({ discount: 1.9, coupon_id: UUID(7) });
  });
  it('ARS: redondeo entero (10% de 210 = 21; 10% de 105 = 10.5 -> 11)', async () => {
    const { pedir } = await montar({ tenant: { currency: 'ARS', secondary_currency: null }, precio: 52.5, cupon: viejo });
    const r = await pedir();
    expect(r.body).toMatchObject({ ok: true, discount: 11, total: 94 });
    expect(r.body.fx).toBeUndefined();
  });
  it('con las columnas nuevas en sus defaults da exactamente lo mismo', async () => {
    const conDefaults = { ...viejo, discount_type: 'pct', discount_amount: 0, min_subtotal: null, max_uses: 1, uses_count: 0, starts_at: null };
    const a = await (await montar({ cupon: viejo })).pedir();
    const b = await (await montar({ cupon: conDefaults })).pedir();
    expect(b.body).toEqual(a.body);
  });
  it('un cupon viejo ya usado se rechaza (un solo uso, como siempre)', async () => {
    const { estado, pedir } = await montar({ cupon: { ...viejo, used: true } });
    const r = await pedir();
    expect(r.status).toBe(409);
    expect(r.body.cupon).toBe('agotado');
    expect(orden(estado)).toBeUndefined();
  });
  it('sin coupon_code no se consulta ni se reserva nada', async () => {
    const { estado, pedir } = await montar({ cupon: viejo });
    const r = await pedir({ coupon_code: null });
    expect(r.body).toMatchObject({ ok: true, discount: 0, total: 19 });
    expect(estado.rpcs.map(x => x.nombre)).not.toContain('reservar_cupon');
  });
});

describe('monto fijo', () => {
  const fijo = { ...viejo, discount_type: 'fixed', discount_pct: 0, discount_amount: 5, max_uses: null, uses_count: 3 };
  it('descuenta el monto en la moneda principal y congela Bs. sobre el total', async () => {
    const { estado, pedir } = await montar({ cupon: fijo });
    const r = await pedir();
    expect(r.body).toMatchObject({ ok: true, discount: 5, total: 14, fx: { rate: 800, total_secondary: 11200 } });
    expect(estado.rpcs.find(x => x.nombre === 'reservar_cupon').args).toEqual({ p_tenant_id: 't1', p_coupon_id: UUID(7), p_phone: '0414555' });
    expect(estado.updates.find(u => u.tabla === 'coupon_redemptions').valores).toEqual({ order_id: 'ord-1' });
  });
  it('nunca supera el subtotal de productos', async () => {
    const { pedir } = await montar({ cupon: { ...fijo, discount_amount: 50 } });
    const r = await pedir();
    expect(r.body).toMatchObject({ ok: true, discount: 19, total: 0 });
  });
});

describe('minimo, vigencia y usos', () => {
  it('por debajo del minimo: 409 con el monto en el mensaje', async () => {
    const { estado, pedir } = await montar({ cupon: { ...viejo, min_subtotal: 20 } });
    const r = await pedir();
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: 'Este cupón es para compras desde USD 20.00 en productos.', cupon: 'minimo' });
    expect(orden(estado)).toBeUndefined();
    expect(estado.rpcs.map(x => x.nombre)).not.toContain('reservar_cupon');
  });
  it('justo en el minimo aplica', async () => {
    const { pedir } = await montar({ cupon: { ...viejo, min_subtotal: 19 } });
    expect((await pedir()).body.ok).toBe(true);
  });
  it('todavia no vigente y vencido', async () => {
    const manana = new Date(Date.now() + 864e5).toISOString();
    const ayer = new Date(Date.now() - 864e5).toISOString();
    expect((await (await montar({ cupon: { ...viejo, starts_at: manana } })).pedir()).body.cupon).toBe('todavia_no');
    expect((await (await montar({ cupon: { ...viejo, expires_at: ayer } })).pedir()).body.cupon).toBe('vencido');
  });
  it('usos agotados vistos al leer: rechaza sin reservar', async () => {
    const { estado, pedir } = await montar({ cupon: { ...viejo, max_uses: 5, uses_count: 5 } });
    const r = await pedir();
    expect(r.body.cupon).toBe('agotado');
    expect(estado.rpcs.map(x => x.nombre)).not.toContain('reservar_cupon');
  });
  it('cupon inexistente: 409 en vez de cobrar sin descuento en silencio', async () => {
    const { pedir } = await montar({ cupon: null });
    const r = await pedir();
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: 'Ese cupón no existe.', cupon: 'no_existe' });
  });
});

describe('carrera por el ultimo uso', () => {
  it('dos pedidos con el ultimo uso: reservar_cupon da uno solo, el otro recibe 409', async () => {
    // Simula la fila tomada por FOR UPDATE: la primera reserva gana, la segunda ve el contador lleno.
    let usos = 4;
    const reservar = () => {
      if (usos >= 5) return { data: { ok: false, motivo: 'agotado' }, error: null };
      usos += 1;
      return { data: { ok: true, redemption_id: `red-${usos}` }, error: null };
    };
    const cupon = { ...viejo, max_uses: 5, uses_count: 4 };
    const a = await montar({ cupon, rpcs: { reservar_cupon: reservar } });
    const b = await montar({ cupon, rpcs: { reservar_cupon: reservar } });
    const [ra, rb] = await Promise.all([a.pedir(), b.pedir()]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    const perdedor = ra.status === 409 ? ra : rb;
    expect(perdedor.body.cupon).toBe('agotado');
    expect(usos).toBe(5);
  });
  it('limite por cliente lo informa reservar_cupon', async () => {
    const { pedir } = await montar({
      cupon: { ...viejo, max_uses: null, max_uses_per_phone: 1 },
      rpcs: { reservar_cupon: () => ({ data: { ok: false, motivo: 'limite_cliente' }, error: null }) },
    });
    const r = await pedir();
    expect(r.body).toEqual({ error: 'Ya usaste este cupón el máximo de veces permitido.', cupon: 'limite_cliente' });
  });
  it.each(['orders', 'order_items'])('si falla el insert de %s, el uso se devuelve', async (tabla) => {
    const { estado, pedir } = await montar({ cupon: viejo });
    estado.fallarInsert = tabla;
    const r = await pedir();
    expect(r.status).toBe(500);
    expect(estado.rpcs.filter(x => x.nombre === 'liberar_cupon')).toEqual([{ nombre: 'liberar_cupon', args: { p_redemption_id: 'red-1' } }]);
  });
});

describe('espejo del checkout', () => {
  const casos = [
    [viejo, 19, 'USD'], [viejo, 105, 'ARS'],
    [{ ...viejo, discount_type: 'fixed', discount_amount: 5 }, 19, 'USD'],
    [{ ...viejo, discount_type: 'fixed', discount_amount: 50 }, 19, 'USD'],
    [{ ...viejo, min_subtotal: 20 }, 19, 'USD'],
    [{ ...viejo, used: true }, 19, 'USD'],
    [{ ...viejo, max_uses: null, uses_count: 99 }, 19, 'USD'],
  ];
  it.each(casos)('evaluarCupon(%o, %s, %s) igual en front y servidor', (c, sub, moneda) => {
    const ahora = new Date('2026-11-18T12:00:00Z');
    expect(front.evaluarCupon(c, { subtotal: sub, moneda, ahora })).toEqual(srv.evaluarCupon(c, { subtotal: sub, moneda, ahora }));
  });
  it('mismos mensajes', () => {
    for (const m of ['no_existe', 'no_corresponde', 'todavia_no', 'vencido', 'agotado', 'limite_cliente', 'minimo', 'x']) {
      expect(front.mensajeCupon(m, 'US$ 20.00')).toBe(srv.mensajeCupon(m, 'US$ 20.00'));
    }
  });
});

describe('migracion 0144', () => {
  const sql = readFileSync('platform/migrations/0144_cupones_ampliados.sql', 'utf8');
  it('es aditiva y deja los cupones de hoy como estan (max_uses default 1)', () => {
    expect(sql).toMatch(/add column if not exists max_uses integer default 1/);
    expect(sql).toMatch(/add column if not exists discount_type text not null default 'pct'/);
    expect(sql).not.toMatch(/drop (column|table)/i);
  });
  it('reservar_cupon toma la fila con FOR UPDATE y solo la llama el service role', () => {
    const cuerpo = sql.slice(sql.indexOf('function public.reservar_cupon'), sql.indexOf('function public.liberar_cupon'));
    expect(cuerpo).toMatch(/for update/);
    expect(cuerpo.indexOf('for update')).toBeLessThan(cuerpo.indexOf('uses_count >= c.max_uses'));
    expect(sql).toMatch(/revoke all on function public\.reservar_cupon\(uuid, uuid, text\) from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on function public\.liberar_cupon\(uuid\) from public, anon, authenticated/);
  });
});
