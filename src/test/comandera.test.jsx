/**
 * La comandera: el sector que despacha en papel (0075).
 *
 * Lo que se prueba es lo que, si se rompe, se nota recien con el plato sin
 * salir o con el plato hecho dos veces:
 *
 *   1. La comanda dice de que sector es, que platos van y en que estacion.
 *   2. Una reimpresion sale MARCADA. Dos papeles iguales son dos platos.
 *   3. Si la impresora no responde, la comanda NO se da por impresa.
 *   4. El mozo cierra desde Salon solo lo que nadie mas puede cerrar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import {
  comandaDeSector, sectoresPendientes, minutosDesde, cerrarSectorDelTicket,
} from '../services/platformComandera';
import { cerrarTicket } from '../services/platformKds';
import { supabase } from '../lib/supabase';
import ComanderaPanel from '../components/admin/platform/ComanderaPanel';

const AHORA = new Date('2026-09-12T21:30:00-03:00');
const haceMin = (m) => new Date(AHORA.getTime() - m * 60000).toISOString();

const COCINA = { id: 'sec-cocina', name: 'Cocina', mode: 'pantalla' };
const BARRA = { id: 'sec-barra', name: 'Barra', mode: 'papel' };

const plato = (o) => ({ id: o.id, qty: 1, ready_at: null, note: null, station: null, sector_id: BARRA.id, ...o });

const ticket = (o = {}) => ({
  id: 't1',
  titulo: 'Mesa 7',
  ticket_number: 104,
  resource_id: 'm7',
  delivery: 'retiro',
  diners: 4,
  allergy_note: null,
  staff_nombre: 'Lucía',
  kitchen_at: haceMin(6),
  ready_at: null,
  order_items: [
    plato({ id: 'i1', qty: 2, name_snapshot: 'Gaseosa', station: 'Barra' }),
    plato({ id: 'i2', name_snapshot: 'Submarino', station: 'Cafetería', note: 'poca espuma' }),
  ],
  ...o,
});

describe('la comanda que sale por la impresora', () => {
  const armar = (t, opciones) => comandaDeSector(t, {
    sector: BARRA, ahora: AHORA, timezone: 'America/Argentina/Buenos_Aires', ...opciones,
  });

  it('dice de que sector es y que numero de ticket', () => {
    const c = armar(ticket());
    expect(c).toContain('BARRA');
    expect(c).toContain('N 104');
    expect(c).toContain('Mesa 7');
  });

  it('entra en 32 columnas, que es el ancho de una termica de 58 mm', () => {
    for (const l of armar(ticket()).split('\n')) {
      expect(l.length, `"${l}" se pasa del papel`).toBeLessThanOrEqual(32);
    }
  });

  it('a 80 mm usa 48 columnas', () => {
    const c = armar(ticket(), { anchoCols: 48 });
    expect(c.split('\n').some(l => l.length > 32)).toBe(true);
    for (const l of c.split('\n')) expect(l.length).toBeLessThanOrEqual(48);
  });

  it('la estacion va con cada plato: en papel es como se reparte la hoja', () => {
    const c = armar(ticket());
    expect(c).toContain('[BARRA]');
    expect(c).toContain('[CAFETERÍA]');
  });

  it('el modificador va abajo del plato y no se pierde', () => {
    expect(armar(ticket())).toContain('poca espuma');
  });

  it('la alergia va ARRIBA de los platos, no al final', () => {
    const c = armar(ticket({ allergy_note: 'Sin TACC' }));
    expect(c.indexOf('! Sin TACC')).toBeLessThan(c.indexOf('2x Gaseosa'));
  });

  it('no imprime lo que ya esta marcado listo', () => {
    const t = ticket();
    t.order_items[0].ready_at = haceMin(1);
    const c = armar(t);
    expect(c).not.toContain('Gaseosa');
    expect(c).toContain('Submarino');
  });

  it('la REIMPRESION se anuncia arriba de todo', () => {
    const c = armar(ticket(), { reimpresion: true });
    expect(c.split('\n')[0]).toContain('REIMPRESION');
    // Sin la marca, dos papeles iguales son dos platos cocinados.
    expect(armar(ticket())).not.toContain('REIMPRESION');
  });

  it('trae la hora en que bajo a cocina, que es contra la que se corre', () => {
    expect(armar(ticket())).toMatch(/Bajo \d{2}:\d{2}/);
  });
});

describe('que le falta a la mesa, por sector', () => {
  const mixto = {
    ...ticket(),
    order_items: [
      plato({ id: 'a', name_snapshot: 'Milanesa', sector_id: COCINA.id }),
      plato({ id: 'b', name_snapshot: 'Provoleta', sector_id: COCINA.id }),
      plato({ id: 'c', name_snapshot: 'Gaseosa', sector_id: BARRA.id }),
    ],
  };

  it('cuenta los platos pendientes de cada sector', () => {
    const p = sectoresPendientes(mixto, [COCINA, BARRA]);
    expect(p.map(s => [s.nombre, s.platos])).toEqual([['Cocina', 2], ['Barra', 1]]);
  });

  it('el sector sin nada pendiente no aparece', () => {
    const t = {
      ...mixto,
      order_items: mixto.order_items.map(i => (i.sector_id === BARRA.id ? { ...i, ready_at: haceMin(1) } : i)),
    };
    expect(sectoresPendientes(t, [COCINA, BARRA]).map(s => s.nombre)).toEqual(['Cocina']);
  });

  it('dice el modo, que es lo que decide si el mozo ve un boton', () => {
    const p = sectoresPendientes(mixto, [COCINA, BARRA]);
    expect(p.find(s => s.nombre === 'Cocina').modo).toBe('pantalla');
    expect(p.find(s => s.nombre === 'Barra').modo).toBe('papel');
  });

  it('el plato sin sector no se esconde: no aparece en ninguna pantalla', () => {
    const t = { ...mixto, order_items: [plato({ id: 'x', name_snapshot: 'Suelto', sector_id: null })] };
    const p = sectoresPendientes(t, [COCINA, BARRA]);
    expect(p).toHaveLength(1);
    expect(p[0].huerfano).toBe(true);
  });
});

describe('minutos desde que salio el papel', () => {
  it('cuenta contra el reloj y nunca da negativo', () => {
    expect(Math.round(minutosDesde(haceMin(7), AHORA))).toBe(7);
    expect(minutosDesde(null, AHORA)).toBe(0);
    expect(minutosDesde(new Date(AHORA.getTime() + 60000), AHORA)).toBe(0);
  });
});

describe('la pantalla de la comandera', () => {
  // La impresion automatica y el ancho de papel se guardan en el navegador a
  // proposito: la computadora de la barra los conserva entre recargas. Sin
  // limpiarlos, un test arranca encendido porque lo encendio el anterior.
  beforeEach(() => { try { localStorage.clear(); } catch { /* sin storage */ } });

  const pendiente = ticket();
  const abierta = { ...ticket({ id: 't2', titulo: 'Mesa 3' }), printed_at: haceMin(9), impresiones: 1 };

  it('apagada lo dice, y dice que el papel no sale', () => {
    render(<ComanderaPanel sector={BARRA} porImprimir={[pendiente]} ahoraFijo={AHORA} />);
    expect(screen.getByText(/no sale papel/i)).toBeInTheDocument();
    expect(screen.getByText(/1 comanda esperando/i)).toBeInTheDocument();
  });

  it('se enciende a mano: el navegador no deja imprimir sin un gesto', async () => {
    const onImprimir = vi.fn().mockResolvedValue({ ok: true });
    render(<ComanderaPanel sector={BARRA} porImprimir={[pendiente]} onImprimir={onImprimir} ahoraFijo={AHORA} />);

    expect(onImprimir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /encender impresión automática/i }));
    await waitFor(() => expect(onImprimir).toHaveBeenCalledTimes(1));
  });

  it('imprimir a mano manda el texto de la comanda, no el ticket', async () => {
    const onImprimir = vi.fn().mockResolvedValue({ ok: true });
    render(<ComanderaPanel sector={BARRA} porImprimir={[pendiente]} onImprimir={onImprimir} ahoraFijo={AHORA} />);

    fireEvent.click(screen.getByRole('button', { name: /^imprimir$/i }));
    await waitFor(() => expect(onImprimir).toHaveBeenCalled());
    const [tkt, texto, opciones] = onImprimir.mock.calls[0];
    expect(tkt.id).toBe('t1');
    expect(texto).toContain('BARRA');
    expect(opciones.reimpresion).toBe(false);
  });

  it('si la impresora no responde, la comanda NO se da por impresa', async () => {
    const onImprimir = vi.fn().mockResolvedValue({ ok: false, motivo: 'print-fallo' });
    const showToast = vi.fn();
    render(
      <ComanderaPanel
        sector={BARRA} porImprimir={[pendiente]} onImprimir={onImprimir}
        showToast={showToast} ahoraFijo={AHORA}
      />);

    fireEvent.click(screen.getByRole('button', { name: /^imprimir$/i }));
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(screen.getByText(/no salió/i)).toBeInTheDocument();
  });

  it('una que fallo no se reintenta sola: seria golpear la impresora sin fin', async () => {
    const onImprimir = vi.fn().mockResolvedValue({ ok: false, motivo: 'print-fallo' });
    render(
      <ComanderaPanel
        sector={BARRA} porImprimir={[pendiente]} onImprimir={onImprimir}
        showToast={vi.fn()} ahoraFijo={AHORA}
      />);

    fireEvent.click(screen.getByRole('button', { name: /encender impresión automática/i }));
    await waitFor(() => expect(onImprimir).toHaveBeenCalledTimes(1));
    await new Promise(r => setTimeout(r, 60));
    expect(onImprimir).toHaveBeenCalledTimes(1);
  });

  it('reimprimir avisa que es reimpresion', async () => {
    const onImprimir = vi.fn().mockResolvedValue({ ok: true });
    render(<ComanderaPanel sector={BARRA} abiertas={[abierta]} onImprimir={onImprimir} ahoraFijo={AHORA} />);

    fireEvent.click(screen.getByRole('button', { name: /reimprimir/i }));
    await waitFor(() => expect(onImprimir).toHaveBeenCalled());
    expect(onImprimir.mock.calls[0][2].reimpresion).toBe(true);
    expect(onImprimir.mock.calls[0][1]).toContain('REIMPRESION');
  });

  it('el papel que anda dando vueltas se puede cerrar desde aca', () => {
    const onCerrar = vi.fn();
    render(<ComanderaPanel sector={BARRA} abiertas={[abierta]} onCerrar={onCerrar} ahoraFijo={AHORA} />);
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onCerrar).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }));
  });
});

// PostgREST resuelve la funcion por el conjunto de argumentos NOMBRADOS. Si
// se manda siempre `p_sector_id`, cerrar un ticket falla contra una base que
// todavia no tiene la 0075 —ahi la funcion acepta dos argumentos— y la cocina
// queda sin poder cerrar nada. Esto es lo unico que lo sostiene.
describe('cerrar habla con la funcion que existe', () => {
  it('sin sector manda DOS argumentos', async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });
    await cerrarTicket('t1', 'o1');
    expect(supabase.rpc).toHaveBeenCalledWith('cerrar_ticket_de_cocina', {
      p_tenant_id: 't1', p_order_id: 'o1',
    });
  });

  it('con sector manda el tercero', async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });
    await cerrarSectorDelTicket('t1', 'o1', 'sec-barra');
    expect(supabase.rpc).toHaveBeenCalledWith('cerrar_ticket_de_cocina', {
      p_tenant_id: 't1', p_order_id: 'o1', p_sector_id: 'sec-barra',
    });
  });
});
