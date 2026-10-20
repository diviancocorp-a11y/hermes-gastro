import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mockRpc } }));

import {
  fetchResultadoDelDia, normalizarResultado, lineasDelResultado,
  cierraLaCuenta, margenDelDia, avisosDelResultado, sumarDias,
} from '../services/platformResultado';

beforeEach(() => vi.clearAllMocks());

const BRANCH = 'c8b7f3f9-fc0f-4e93-b00d-09be2a096d46';

// Crazy Miga el 13/oct/2026, tal cual lo devolvio resultado_del_dia contra la
// base (3 ventas con el costo de receta congelado, sin gastos ni fichajes).
const CRAZY_MIGA_13_OCT = {
  dia: '2026-10-13', ventas: 151000, descuentos: 0, costo_mercaderia: 43574.6,
  lineas_sin_costo: 0, tickets: 3, nomina: 0, horas: 0, merma: 0,
  gastos_del_dia: 0, gastos_fijos: 0, ganancia_neta: 107425.4,
};

// El escenario de platform/tests/resultado_del_dia.sql: una linea de cada.
const DIA_COMPLETO = {
  dia: '2026-10-15', ventas: 15000, descuentos: 1000, costo_mercaderia: 3800,
  lineas_sin_costo: 1, tickets: 2, nomina: 8000, horas: 4, merma: 1300,
  gastos_del_dia: 2000, gastos_fijos: 1000, ganancia_neta: -2100,
};

describe('la cuenta', () => {
  it('las lineas suman la ganancia que da la base (Crazy Miga, 13/oct)', () => {
    expect(cierraLaCuenta(CRAZY_MIGA_13_OCT)).toBe(true);
  });

  it('las lineas suman la ganancia con todas las lineas en juego', () => {
    expect(cierraLaCuenta(DIA_COMPLETO)).toBe(true);
    const suma = lineasDelResultado(DIA_COMPLETO).reduce((a, l) => a + l.signo * l.monto, 0);
    expect(suma).toBe(-2100);
  });

  it('si la base suma una linea que la UI no muestra, no cierra', () => {
    expect(cierraLaCuenta({ ...DIA_COMPLETO, ganancia_neta: -3100 })).toBe(false);
  });

  it('las ventas suman y todo lo demas resta', () => {
    const lineas = lineasDelResultado(DIA_COMPLETO);
    expect(lineas[0]).toMatchObject({ id: 'ventas', signo: 1 });
    expect(lineas.slice(1).every(l => l.signo === -1)).toBe(true);
    expect(lineas.every(l => l.monto >= 0)).toBe(true);
  });

  it('la nomina dice cuantas horas se ficharon', () => {
    const nomina = lineasDelResultado(DIA_COMPLETO).find(l => l.id === 'nomina');
    expect(nomina.detalle).toBe('4 h fichadas');
    const sinHoras = lineasDelResultado(CRAZY_MIGA_13_OCT).find(l => l.id === 'nomina');
    expect(sinHoras.detalle).toBeNull();
  });
});

describe('margen', () => {
  it('es la ganancia sobre las ventas', () => {
    expect(margenDelDia(CRAZY_MIGA_13_OCT)).toBeCloseTo(71.14, 2);
  });

  it('sin ventas no hay margen', () => {
    expect(margenDelDia({ ...DIA_COMPLETO, ventas: 0 })).toBeNull();
  });
});

describe('avisos', () => {
  it('avisa las ventas sin receta: la ganancia esta inflada', () => {
    expect(avisosDelResultado(DIA_COMPLETO)).toEqual([
      '1 venta sin receta: su costo cuenta 0 y la ganancia queda inflada.',
    ]);
    expect(avisosDelResultado({ ...DIA_COMPLETO, lineas_sin_costo: 3 })[0]).toMatch(/^3 ventas sin receta/);
  });

  it('avisa que sin fichajes la nomina no entra', () => {
    expect(avisosDelResultado(CRAZY_MIGA_13_OCT)).toEqual([
      'Nadie fichó este día: la nómina no entra en la cuenta.',
    ]);
  });

  it('un dia sin ventas no avisa nada', () => {
    expect(avisosDelResultado({ ...CRAZY_MIGA_13_OCT, ventas: 0, ganancia_neta: 0 })).toEqual([]);
  });
});

describe('normalizar', () => {
  it('pasa a numero lo que PostgREST manda como string', () => {
    const r = normalizarResultado({ ...DIA_COMPLETO, ventas: '15000.00', tickets: '2', merma: null });
    expect(r.ventas).toBe(15000);
    expect(r.tickets).toBe(2);
    expect(r.merma).toBe(0);
    expect(r.dia).toBe('2026-10-15');
  });
});

describe('sumarDias', () => {
  it('cruza meses y años sin pasar por la zona del navegador', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(sumarDias('2026-10-13', 0)).toBe('2026-10-13');
  });
});

describe('fetchResultadoDelDia', () => {
  it('llama a la RPC con la sucursal y el dia', async () => {
    mockRpc.mockResolvedValue({ data: [CRAZY_MIGA_13_OCT], error: null });
    const res = await fetchResultadoDelDia(BRANCH, '2026-10-13');
    expect(mockRpc).toHaveBeenCalledWith('resultado_del_dia', { p_branch_id: BRANCH, p_day: '2026-10-13' });
    expect(res).toEqual({ ok: true, data: CRAZY_MIGA_13_OCT });
  });

  it('sin dia le deja a la base elegir hoy', async () => {
    mockRpc.mockResolvedValue({ data: [CRAZY_MIGA_13_OCT], error: null });
    await fetchResultadoDelDia(BRANCH);
    expect(mockRpc).toHaveBeenCalledWith('resultado_del_dia', { p_branch_id: BRANCH, p_day: null });
  });

  it('sin sucursal no llama', async () => {
    const res = await fetchResultadoDelDia(null);
    expect(res.ok).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sin fila es falta de acceso, no un dia en 0', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const res = await fetchResultadoDelDia(BRANCH, '2026-10-13');
    expect(res).toEqual({ ok: false, error: 'No tenés acceso a esta sucursal' });
  });

  it('un error de la base no rompe: devuelve ok false', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await fetchResultadoDelDia(BRANCH, '2026-10-13');
    expect(res.ok).toBe(false);
  });
});

describe('la RPC existe en las migraciones', () => {
  it('0103 define resultado_del_dia con la firma que llama el front', () => {
    const sql = readFileSync(resolve(__dirname, '../../platform/migrations/0103_resultado_del_dia.sql'), 'utf-8');
    expect(sql).toMatch(/create or replace function public\.resultado_del_dia\(\s*p_branch_id uuid,\s*p_day date default null/);
    for (const col of Object.keys(CRAZY_MIGA_13_OCT)) {
      expect(sql, `la RPC no devuelve ${col}`).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });
});
