// submit-order con doble moneda, envio a confirmar y cuentas con detalles
// (Cochi fase 5). Handler real con supabase falso: lo que importa es que la
// tasa sale del servidor, que un tenant sin secundaria inserta lo de siempre y
// que ARS redondea como siempre.
import { describe, it, expect, beforeEach } from 'vitest';
import { cargarHandler, crearEstado } from './helpers/submitOrderHarness.js';

const UUID = (n) => `00000000-0000-4000-8000-00000000000${n}`;
let estado, handler;

const HOY = () => new Date().toISOString().slice(0, 10);
async function montar({ tenant = {}, productos, tasas, coupon } = {}) {
  estado = crearEstado();
  estado.tablas.tenants = { id: 't1', settings: {}, timezone: 'America/Caracas', currency: 'USD', secondary_currency: 'VES', ...tenant };
  estado.tablas.products = productos || [{ id: UUID(1), name: 'Bandeja', price: 9.5, category: 'Bandejas', active: true, option_groups: [] }];
  estado.tablas.product_ingredients = [];
  if (tasas) estado.tablas.exchange_rates = tasas;
  if (coupon) estado.tablas.coupons = coupon;
  handler = await cargarHandler(estado);
}
const pedir = (extra = {}) => handler(new Request('http://x', {
  method: 'POST',
  body: JSON.stringify({ tenant_slug: 'cochi', customer: 'Ana', phone: '1155', items: [{ recipeId: UUID(1), qty: 1 }], ...extra }),
}));
const orden = () => estado.inserts.find(i => i.tabla === 'orders')?.filas;
const tasaHoy = (rate = 800) => [{ rate, effective_date: HOY(), source: 'manual', created_at: new Date().toISOString() }];

describe('tasa congelada', () => {
  it('sale del servidor: total_secondary = total x tasa, y el cliente no la puede mandar', async () => {
    await montar({ tasas: tasaHoy(800) });
    const r = await (await pedir({ fx_rate: 1, rate: 1, total_secondary: 1 })).json();
    expect(r).toMatchObject({ ok: true, total: 9.5, fx: { rate: 800, currency: 'VES', total_secondary: 7600, status: 'ok' } });
    expect(r.warnings).toBeUndefined();
    expect(orden()).toMatchObject({ fx_rate: 800, fx_currency: 'VES', total_secondary: 7600, total: 9.5 });
  });
  it('sin tasa: el pedido entra igual, sin fx_*, y avisa', async () => {
    await montar({ tasas: [] });
    const r = await (await pedir()).json();
    expect(r.ok).toBe(true);
    expect(r.fx).toBeNull();
    expect(r.warnings).toEqual([{ code: 'sin_tasa' }]);
    expect(Object.keys(orden())).not.toContain('fx_rate');
  });
  it('tasa vencida: se congela la vigente y avisa', async () => {
    await montar({ tasas: [{ rate: 700, effective_date: '2026-01-01', source: 'manual', created_at: '2026-01-01T00:00:00Z' }] });
    const r = await (await pedir()).json();
    expect(r.fx).toMatchObject({ rate: 700, status: 'vencida' });
    expect(r.warnings).toEqual([{ code: 'tasa_vencida' }]);
    expect(orden().total_secondary).toBe(6650);
  });
  it('fx_visto distinto de la del servidor: avisa y no se acepta', async () => {
    await montar({ tasas: tasaHoy(800) });
    const r = await (await pedir({ fx_visto: 790 })).json();
    expect(r.warnings).toEqual([{ code: 'tasa_cambio' }]);
    expect(orden().fx_rate).toBe(800);
    const igual = await (await pedir({ fx_visto: 800 })).json();
    expect(igual.warnings).toBeUndefined();
  });
  it('tenant sin moneda secundaria: mismo insert y misma respuesta de siempre', async () => {
    await montar({
      tenant: { currency: 'ARS', secondary_currency: null }, tasas: tasaHoy(800),
      productos: [{ id: UUID(1), name: 'Cafe', price: 100, category: 'Bebidas', active: true, option_groups: [] }],
    });
    const r = await (await pedir({ fx_visto: 5 })).json();
    expect(Object.keys(r).sort()).toEqual(['delivery_cost', 'discount', 'ok', 'orderId', 'review_status', 'risk_flags', 'tip', 'total']);
    const claves = Object.keys(orden());
    for (const k of ['fx_rate', 'fx_currency', 'total_secondary', 'delivery_pending']) expect(claves).not.toContain(k);
  });
});

describe('redondeo por moneda', () => {
  const cupon = { id: UUID(7), discount_pct: 10, expires_at: null, email: null };
  it('USD conserva los centavos del cupon y de la propina', async () => {
    await montar({ tasas: tasaHoy(800), coupon: cupon });
    const r = await (await pedir({ coupon_code: 'AMIGOS', tip_pct: 10 })).json();
    expect(r.discount).toBe(0.95);
    expect(r.tip).toBe(0.95);
    expect(r.total).toBe(9.5);
  });
  it('ARS redondea a entero como siempre', async () => {
    await montar({
      tenant: { currency: 'ARS', secondary_currency: null }, coupon: cupon,
      productos: [{ id: UUID(1), name: 'Pan', price: 105, category: 'Panes', active: true, option_groups: [] }],
    });
    const r = await (await pedir({ coupon_code: 'AMIGOS', tip_pct: 10 })).json();
    expect(r.discount).toBe(11); // 10.5 -> 11
    expect(r.tip).toBe(11);
    expect(r.total).toBe(105);
  });
});

describe('envio a confirmar', () => {
  it('con el flag: el costo del cliente se ignora, queda pendiente y el total es parcial', async () => {
    await montar({ tenant: { settings: { delivery_a_confirmar: true } }, tasas: tasaHoy(800) });
    const r = await (await pedir({ delivery: 'envio', delivery_cost: 3, address: 'Calle 1' })).json();
    expect(r).toMatchObject({ ok: true, total: 9.5, delivery_cost: 0, delivery_pending: true });
    expect(orden()).toMatchObject({ delivery_cost: 0, delivery_pending: true, total: 9.5, total_secondary: 7600 });
  });
  it('retiro con el flag: no queda pendiente', async () => {
    await montar({ tenant: { settings: { delivery_a_confirmar: true } }, tasas: tasaHoy(800) });
    const r = await (await pedir({ delivery: 'retiro' })).json();
    expect(r.delivery_pending).toBeUndefined();
    expect(Object.keys(orden())).not.toContain('delivery_pending');
  });
  it('con el flag pero superando el umbral de envio gratis: no queda pendiente', async () => {
    // subtotal 9.50 > 5: el envio es gratis, no hay nada que confirmar
    await montar({ tenant: { settings: { delivery_a_confirmar: true, free_delivery_over: 5 } }, tasas: tasaHoy(800) });
    const r = await (await pedir({ delivery: 'envio', delivery_cost: 0, address: 'Calle 1' })).json();
    expect(r.delivery_pending).toBeUndefined();
    expect(r).toMatchObject({ total: 9.5, delivery_cost: 0 });
    expect(Object.keys(orden())).not.toContain('delivery_pending');
  });
  it('con el flag y por debajo del umbral (o igual): queda pendiente', async () => {
    await montar({ tenant: { settings: { delivery_a_confirmar: true, free_delivery_over: 9.5 } }, tasas: tasaHoy(800) });
    expect((await (await pedir({ delivery: 'envio', address: 'Calle 1' })).json()).delivery_pending).toBe(true);
    await montar({ tenant: { settings: { delivery_a_confirmar: true, free_delivery_over: 0 } }, tasas: tasaHoy(800) });
    expect((await (await pedir({ delivery: 'envio', address: 'Calle 1' })).json()).delivery_pending).toBe(true);
  });
  it('el umbral se mide despues del cupon, como en el catalogo', async () => {
    // 9.50 - 10% = 8.55: supera 8 pero no 9
    await montar({ tenant: { settings: { delivery_a_confirmar: true, free_delivery_over: 9 } }, tasas: tasaHoy(800), coupon: { id: UUID(7), discount_pct: 10, expires_at: null, email: null } });
    expect((await (await pedir({ delivery: 'envio', address: 'Calle 1', coupon_code: 'AMIGOS' })).json()).delivery_pending).toBe(true);
  });
  it('sin el flag: usa el costo acotado de siempre', async () => {
    await montar({ tenant: { settings: { delivery_pricing: [{ max_km: null, cost: 5 }] } }, tasas: tasaHoy(800) });
    const r = await (await pedir({ delivery: 'envio', delivery_cost: 3.5, address: 'Calle 1' })).json();
    expect(r).toMatchObject({ delivery_cost: 3.5, total: 13 });
    expect(r.delivery_pending).toBeUndefined();
  });
});

describe('cuenta de pago con detalles', () => {
  const cuenta = (extra = {}) => ({ id: 'c1', label: 'Pago movil', banco: 'Banesco', titular: 'Cochi', alias: '', cbu: '', active: true, ...extra });
  it('el snapshot suma detalles y moneda validados; lo que no es texto se descarta', async () => {
    await montar({
      tenant: { settings: { payment_accounts: [cuenta({
        moneda: 'VES', detalles: [{ label: 'Cedula/RIF', value: ' J-123 ' }, { label: 'Telefono', value: '0414-1' }, { label: 1, value: 'x' }],
      })] } },
      tasas: tasaHoy(800),
    });
    await pedir({ payment_account_id: 'c1' });
    expect(orden().payment_account_snapshot).toMatchObject({
      id: 'c1', label: 'Pago movil', moneda: 'VES',
      detalles: [{ label: 'Cedula/RIF', value: 'J-123' }, { label: 'Telefono', value: '0414-1' }],
    });
  });
  it('una cuenta de antes inserta el mismo snapshot de siempre', async () => {
    await montar({ tenant: { settings: { payment_accounts: [cuenta()] } }, tasas: tasaHoy(800) });
    await pedir({ payment_account_id: 'c1' });
    expect(Object.keys(orden().payment_account_snapshot).sort()).toEqual(['alias', 'banco', 'cbu', 'id', 'label', 'titular']);
  });
});
