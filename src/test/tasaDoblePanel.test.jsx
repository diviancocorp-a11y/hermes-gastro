// Fase 2 de la doble moneda (Cochi): el panel.
// Servicio de tasas, hook, campo de precio doble y bloque "Tasa del dia".

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { chain } from './_chain.js';

const { mockFrom, mockGetUser } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockGetUser: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom, auth: { getUser: mockGetUser } } }));

import {
  elegirVigente, variacionPct, hoyEnZona, fetchTasas, fetchTasaVigente, cargarTasaManual,
} from '../services/platformTasas';
import useMonedaDoble from '../hooks/useMonedaDoble';
import PrecioDoble from '../components/admin/platform/PrecioDoble';
import ProductEditor from '../components/admin/platform/ProductEditor';
import TasaDelDia from '../components/admin/platform/TasaDelDia';

const T = '11111111-1111-1111-1111-111111111111';
const fila = (o) => ({ id: Math.random().toString(36), base_currency: 'USD', quote_currency: 'VES', created_at: '2026-11-14T10:00:00Z', ...o });

beforeEach(() => { vi.clearAllMocks(); });

describe('elegirVigente / variacionPct', () => {
  it('gana el dia mas nuevo', () => {
    const v = elegirVigente([fila({ rate: 470, effective_date: '2026-11-12', source: 'manual' }), fila({ rate: 480, effective_date: '2026-11-13', source: 'bcv' })]);
    expect(v.rate).toBe(480);
  });
  it('dentro del dia la manual le gana a la automatica', () => {
    const v = elegirVigente([
      fila({ rate: 480, effective_date: '2026-11-13', source: 'bcv', created_at: '2026-11-13T12:00:00Z' }),
      fila({ rate: 490, effective_date: '2026-11-13', source: 'manual', created_at: '2026-11-13T08:00:00Z' }),
    ]);
    expect(v.rate).toBe(490);
  });
  it('entre dos manuales del dia, la mas reciente', () => {
    const v = elegirVigente([
      fila({ rate: 1, effective_date: '2026-11-13', source: 'manual', created_at: '2026-11-13T08:00:00Z' }),
      fila({ rate: 2, effective_date: '2026-11-13', source: 'manual', created_at: '2026-11-13T09:00:00Z' }),
    ]);
    expect(v.rate).toBe(2);
  });
  it('sin filas devuelve null', () => { expect(elegirVigente([])).toBeNull(); expect(elegirVigente(null)).toBeNull(); });
  it('variacion contra la vigente', () => {
    expect(variacionPct(120, 100)).toBeCloseTo(20);
    expect(variacionPct(80, 100)).toBeCloseTo(-20);
    expect(variacionPct(80, 0)).toBeNull();
  });
  it('hoy se cuenta en la zona del negocio', () => {
    const ahora = new Date('2026-11-15T02:00:00Z'); // en Caracas (UTC-4) todavia es el 14
    expect(hoyEnZona('America/Caracas', ahora)).toBe('2026-11-14');
  });
});

describe('servicio de tasas', () => {
  it('fetchTasas filtra por tenant y par, mas nuevas primero', async () => {
    const c = chain({ data: [fila({ rate: 480, effective_date: '2026-11-14', source: 'bcv' })], error: null });
    mockFrom.mockReturnValue(c);
    const r = await fetchTasas(T, 'USD', 'VES', 5);
    expect(mockFrom).toHaveBeenCalledWith('exchange_rates');
    expect(c.eq).toHaveBeenCalledWith('tenant_id', T);
    expect(c.eq).toHaveBeenCalledWith('base_currency', 'USD');
    expect(c.eq).toHaveBeenCalledWith('quote_currency', 'VES');
    expect(c.limit).toHaveBeenCalledWith(5);
    expect(r).toHaveLength(1);
  });
  it('fetchTasas sin tenant no consulta', async () => {
    expect(await fetchTasas(null, 'USD', 'VES')).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('un error de lectura devuelve lista vacia', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'x' } }));
    expect(await fetchTasas(T, 'USD', 'VES')).toEqual([]);
  });
  it('fetchTasaVigente aplica la regla de la manual', async () => {
    mockFrom.mockReturnValue(chain({ data: [
      fila({ rate: 480, effective_date: '2026-11-14', source: 'bcv' }),
      fila({ rate: 495, effective_date: '2026-11-14', source: 'manual' }),
    ], error: null }));
    expect((await fetchTasaVigente(T, 'USD', 'VES')).rate).toBe(495);
  });
  it('cargarTasaManual inserta source manual, hoy en la zona y created_by', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const c = chain({ data: { id: 'n1', rate: 500 }, error: null });
    mockFrom.mockReturnValue(c);
    const r = await cargarTasaManual(T, { base: 'USD', quote: 'VES', rate: '500', zona: 'America/Caracas', ahora: new Date('2026-11-15T02:00:00Z') });
    expect(r.ok).toBe(true);
    expect(c.insert).toHaveBeenCalledWith({
      tenant_id: T, base_currency: 'USD', quote_currency: 'VES', rate: 500,
      effective_date: '2026-11-14', source: 'manual', created_by: 'u1',
    });
  });
  it('rechaza tasas invalidas y sesion ausente sin insertar', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    expect((await cargarTasaManual(T, { base: 'USD', quote: 'VES', rate: 0 })).ok).toBe(false);
    expect((await cargarTasaManual(T, { base: 'USD', quote: 'VES', rate: 'abc' })).ok).toBe(false);
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await cargarTasaManual(T, { base: 'USD', quote: 'VES', rate: 5 })).ok).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('un error de la base se informa sin filtrar el detalle', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'rls violation' } }));
    const r = await cargarTasaManual(T, { base: 'USD', quote: 'VES', rate: 5 });
    expect(r.ok).toBe(false);
    expect(r.error).not.toMatch(/rls/);
  });
});

describe('useMonedaDoble', () => {
  it('sin moneda secundaria: null y ninguna consulta', () => {
    const { result } = renderHook(() => useMonedaDoble({ id: T, currency: 'ARS', secondary_currency: null }));
    expect(result.current.monedaSecundaria).toBeNull();
    expect(result.current.tasa).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('con moneda secundaria trae la tasa vigente', async () => {
    mockFrom.mockReturnValue(chain({ data: [fila({ rate: '479.14', effective_date: hoyEnZona('America/Caracas'), source: 'bcv' })], error: null }));
    const { result } = renderHook(() => useMonedaDoble({ id: T, currency: 'USD', secondary_currency: 'VES', timezone: 'America/Caracas' }));
    await waitFor(() => expect(result.current.tasa).toBe(479.14));
    expect(result.current).toMatchObject({ monedaPrincipal: 'USD', monedaSecundaria: 'VES', vencida: false, origen: 'bcv' });
  });
  it('sin tasa cargada queda vencida', async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const { result } = renderHook(() => useMonedaDoble({ id: T, currency: 'USD', secondary_currency: 'VES' }));
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(result.current.tasa).toBeNull();
    expect(result.current.vencida).toBe(true);
  });
});

const estilo = {};
function Harness({ inicial = '', moneda }) {
  // El estado vive afuera, como en ProductEditor.
  const [v, setV] = useState(inicial);
  return <><PrecioDoble value={v} onChange={setV} moneda={moneda} inputStyle={estilo} labelStyle={estilo} /><output data-testid="guardado">{v}</output></>;
}
const conTasa = { monedaPrincipal: 'USD', monedaSecundaria: 'VES', tasa: 479.14, vencida: false, fecha: '2026-11-14' };

describe('PrecioDoble', () => {
  it('tipear en USD calcula los Bs.', () => {
    render(<Harness moneda={conTasa} />);
    fireEvent.change(screen.getByLabelText('Precio (USD)'), { target: { value: '9' } });
    expect(screen.getByLabelText('Precio (VES)').value).toBe('4312.26');
  });
  it('tipear en Bs. guarda el USD redondeado y NO salta lo que se tipea', () => {
    render(<Harness moneda={conTasa} />);
    const bs = screen.getByLabelText('Precio (VES)');
    fireEvent.change(bs, { target: { value: '1000' } });
    expect(screen.getByTestId('guardado').textContent).toBe('2.09'); // 1000 / 479.14
    expect(bs.value).toBe('1000');                                   // ida y vuelta daria 1001.4
    fireEvent.change(bs, { target: { value: '1000,' } });
    expect(bs.value).toBe('1000,');
    fireEvent.change(bs, { target: { value: '1000,5' } });
    expect(screen.getByTestId('guardado').textContent).toBe('2.09');
    fireEvent.change(bs, { target: { value: '10a' } });
    expect(bs.value).toBe('1000,5'); // no acepta letras
  });
  it('al salir del campo Bs. se vuelve a derivar del USD guardado', () => {
    render(<Harness moneda={conTasa} />);
    const bs = screen.getByLabelText('Precio (VES)');
    fireEvent.change(bs, { target: { value: '1000' } });
    fireEvent.blur(bs);
    expect(bs.value).toBe('1001.4');
  });
  it('vaciar el campo Bs. vacia el precio', () => {
    render(<Harness inicial="5" moneda={conTasa} />);
    fireEvent.change(screen.getByLabelText('Precio (VES)'), { target: { value: '' } });
    expect(screen.getByTestId('guardado').textContent).toBe('');
  });
  it('sin tasa: campo secundario deshabilitado, lo dice y el principal sigue andando', () => {
    render(<Harness moneda={{ ...conTasa, tasa: null, vencida: true, fecha: null }} />);
    expect(screen.getByLabelText('Precio (VES)').disabled).toBe(true);
    expect(screen.getByText(/Sin tasa cargada/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Precio (USD)'), { target: { value: '9' } });
    expect(screen.getByTestId('guardado').textContent).toBe('9');
  });
  it('tasa vencida: avisa pero sigue convirtiendo', () => {
    render(<Harness inicial="9" moneda={{ ...conTasa, vencida: true, fecha: '2026-11-01' }} />);
    expect(screen.getByText(/01\/11\/2026: puede estar desactualizada/)).toBeTruthy();
    expect(screen.getByLabelText('Precio (VES)').value).toBe('4312.26');
  });
  it('sin moneda secundaria renderiza solo el precio de siempre', () => {
    const { container } = render(<Harness moneda={{ monedaPrincipal: 'ARS', monedaSecundaria: null }} />);
    expect(container.querySelector('#pe-price-sec')).toBeNull();
    expect(screen.getByLabelText('Precio')).toBeTruthy();
  });
});

describe('ProductEditor sin moneda secundaria', () => {
  const props = { vertical: 'gastro', product: { id: 'p1', name: 'Pan', price: 100 }, onSave: vi.fn(), onCancel: vi.fn() };
  it('renderiza igual con moneda null que con moneda sin secundaria', () => {
    const a = render(<ProductEditor {...props} />).container.innerHTML;
    const b = render(<ProductEditor {...props} moneda={{ monedaPrincipal: 'ARS', monedaSecundaria: null, tasa: null }} />).container.innerHTML;
    expect(b).toBe(a);
    expect(a).not.toMatch(/pe-price-sec/);
  });
  it('con moneda secundaria suma el campo y guarda solo el precio principal', async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(<ProductEditor {...props} onSave={onSave} moneda={conTasa} />);
    fireEvent.change(screen.getByLabelText('Precio (VES)'), { target: { value: '479.14' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const guardado = onSave.mock.calls[0][0];
    expect(guardado.price).toBe('1');
    expect(guardado).not.toHaveProperty('price_secondary');
  });
});

describe('TasaDelDia', () => {
  const moneda = { monedaPrincipal: 'USD', monedaSecundaria: 'VES', tasa: 480, vencida: false, zona: 'America/Caracas' };
  const hoy = hoyEnZona('America/Caracas');
  const montar = () => {
    mockFrom.mockImplementation(() => chain({ data: [fila({ rate: 480, effective_date: hoy, source: 'bcv' })], error: null }));
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    return render(<TasaDelDia tenantId={T} moneda={moneda} showToast={vi.fn()} onCargada={vi.fn()} />);
  };

  it('muestra la vigente con su origen en palabras claras y el historial', async () => {
    montar();
    expect(await screen.findByText('BCV (oficial) · del ' + hoy.split('-').reverse().join('/'))).toBeTruthy();
    expect(screen.getByText('Últimas tasas')).toBeTruthy();
  });
  it('avisa si la tasa esta vencida', async () => {
    mockFrom.mockImplementation(() => chain({ data: [fila({ rate: 480, effective_date: '2020-01-01', source: 'dolarapi' })], error: null }));
    render(<TasaDelDia tenantId={T} moneda={moneda} showToast={vi.fn()} />);
    expect(await screen.findByText(/está vencida/)).toBeTruthy();
    expect(screen.getAllByText('Respaldo (dolarapi)').length).toBeGreaterThan(0);
  });
  it('sin ninguna tasa lo dice', async () => {
    mockFrom.mockImplementation(() => chain({ data: [], error: null }));
    render(<TasaDelDia tenantId={T} moneda={moneda} showToast={vi.fn()} />);
    expect(await screen.findByText(/Todavía no hay ninguna tasa/)).toBeTruthy();
  });
  it('carga manual: pide confirmacion, no guarda hasta confirmar', async () => {
    montar();
    await screen.findByText('Últimas tasas');
    const ins = mockFrom.mock.results.length;
    fireEvent.change(screen.getByLabelText(/Cargar una tasa a mano/), { target: { value: '490' } });
    fireEvent.click(screen.getByText('Revisar'));
    expect(screen.getByText(/Cambia/).textContent).toMatch(/\+2\.1%/);
    expect(mockFrom.mock.results.length).toBe(ins); // todavia no insertó
    fireEvent.click(screen.getByText('Confirmar y guardar'));
    await waitFor(() => expect(mockFrom.mock.results.some(r => r.value.insert.mock.calls.length)).toBe(true));
  });
  it('si la variacion pasa del 20% exige una confirmacion extra', async () => {
    montar();
    await screen.findByText('Últimas tasas');
    fireEvent.change(screen.getByLabelText(/Cargar una tasa a mano/), { target: { value: '700' } });
    fireEvent.click(screen.getByText('Revisar'));
    const guardar = screen.getByText('Confirmar y guardar');
    expect(guardar.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(guardar.disabled).toBe(false);
  });
  it('Corregir vuelve al campo sin guardar', async () => {
    montar();
    await screen.findByText('Últimas tasas');
    fireEvent.change(screen.getByLabelText(/Cargar una tasa a mano/), { target: { value: '490' } });
    fireEvent.click(screen.getByText('Revisar'));
    fireEvent.click(screen.getByText('Corregir'));
    expect(screen.getByLabelText(/Cargar una tasa a mano/).value).toBe('490');
  });
});
