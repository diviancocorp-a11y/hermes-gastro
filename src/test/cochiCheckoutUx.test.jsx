// Cochi, ajustes de la prueba del 17/nov: combo al agregar rapido, pedido por
// WhatsApp automatico (con respaldo y snapshot) y comprobante opcional.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../hooks/useTasaCatalogo', () => ({ default: () => ({ activa: false, tasa: null, cargando: false }) }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: async () => 'cochi' }));

import ComboAviso from '../catalog-pro/ComboAviso';
import OrderSentView from '../components/catalog/OrderSentView';
import { MonedaCatalogoProvider } from '../catalog-pro/MonedaCatalogo';
import { sugerenciaRapida } from '../lib/opcionesPedido';
import {
  comprobanteObligatorio, urlWhatsAppDePedido, guardarConfirmacion, leerConfirmacion, borrarConfirmacion,
} from '../lib/confirmacionPedido';

const AHORA = { dow: 3, hm: '12:00', fecha: '2026-11-18' };
const SHAWARMA = { id: 's', category: 'Shawarma' };
const PAPAS = { id: 'p', category: 'Extras', name: 'Papas fritas', sale_price: 3 };
const REGLA = {
  id: 'r1', when_categories: ['Shawarma'], add_product_id: 'p', special_price: 1, max_per_item: 1,
  days: [], start_time: null, end_time: null, start_date: null, end_date: null, active: true,
};
const precio = (p) => p.sale_price;

describe('sugerenciaRapida (combo al agregar de un toque)', () => {
  it('da la regla, el producto y el precio especial', () => {
    const s = sugerenciaRapida([REGLA], SHAWARMA, [SHAWARMA, PAPAS], AHORA, precio);
    expect(s).toMatchObject({ product: PAPAS, unitPrice: 1, qty: 1, normal: 3 });
    expect(s.rule.id).toBe('r1');
  });
  it('respeta max_per_item', () => {
    const s = sugerenciaRapida([{ ...REGLA, max_per_item: 2 }], SHAWARMA, [SHAWARMA, PAPAS], AHORA, precio);
    expect(s.qty).toBe(2);
  });
  it('el precio especial nunca supera al normal', () => {
    const s = sugerenciaRapida([{ ...REGLA, special_price: 9 }], SHAWARMA, [SHAWARMA, PAPAS], AHORA, precio);
    expect(s.unitPrice).toBe(3);
  });
  it('sin regla vigente, de otra categoria o con el sugerido agotado: nada', () => {
    expect(sugerenciaRapida([{ ...REGLA, end_date: '2026-01-01' }], SHAWARMA, [SHAWARMA, PAPAS], AHORA, precio)).toBeNull();
    expect(sugerenciaRapida([REGLA], { id: 'x', category: 'Bebidas' }, [PAPAS], AHORA, precio)).toBeNull();
    expect(sugerenciaRapida([REGLA], SHAWARMA, [SHAWARMA, PAPAS], AHORA, precio, new Set(['p']))).toBeNull();
    expect(sugerenciaRapida([], SHAWARMA, [SHAWARMA, PAPAS], AHORA, precio)).toBeNull();
  });
});

describe('ComboAviso', () => {
  const sug = { rule: REGLA, product: PAPAS, unitPrice: 1, qty: 1 };
  const fmt = (v) => `$${v}`;
  it('ofrece el combo y suma o descarta', () => {
    const onSumar = vi.fn(); const onCerrar = vi.fn();
    render(<ComboAviso sugerencia={sug} formato={fmt} onSumar={onSumar} onCerrar={onCerrar} />);
    expect(screen.getByTestId('combo-aviso').textContent).toMatch(/¿Lo hacés combo\?.*Papas fritas por \$1/);
    fireEvent.click(screen.getByText('Sumar'));
    expect(onSumar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('No, gracias'));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
  it('sin sugerencia no pinta nada', () => {
    const { container } = render(<ComboAviso sugerencia={null} formato={fmt} onSumar={() => {}} onCerrar={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('comprobante opcional atado al flag', () => {
  it('sin el flag la regla es la de hoy', () => {
    expect(comprobanteObligatorio(true, {})).toBe(true);
    expect(comprobanteObligatorio(true, { pedido_por_whatsapp: false })).toBe(true);
  });
  it('con el flag deja de ser obligatorio; sin cuenta manual nunca lo fue', () => {
    expect(comprobanteObligatorio(true, { pedido_por_whatsapp: true })).toBe(false);
    expect(comprobanteObligatorio(false, {})).toBe(false);
  });
});

describe('pedido por WhatsApp automatico', () => {
  const settings = { biz_name: 'Cochi', pedido_por_whatsapp: true, whatsapp: '584242246392' };
  const base = {
    settings, orderId: '0b1c2d3e-0000-4000-8000-000000000000', form: { name: 'Ana', phone: '1155', delivery: 'retiro' },
    items: [{ name: 'Shawarma', qty: 1 }], respuesta: { ok: true, total: 9 }, principal: 'USD',
  };
  beforeEach(() => { sessionStorage.clear(); });

  it('arma la URL de wa.me con el pedido', () => {
    expect(urlWhatsAppDePedido(base)).toMatch(/^https:\/\/wa\.me\/584242246392\?text=/);
  });
  it('sin flag, sin numero o sin respuesta: null', () => {
    expect(urlWhatsAppDePedido({ ...base, settings: { ...settings, pedido_por_whatsapp: false } })).toBeNull();
    expect(urlWhatsAppDePedido({ ...base, settings: { ...settings, whatsapp: '' } })).toBeNull();
    expect(urlWhatsAppDePedido({ ...base, respuesta: null })).toBeNull();
  });
  it('el snapshot vuelve igual y se borra', () => {
    guardarConfirmacion({ orderId: 'o1', respuesta: { total: 9 }, items: [], form: { name: 'Ana' } });
    expect(leerConfirmacion()).toMatchObject({ orderId: 'o1', form: { name: 'Ana' } });
    borrarConfirmacion();
    expect(leerConfirmacion()).toBeNull();
  });
  it('un snapshot vencido (mas de una hora) no se restaura', () => {
    sessionStorage.setItem('dico_confirmacion_pedido', JSON.stringify({ orderId: 'o1', t: Date.now() - 2 * 60 * 60 * 1000 }));
    expect(leerConfirmacion()).toBeNull();
  });
  it('la confirmacion trae el respaldo con su texto y el link', () => {
    render(<MonedaCatalogoProvider settings={{ currency: 'USD' }}>
      <OrderSentView orderId={base.orderId} form={base.form} settings={settings} respuesta={base.respuesta} items={base.items} onReset={() => {}} />
    </MonedaCatalogoProvider>);
    expect(screen.getByText(/¿No se abrió WhatsApp\?/)).toBeTruthy();
    expect(screen.getByText('Enviar el pedido por WhatsApp').getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
  });
});
