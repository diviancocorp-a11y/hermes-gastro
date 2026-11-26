// submit-order: pedido cargado a mano desde el panel (WhatsApp, telefono, local).
// Con `origen` el request tiene que traer el token de un usuario con rol de
// caja en ESE tenant; sin `origen` el pedido es de catalogo como siempre.
import { describe, it, expect, beforeEach } from 'vitest';
import { cargarHandler, crearEstado } from './helpers/submitOrderHarness.js';

const UUID = '00000000-0000-4000-8000-000000000001';
let estado, handler;

beforeEach(async () => {
  estado = crearEstado();
  estado.tablas.tenants = { id: 't1', settings: {}, timezone: 'America/Caracas' };
  estado.tablas.products = [{ id: UUID, name: 'Cafe', price: 100, category: 'Bebidas', active: true, option_groups: [] }];
  estado.tablas.product_ingredients = [];
  estado.usuarios = { 'tok-staff': { id: 'u-staff' } };
  estado.tablas.tenant_members = [{ roles: ['cashier'] }];
  handler = await cargarHandler(estado);
});

const base = { tenant_slug: 'cochi', customer: 'Ana', phone: '1155', items: [{ recipeId: UUID, qty: 2 }] };
const llamar = (extra, token) => handler(new Request('http://x', {
  method: 'POST',
  headers: token ? { Authorization: `Bearer ${token}` } : {},
  body: JSON.stringify({ ...base, ...extra }),
}));
const pedidoInsertado = () => estado.inserts.find((i) => i.tabla === 'orders')?.filas;

describe('submit-order: pedido manual', () => {
  it('sin origen ni token: pedido de catalogo igual que hoy', async () => {
    const r = await llamar({});
    expect(r.status).toBe(200);
    expect((await r.json()).total).toBe(200);
    expect(pedidoInsertado()).toMatchObject({ channel: 'catalog', status: 'new' });
    // No se consulta ninguna membresia para un pedido de catalogo.
    expect(estado.filtros.some((f) => f.tabla === 'tenant_members')).toBe(false);
  });

  it('sin origen pero con token de staff: sigue siendo catalogo', async () => {
    const r = await llamar({}, 'tok-staff');
    expect(r.status).toBe(200);
    expect(pedidoInsertado().channel).toBe('catalog');
  });

  it('sin origen, mercadopago sigue naciendo pending_payment', async () => {
    await llamar({ payment: 'mercadopago' });
    expect(pedidoInsertado().status).toBe('pending_payment');
  });

  for (const origen of ['whatsapp', 'telefono', 'local']) {
    it(`token de staff + origen ${origen} -> channel manual_${origen}, status new`, async () => {
      const r = await llamar({ origen }, 'tok-staff');
      expect(r.status).toBe(200);
      expect((await r.json()).total).toBe(200);
      expect(pedidoInsertado()).toMatchObject({ channel: `manual_${origen}`, status: 'new', user_id: null });
    });
  }

  it('la membresia se busca en el tenant del pedido y para el usuario del token', async () => {
    await llamar({ origen: 'whatsapp' }, 'tok-staff');
    const filtros = estado.filtros.filter((f) => f.tabla === 'tenant_members');
    expect(filtros).toEqual(expect.arrayContaining([
      { tabla: 'tenant_members', col: 'tenant_id', val: 't1' },
      { tabla: 'tenant_members', col: 'user_id', val: 'u-staff' },
    ]));
  });

  it('owner y manager tambien pueden', async () => {
    for (const roles of [['owner'], ['manager'], ['attendant', 'cashier']]) {
      estado.inserts = [];
      estado.tablas.tenant_members = [{ roles }];
      const r = await llamar({ origen: 'telefono' }, 'tok-staff');
      expect(r.status).toBe(200);
    }
  });

  it('el user_id del cuerpo no se usa en un pedido manual', async () => {
    await llamar({ origen: 'local', user_id: '00000000-0000-4000-8000-0000000000aa' }, 'tok-staff');
    expect(pedidoInsertado().user_id).toBeNull();
  });

  it('origen con mercadopago igual nace new (lo cobra el local)', async () => {
    await llamar({ origen: 'whatsapp', payment: 'mercadopago' }, 'tok-staff');
    expect(pedidoInsertado().status).toBe('new');
  });

  it('origen sin token -> 403 y no se crea nada', async () => {
    const r = await llamar({ origen: 'whatsapp' });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/entrar al panel/);
    expect(estado.inserts).toHaveLength(0);
  });

  it('origen con token invalido (la key publishable de un invitado) -> 403', async () => {
    const r = await llamar({ origen: 'whatsapp' }, 'sb_publishable_xxx');
    expect(r.status).toBe(403);
    expect(estado.inserts).toHaveLength(0);
  });

  it('token de un usuario de otro tenant (sin membresia aca) -> 403', async () => {
    estado.tablas.tenant_members = [];
    const r = await llamar({ origen: 'whatsapp' }, 'tok-staff');
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/no puede cargar pedidos/);
    expect(estado.inserts).toHaveLength(0);
  });

  it('miembro sin rol de caja (cocina, mozo) -> 403', async () => {
    for (const roles of [['kitchen'], ['attendant'], ['marketer', 'accountant']]) {
      estado.tablas.tenant_members = [{ roles }];
      const r = await llamar({ origen: 'local' }, 'tok-staff');
      expect(r.status).toBe(403);
    }
    expect(estado.inserts).toHaveLength(0);
  });

  it('origen desconocido o de otro tipo -> 400', async () => {
    for (const origen of ['catalog', 'instagram', 5, {}]) {
      const r = await llamar({ origen }, 'tok-staff');
      expect(r.status).toBe(400);
    }
    expect(estado.inserts).toHaveLength(0);
  });

  it('un pedido manual no acepta codigo de mesa', async () => {
    const r = await llamar({ origen: 'local', table_code: '00000000-0000-4000-8000-0000000000bb' }, 'tok-staff');
    expect(r.status).toBe(400);
    expect(estado.inserts).toHaveLength(0);
  });
});
