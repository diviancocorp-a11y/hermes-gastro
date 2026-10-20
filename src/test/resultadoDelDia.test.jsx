import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../components/ConfirmSlideProvider', () => ({
  useConfirm: () => async () => false,
}));

import ResultadoDelDia from '../components/admin/platform/ResultadoDelDia';
import VentasPanel from '../components/admin/platform/VentasPanel';

const SUCURSAL = { id: 'b-1', name: 'Casa central', timezone: 'America/Argentina/Buenos_Aires' };

// El escenario de platform/tests/resultado_del_dia.sql: una linea de cada y
// ganancia negativa (mismos numeros que platformResultado.test.js).
const DIA_COMPLETO = {
  dia: '2026-10-15', ventas: 15000, descuentos: 1000, costo_mercaderia: 3800,
  lineas_sin_costo: 1, tickets: 2, nomina: 8000, horas: 4, merma: 1300,
  gastos_del_dia: 2000, gastos_fijos: 1000, ganancia_neta: -2100,
};

const ok = (data) => ({ ok: true, data });

function cargarQueDevuelve(porDia) {
  return vi.fn(async (_branch, dia) => ok({ ...DIA_COMPLETO, ...porDia(dia), dia: dia || DIA_COMPLETO.dia }));
}

// Crazy Miga el 13/oct/2026, tal cual lo devolvio la base: el costo trae
// centavos y la cuenta tiene que poder sumarse a ojo, sin redondear a pesos.
const CRAZY_MIGA_13_OCT = {
  dia: '2026-10-13', ventas: 151000, descuentos: 0, costo_mercaderia: 43574.6,
  lineas_sin_costo: 0, tickets: 3, nomina: 0, horas: 0, merma: 0,
  gastos_del_dia: 0, gastos_fijos: 0, ganancia_neta: 107425.4,
};

describe('ResultadoDelDia', () => {
  it('muestra la ganancia neta y todas las lineas de la cuenta', async () => {
    const cargar = vi.fn(async () => ok(DIA_COMPLETO));
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={cargar} />);

    expect(await screen.findByText('Ganancia neta · el día dio pérdida')).toBeTruthy();
    expect(cargar).toHaveBeenCalledWith('b-1', null);

    const tabla = screen.getByRole('table', { name: 'La cuenta del día' });
    for (const label of ['Ventas', 'Descuentos', 'Costo de lo vendido', 'Nómina', 'Merma', 'Gastos del día', 'Gastos fijos']) {
      expect(within(tabla).getByRole('rowheader', { name: new RegExp(`^${label}`) })).toBeTruthy();
    }
    expect(within(tabla).getByText('$15.000')).toBeTruthy();
    expect(within(tabla).getByText('−$3.800')).toBeTruthy();
    expect(within(tabla).getByText('4 h fichadas')).toBeTruthy();
    // La cifra protagonista y el total de la cuenta son el mismo numero.
    expect(screen.getAllByText('−$2.100')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeTruthy();
    // Esta cuenta cierra: no hay aviso de descuadre.
    expect(screen.queryByText(/no suman el total/)).toBeNull();
  });

  it('si una linea trae centavos, toda la cuenta va con 2 decimales y las lineas en 0 se ven', async () => {
    const { container } = render(
      <ResultadoDelDia sucursal={SUCURSAL} cargar={vi.fn(async () => ok(CRAZY_MIGA_13_OCT))} />
    );

    expect(await screen.findByText('71,1 % sobre ventas · 3 tickets')).toBeTruthy();
    expect(screen.getAllByText('$107.425,40')).toHaveLength(2);
    expect(screen.getByText('$151.000,00')).toBeTruthy();
    expect(screen.getByText('−$43.574,60')).toBeTruthy();
    // Nomina, merma y el resto en 0: presentes y marcadas para atenuarse.
    const ceros = container.querySelectorAll('tr[data-cero="true"]');
    expect(ceros).toHaveLength(5);
    expect(ceros[0].textContent).toBe('Descuentos$0,00');
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeTruthy();
    expect(screen.getByText('martes 13/10 · Casa central')).toBeTruthy();
  });

  it('un negativo que venga de la base en una linea no sale con doble signo', async () => {
    const cargar = vi.fn(async () => ok({ ...DIA_COMPLETO, merma: -1300 }));
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={cargar} />);

    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('−$1.300')).toBeTruthy();
    expect(within(tabla).queryByText(/−−/)).toBeNull();
  });

  it('la region se nombra "Resultado del día" y el dia queda como titulo visible', async () => {
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={vi.fn(async () => ok(DIA_COMPLETO))} />);

    await screen.findByRole('table');
    expect(screen.getByRole('region', { name: 'Resultado del día' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeTruthy();
  });

  it('"anterior" pide el dia anterior al que se esta mirando', async () => {
    const cargar = cargarQueDevuelve(() => ({}));
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={cargar} />);
    await screen.findByRole('table');

    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
    await waitFor(() => expect(cargar).toHaveBeenLastCalledWith('b-1', '2026-10-14'));
    expect(await screen.findByRole('heading', { name: 'Ayer' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
    await waitFor(() => expect(cargar).toHaveBeenLastCalledWith('b-1', '2026-10-13'));
    expect(await screen.findByRole('heading', { name: 'martes 13/10' })).toBeTruthy();
  });

  it('"siguiente" esta deshabilitado en hoy y se habilita en un dia pasado', async () => {
    const cargar = cargarQueDevuelve(() => ({}));
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={cargar} />);
    await screen.findByRole('table');

    const siguiente = screen.getByRole('button', { name: 'Día siguiente' });
    expect(siguiente.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
    await screen.findByRole('heading', { name: 'Ayer' });
    expect(screen.getByRole('button', { name: 'Día siguiente' }).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Día siguiente' }));
    await waitFor(() => expect(cargar).toHaveBeenLastCalledWith('b-1', '2026-10-15'));
    await screen.findByRole('heading', { name: 'Hoy' });
    expect(screen.getByRole('button', { name: 'Día siguiente' }).disabled).toBe(true);
  });

  it('muestra los avisos junto al numero', async () => {
    const cargar = vi.fn(async () => ok({ ...DIA_COMPLETO, horas: 0, nomina: 0, ganancia_neta: 5900 }));
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={cargar} />);

    const avisos = await screen.findByRole('list', { name: 'Avisos sobre la cuenta' });
    expect(within(avisos).getByText(/1 venta sin receta/)).toBeTruthy();
    expect(within(avisos).getByText(/Nadie fichó este día/)).toBeTruthy();
  });

  it('avisa si las lineas no suman el total, sin esconder nada', async () => {
    const cargar = vi.fn(async () => ok({ ...DIA_COMPLETO, ganancia_neta: -1000 }));
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={cargar} />);

    expect(await screen.findByText('Las líneas no suman el total: avisá a soporte.')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('un dia sin movimientos lo dice en una frase y deja la cuenta en 0', async () => {
    const cero = {
      dia: '2026-10-20', ventas: 0, descuentos: 0, costo_mercaderia: 0, lineas_sin_costo: 0,
      tickets: 0, nomina: 0, horas: 0, merma: 0, gastos_del_dia: 0, gastos_fijos: 0, ganancia_neta: 0,
    };
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={vi.fn(async () => ok(cero))} />);

    expect(await screen.findByText(/no tuvo ventas, gastos ni fichajes/)).toBeTruthy();
    // Sin ventas no hay margen ni aviso de fichaje.
    expect(screen.queryByText(/sobre ventas/)).toBeNull();
    expect(screen.queryByRole('list', { name: 'Avisos sobre la cuenta' })).toBeNull();
  });

  it('con error ofrece Reintentar, que vuelve a pedir', async () => {
    const cargar = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'No se pudo traer el resultado del día' })
      .mockResolvedValueOnce(ok(DIA_COMPLETO));
    render(<ResultadoDelDia sucursal={SUCURSAL} cargar={cargar} />);

    const boton = await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.getAllByText('No se pudo traer el resultado del día').length).toBeGreaterThan(0);

    fireEvent.click(boton);
    await screen.findByRole('table');
    expect(cargar).toHaveBeenCalledTimes(2);
    expect(cargar).toHaveBeenLastCalledWith('b-1', null);
  });

  it('mientras carga marca la region ocupada', async () => {
    let soltar;
    const cargar = vi.fn(() => new Promise((r) => { soltar = r; }));
    const { container } = render(<ResultadoDelDia sucursal={SUCURSAL} cargar={cargar} />);

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.getByText('Cargando el resultado del día')).toBeTruthy();
    soltar(ok(DIA_COMPLETO));
    await screen.findByRole('table');
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('sin sucursal no llama a cargar', () => {
    const cargar = vi.fn();
    render(<ResultadoDelDia sucursal={null} cargar={cargar} />);

    expect(screen.getByText('Todavía no hay sucursal cargada.')).toBeTruthy();
    expect(cargar).not.toHaveBeenCalled();
  });

  it('mientras se busca la sucursal no dice que no hay: muestra que carga', () => {
    const cargar = vi.fn();
    const { container } = render(<ResultadoDelDia sucursal={undefined} cargar={cargar} />);

    expect(screen.queryByText('Todavía no hay sucursal cargada.')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(cargar).not.toHaveBeenCalled();
  });
});

describe('VentasPanel', () => {
  it('abre en la solapa Hoy, que es la primera', () => {
    render(<VentasPanel sales={[]} orders={[]} products={[]} ingredients={[]} expenses={[]} showToast={vi.fn()} sucursal={null} />);

    const solapas = screen.getAllByRole('button').map(b => b.textContent);
    expect(solapas.slice(0, 4)).toEqual(['Hoy', 'Ventas', 'Resumen', 'Clientes']);
    expect(screen.getByRole('button', { name: 'Hoy' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Todavía no hay sucursal cargada.')).toBeTruthy();
  });

  it('pasa el "todavia buscando" de la sucursal sin convertirlo en "no hay"', () => {
    const { container } = render(<VentasPanel sales={[]} orders={[]} products={[]} ingredients={[]} expenses={[]} showToast={vi.fn()} sucursal={undefined} />);

    expect(screen.queryByText('Todavía no hay sucursal cargada.')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});
