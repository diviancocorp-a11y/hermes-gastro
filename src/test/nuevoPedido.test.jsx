// Pedido cargado a mano desde Pedidos (WhatsApp, telefono, local): la puerta
// por rol, las opciones obligatorias, el cuerpo que va a submit-order y que un
// error del servidor no se coma lo cargado.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/platformAdmin', async (orig) => {
  const real = await orig();
  return { ...real, fetchOrderItems: vi.fn().mockResolvedValue([]) };
});

import OrdersPanel from '../components/admin/platform/OrdersPanel';
import NuevoPedido from '../components/admin/platform/NuevoPedido';

const PROTEINA = {
  id: 'g-prot', name: 'Elegí la proteína', type: 'single', required: true,
  choices: [{ id: 'pollo', label: 'Pollo a la brasa' }, { id: 'cochino', label: 'Cochino frito', price: 1.5 }],
};
const PRODUCTOS = [
  { id: 'b3', name: 'Bandeja 3 carnes', price: 12, category: 'Bandejas', active: true, option_groups: [PROTEINA] },
  { id: 'ma', name: 'Malta', price: 1.5, category: 'Bebidas', active: true, option_groups: [] },
  { id: 'te', name: 'Tequeños (6 u.)', price: 5, category: 'Para picar', active: true, option_groups: [] },
  { id: 'ar', name: 'Arepa reina', price: 5, category: 'Arepas', active: true, option_groups: [{
    id: 'g-salsa', name: 'Salsa', type: 'single', required: false,
    choices: [{ id: 'ajo', label: 'Ajo' }, { id: 'picante', label: 'Picante' }],
  }] },
];
const MONEDA = { monedaPrincipal: 'USD', monedaSecundaria: 'VES', tasa: 800, vencida: false, fecha: '2026-11-26' };

const base = {
  id: 'o1', created_at: '2026-11-16T15:00:00Z', status: 'new', customer_name: 'Ana', customer_phone: '1155',
  delivery: 'retiro', payment: 'efectivo', total: 9, subtotal: 9, discount: 0, tip_amount: 0, delivery_cost: 0,
};

function montar(extra = {}) {
  const props = {
    productos: PRODUCTOS, settings: { payment_accounts: [] }, moneda: MONEDA, tenantSlug: 'cochi',
    onConfirmar: vi.fn().mockResolvedValue({ ok: true, orderId: 'n1', total: 13.5 }),
    onCreado: vi.fn(), onCerrar: vi.fn(), ...extra,
  };
  render(<NuevoPedido {...props} />);
  return props;
}

const tocar = (nombre) => fireEvent.click(screen.getByRole('button', { name: nombre }));

function cargarBandejaYMalta() {
  tocar(/^Bandeja 3 carnes/);
  fireEvent.click(screen.getByLabelText('Pollo a la brasa'));
  tocar(/^Agregar/);
  tocar(/^Malta/);
}

function completarDatos({ telefono = '04141234567' } = {}) {
  tocar('Continuar');
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'María' } });
  fireEvent.change(screen.getByLabelText('Teléfono', { selector: 'input[type="tel"]' }), { target: { value: telefono } });
}

describe('OrdersPanel: boton Nuevo pedido', () => {
  const props = (roles) => ({
    orders: [], loading: false, onSetStatus: vi.fn(), showToast: vi.fn(), roles,
    onCrearPedidoManual: vi.fn(), productos: PRODUCTOS,
  });

  it('lo ve la caja y no la cocina', () => {
    const { unmount } = render(<OrdersPanel {...props(['cashier'])} />);
    expect(screen.getByRole('button', { name: /Nuevo pedido/ })).toBeTruthy();
    unmount();
    render(<OrdersPanel {...props(['kitchen'])} />);
    expect(screen.queryByRole('button', { name: /Nuevo pedido/ })).toBeNull();
  });

  it('sin onCrearPedidoManual el panel queda como antes', () => {
    render(<OrdersPanel orders={[]} loading={false} onSetStatus={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Nuevo pedido/ })).toBeNull();
  });

  it('la tarjeta dice de donde llego el pedido', () => {
    render(<OrdersPanel
      orders={[{ ...base, channel: 'manual_whatsapp' }, { ...base, id: 'o2', customer_name: 'Luis', channel: 'catalog' }]}
      loading={false} onSetStatus={vi.fn()}
    />);
    expect(screen.getByText('WhatsApp')).toBeTruthy();
    expect(screen.getByText('Catálogo')).toBeTruthy();
  });

  it('al cargar: toast con el nombre y el total, y recarga la lista', async () => {
    const showToast = vi.fn();
    const onPedidoCreado = vi.fn();
    const onCrearPedidoManual = vi.fn().mockResolvedValue({ ok: true, orderId: 'n1', total: 13.5 });
    render(<OrdersPanel
      orders={[]} loading={false} onSetStatus={vi.fn()} showToast={showToast} moneda={MONEDA}
      productos={PRODUCTOS} tenantSlug="cochi" onCrearPedidoManual={onCrearPedidoManual} onPedidoCreado={onPedidoCreado}
    />);
    tocar(/Nuevo pedido/);
    cargarBandejaYMalta();
    completarDatos();
    tocar(/Cargar pedido/);
    await waitFor(() => expect(onPedidoCreado).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith('Pedido de María cargado · $13.50');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('NuevoPedido', () => {
  it('un producto sin opciones se suma de un toque y se ve la cuenta', () => {
    montar();
    tocar(/^Malta/);
    expect(screen.getByText('1 producto')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Malta.*1 en el pedido/ })).toBeTruthy();
    expect(screen.getByText(/Bs\. 1\.200,00 con la tasa del día/)).toBeTruthy();
  });

  it('con opciones obligatorias no se suma sin elegir', () => {
    montar();
    tocar(/^Bandeja 3 carnes/);
    tocar(/^Agregar/);
    expect(screen.getByRole('alert').textContent).toMatch(/Elegí al menos 1 en “Elegí la proteína”/);
    tocar('Volver a la lista');
    expect(screen.getByText('Tocá un producto para sumarlo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' }).disabled).toBe(true);
  });

  it('confirmar con datos completos manda el cuerpo esperado y despues avisa y cierra', async () => {
    const p = montar();
    cargarBandejaYMalta();
    completarDatos();
    tocar(/Cargar pedido · \$13\.50/);
    await waitFor(() => expect(p.onCreado).toHaveBeenCalled());
    const cuerpo = p.onConfirmar.mock.calls[0][0];
    expect(cuerpo).toMatchObject({
      tenant_slug: 'cochi', origen: 'whatsapp', customer: 'María', phone: '04141234567',
      delivery: 'retiro', address: null, payment: 'efectivo', payment_account_id: null, note: null,
    });
    expect(cuerpo.items).toEqual([
      { recipeId: 'b3', qty: 1, selection: [{ groupId: 'g-prot', choiceId: 'pollo', qty: 1 }] },
      { recipeId: 'ma', qty: 1 },
    ]);
    expect(p.onCreado).toHaveBeenCalledWith({ ok: true, orderId: 'n1', total: 13.5 }, cuerpo);
    expect(p.onCerrar).toHaveBeenCalled();
  });

  it('dos toques rapidos en Cargar mandan un solo pedido', async () => {
    let resolver;
    const p = montar({ onConfirmar: vi.fn(() => new Promise((r) => { resolver = r; })) });
    tocar(/^Malta/);
    completarDatos();
    const boton = screen.getByRole('button', { name: /Cargar pedido/ });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(p.onConfirmar).toHaveBeenCalledTimes(1);
    resolver({ ok: true, orderId: 'n1', total: 1.5 });
    await waitFor(() => expect(p.onCreado).toHaveBeenCalledTimes(1));
  });

  it('un error del servidor se muestra y no cierra ni pierde lo cargado', async () => {
    const p = montar({ onConfirmar: vi.fn().mockResolvedValue({ ok: false, error: 'La Malta está agotada' }) });
    tocar(/^Malta/);
    completarDatos();
    tocar(/Cargar pedido/);
    expect((await screen.findByRole('alert')).textContent).toBe('La Malta está agotada');
    expect(p.onCreado).not.toHaveBeenCalled();
    expect(p.onCerrar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre').value).toBe('María');
    expect(screen.getByRole('button', { name: /Cargar pedido/ }).disabled).toBe(false);
  });

  it('sin telefono no llama al servidor y marca el campo', () => {
    const p = montar();
    tocar(/^Malta/);
    completarDatos({ telefono: '' });
    tocar(/Cargar pedido/);
    expect(p.onConfirmar).not.toHaveBeenCalled();
    expect(screen.getByText('Falta el teléfono.')).toBeTruthy();
    expect(screen.getByLabelText('Teléfono', { selector: 'input[type="tel"]' }).getAttribute('aria-invalid')).toBe('true');
  });

  it('cerrar con algo cargado pregunta antes de descartar', () => {
    const p = montar();
    tocar(/^Malta/);
    tocar('Cerrar');
    expect(p.onCerrar).not.toHaveBeenCalled();
    tocar('Seguir cargando');
    expect(screen.getByText('1 producto')).toBeTruthy();
    tocar('Cerrar');
    tocar('Descartar');
    expect(p.onCerrar).toHaveBeenCalled();
  });

  it('vacio, Escape cierra de una', () => {
    const p = montar();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onCerrar).toHaveBeenCalled();
  });
});

describe('NuevoPedido: correcciones de la auditoria', () => {
  it('con una categoria elegida, escribir busca en toda la carta', () => {
    montar();
    tocar('Bandejas');
    expect(screen.queryByRole('button', { name: /^Tequeños/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'tequ' } });
    expect(screen.getByRole('button', { name: /^Tequeños/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Todo' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Bandejas' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Escape en el buscador con texto solo borra el texto', () => {
    const p = montar();
    const buscar = screen.getByLabelText('Buscar producto');
    fireEvent.change(buscar, { target: { value: 'mal' } });
    buscar.focus();
    fireEvent.keyDown(buscar, { key: 'Escape' });
    expect(buscar.value).toBe('');
    expect(p.onCerrar).not.toHaveBeenCalled();
  });

  it('quitar una linea se dice "Quitar", se puede deshacer y el foco no se pierde', async () => {
    montar();
    tocar(/^Malta/);
    tocar(/^Tequeños/);
    tocar('Continuar');
    tocar('Quitar Malta');
    expect(screen.getByText('Quitaste Malta.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quitar Malta' })).toBeNull();
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Quitar Tequeños (6 u.)'));
    tocar('Deshacer');
    expect(screen.getByRole('button', { name: 'Quitar Malta' })).toBeTruthy();
    expect(screen.queryByText('Quitaste Malta.')).toBeNull();
  });

  it('en un grupo de eleccion unica opcional se puede volver a "ninguna"', () => {
    montar();
    tocar('Elegir opciones de Arepa reina');
    const ajo = screen.getByLabelText('Ajo');
    fireEvent.click(ajo);
    expect(ajo.checked).toBe(true);
    fireEvent.click(ajo);
    expect(ajo.checked).toBe(false);
  });

  // jsdom no dispara popstate en history.back(): el back con que se limpio la
  // pantalla del test anterior deja la ventana de "back propio" abierta hasta
  // que vence. En el navegador la cierra el popstate al llegar.
  const esperarVentana = () => new Promise((r) => { setTimeout(r, 450); });

  it('el atras del sistema pregunta si hay algo cargado', async () => {
    await esperarVentana();
    const p = montar();
    expect(window.history.state?.dicoNuevoPedido).toBe(true);
    tocar(/^Malta/);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(await screen.findByText(/Descartar este pedido/)).toBeTruthy();
    expect(p.onCerrar).not.toHaveBeenCalled();
    // Sigue abierta: la entrada vuelve a estar para el proximo atras.
    expect(window.history.state?.dicoNuevoPedido).toBe(true);
  });

  it('vacio, el atras del sistema cierra', async () => {
    await esperarVentana();
    const p = montar();
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    await waitFor(() => expect(p.onCerrar).toHaveBeenCalled());
  });

  it('en pesos los montos van enteros, como en la tarjeta', () => {
    montar({ moneda: { monedaPrincipal: 'ARS' }, productos: [{ id: 'x', name: 'Medialuna', price: 1250.5, category: 'A', active: true }] });
    expect(screen.getByText('$1.251')).toBeTruthy();
  });
});
