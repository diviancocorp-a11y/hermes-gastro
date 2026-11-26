// Logica pura del pedido cargado a mano (src/lib/pedidoManual.js).
import { describe, it, expect } from 'vitest';
import {
  etiquetaOrigen, puedeCargarPedidoManual, armarLinea, agregarLinea, cambiarCantidad,
  totalCarrito, validarPedidoManual, cuerpoPedidoManual, cuentasDeCobro, filtrarProductos,
  productosCargables, firmaPedidoManual,
} from '../lib/pedidoManual';

const pizza = {
  id: 'p1', name: 'Pizza', price: 10, category: 'Pizzas', active: true,
  option_groups: [{
    id: 'g1', name: 'Tamaño', type: 'single', required: true,
    choices: [{ id: 'c1', label: 'Chica', price: 0 }, { id: 'c2', label: 'Grande', price: 4 }],
  }],
};
const cafe = { id: 'p2', name: 'Café', price: 2.5, category: 'Bebidas', active: true, option_groups: [] };

describe('pedidoManual', () => {
  it('etiqueta del origen', () => {
    expect(etiquetaOrigen('manual_whatsapp')).toBe('WhatsApp');
    expect(etiquetaOrigen('manual_telefono')).toBe('Teléfono');
    expect(etiquetaOrigen('manual_local')).toBe('Local');
    expect(etiquetaOrigen('catalog')).toBe('Catálogo');
    expect(etiquetaOrigen(null)).toBe('Catálogo');
    expect(etiquetaOrigen('manual_fax')).toBeNull();
    expect(etiquetaOrigen('telegram')).toBeNull();
  });

  it('roles que cargan pedidos: owner, manager y cashier', () => {
    expect(puedeCargarPedidoManual(['owner'])).toBe(true);
    expect(puedeCargarPedidoManual(['attendant', 'cashier'])).toBe(true);
    expect(puedeCargarPedidoManual(['kitchen'])).toBe(false);
    expect(puedeCargarPedidoManual([])).toBe(false);
  });

  it('una opcion obligatoria sin elegir no arma la linea (misma regla que el servidor)', () => {
    expect(armarLinea(pizza, []).ok).toBe(false);
    const r = armarLinea(pizza, [{ groupId: 'g1', choiceId: 'c2', qty: 1 }]);
    expect(r.ok).toBe(true);
    expect(r.linea).toMatchObject({ unitPrice: 14, detalle: 'Grande', qty: 1 });
  });

  it('la misma eleccion suma cantidad; otra eleccion es otra linea', () => {
    const grande = armarLinea(pizza, [{ groupId: 'g1', choiceId: 'c2', qty: 1 }]).linea;
    const chica = armarLinea(pizza, [{ groupId: 'g1', choiceId: 'c1', qty: 1 }]).linea;
    let c = agregarLinea([], grande);
    c = agregarLinea(c, grande);
    c = agregarLinea(c, chica);
    expect(c).toHaveLength(2);
    expect(c[0].qty).toBe(2);
    expect(totalCarrito(c)).toBe(38);
    c = cambiarCantidad(c, grande.key, 0);
    expect(c).toHaveLength(1);
  });

  it('total con decimales sin error binario', () => {
    const l = armarLinea(cafe, []).linea;
    expect(totalCarrito(cambiarCantidad([l], l.key, 3))).toBe(7.5);
  });

  it('valida nombre, telefono y direccion con envio', () => {
    const l = armarLinea(cafe, []).linea;
    expect(validarPedidoManual({ carrito: [], cliente: '', telefono: '', entrega: 'envio', direccion: '' }))
      .toEqual(expect.objectContaining({ carrito: expect.any(String), cliente: expect.any(String), telefono: expect.any(String), direccion: expect.any(String) }));
    expect(validarPedidoManual({ carrito: [l], cliente: 'Ana', telefono: '0414-1234567', entrega: 'retiro' })).toEqual({});
    expect(validarPedidoManual({ carrito: [l], cliente: 'Ana', telefono: '123', entrega: 'retiro' }).telefono).toBeTruthy();
  });

  it('cuerpo para submit-order: cuenta -> transferencia, retiro sin direccion', () => {
    const l = armarLinea(pizza, [{ groupId: 'g1', choiceId: 'c2', qty: 1 }]).linea;
    const c = cuerpoPedidoManual({
      tenantSlug: 'cochi', carrito: [l], cliente: ' Ana ', telefono: '0414 123 4567',
      entrega: 'retiro', direccion: 'no va', pago: 'acc-1', origen: 'whatsapp', nota: '',
    });
    expect(c).toEqual({
      tenant_slug: 'cochi', origen: 'whatsapp', customer: 'Ana', phone: '0414 123 4567',
      delivery: 'retiro', address: null, payment: 'transferencia', payment_account_id: 'acc-1', note: null,
      items: [{ recipeId: 'p1', qty: 1, selection: [{ groupId: 'g1', choiceId: 'c2', qty: 1 }] }],
    });
    const ef = cuerpoPedidoManual({ tenantSlug: 'cochi', carrito: [armarLinea(cafe, []).linea], cliente: 'A', telefono: '1', entrega: 'envio', direccion: 'Calle 1', pago: 'efectivo', origen: 'local', nota: 'sin azucar' });
    expect(ef).toMatchObject({ payment: 'efectivo', payment_account_id: null, address: 'Calle 1', note: 'sin azucar' });
    expect(ef.items[0]).toEqual({ recipeId: 'p2', qty: 1 });
    expect(firmaPedidoManual(ef)).toEqual(firmaPedidoManual({ ...ef }));
  });

  it('cuentas de cobro: activas y no de proveedores', () => {
    const s = { payment_accounts: [
      { id: 'a', label: 'Pago movil' }, { id: 'b', active: false }, { id: 'c', scope: 'proveedores' }, { id: 'd', scope: 'clientes' },
    ] };
    expect(cuentasDeCobro(s).map((a) => a.id)).toEqual(['a', 'd']);
    expect(cuentasDeCobro(null)).toEqual([]);
  });

  it('buscador sin tildes y por categoria; fuera inactivos y servicios', () => {
    const ps = productosCargables([pizza, cafe, { ...cafe, id: 'x', active: false }, { id: 's', name: 'Corte', type: 'service', active: true }]);
    expect(ps.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(filtrarProductos(ps, { texto: 'cafe' }).map((p) => p.id)).toEqual(['p2']);
    expect(filtrarProductos(ps, { categoria: 'Pizzas' }).map((p) => p.id)).toEqual(['p1']);
  });
});
