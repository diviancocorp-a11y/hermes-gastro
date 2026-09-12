/**
 * Sectores y estaciones de producción (0074).
 *
 * Lo que se prueba es la regla que Ricky pidió: **la barra no ve la milanesa
 * y la cocina no ve la limonada**. Todo lo demás de esta pantalla es un ABM;
 * eso es lo único que, si se rompe, se nota recién en pleno servicio.
 *
 * La segunda regla es el riel: las estaciones salen de lo CONFIGURADO, en el
 * orden del circuito, y no de los platos que haya en pantalla. Un riel que
 * cambia de largo durante el servicio obliga a mirar antes de tocar, que es
 * justo lo que no se puede hacer con las manos ocupadas.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import {
  abreviar, platosDelSector, ticketDelSector, pendientesPorSector,
} from '../services/platformProduccion';
import { estacionesDe, tocaLaEstacion } from '../services/platformKds';
import SectoresPanel from '../components/admin/platform/SectoresPanel';

const COCINA = 'sec-cocina';
const BARRA = 'sec-barra';

const parrilla = { id: 'est-par', sector_id: COCINA, name: 'Parrilla', short_name: 'PAR', orden: 0 };
const plancha = { id: 'est-pla', sector_id: COCINA, name: 'Plancha', short_name: 'PLA', orden: 1 };
const barra = { id: 'est-bar', sector_id: BARRA, name: 'Barra', short_name: 'BAR', orden: 0 };

const plato = (o) => ({ id: o.id, qty: 1, ready_at: null, station_id: null, sector_id: null, ...o });

const ticket = {
  id: 't1',
  titulo: 'Mesa 7',
  order_items: [
    plato({ id: 'i1', name_snapshot: 'Milanesa', station_id: plancha.id, sector_id: COCINA }),
    plato({ id: 'i2', name_snapshot: 'Provoleta', station_id: parrilla.id, sector_id: COCINA }),
    plato({ id: 'i3', name_snapshot: 'Limonada', station_id: barra.id, sector_id: BARRA }),
  ],
};

describe('la barra no ve la milanesa', () => {
  it('el ticket de la barra trae solo lo suyo', () => {
    const t = ticketDelSector(ticket, BARRA);
    expect(t.order_items.map(i => i.name_snapshot)).toEqual(['Limonada']);
  });

  it('el ticket de la cocina no trae la limonada', () => {
    const t = ticketDelSector(ticket, COCINA);
    expect(t.order_items.map(i => i.name_snapshot)).toEqual(['Milanesa', 'Provoleta']);
  });

  it('el resto del ticket se conserva: la mesa y el nombre son los mismos', () => {
    const t = ticketDelSector(ticket, BARRA);
    expect(t.id).toBe('t1');
    expect(t.titulo).toBe('Mesa 7');
  });

  it('un ticket sin nada de ese sector devuelve null y no se dibuja', () => {
    const soloCocina = { ...ticket, order_items: [ticket.order_items[0]] };
    expect(ticketDelSector(soloCocina, BARRA)).toBeNull();
  });

  it('sin sector devuelve todo: es el caso del negocio sin configurar', () => {
    expect(platosDelSector(ticket, null)).toHaveLength(3);
  });
});

describe('cuantos tickets espera cada sector', () => {
  it('cuenta el ticket una vez por sector, no una por plato', () => {
    const c = pendientesPorSector([ticket], [{ id: COCINA }, { id: BARRA }]);
    expect(c.get(COCINA)).toBe(1);
    expect(c.get(BARRA)).toBe(1);
  });

  it('un sector con todo marcado no cuenta', () => {
    const t = {
      ...ticket,
      order_items: ticket.order_items.map(
        i => (i.sector_id === BARRA ? { ...i, ready_at: '2026-09-12T00:00:00Z' } : i)),
    };
    const c = pendientesPorSector([t], [{ id: COCINA }, { id: BARRA }]);
    expect(c.get(COCINA)).toBe(1);
    expect(c.get(BARRA)).toBe(0);
  });
});

describe('el riel sale de lo configurado, no de los platos', () => {
  const estaciones = [parrilla, plancha];

  it('respeta el orden del circuito y no el alfabetico', () => {
    // Alfabetico pondria Plancha antes que Parrilla.
    const { estaciones: lista } = estacionesDe([ticketDelSector(ticket, COCINA)], estaciones);
    expect(lista.map(e => e.nombre)).toEqual(['Parrilla', 'Plancha']);
  });

  it('una estacion sin trabajo se muestra en cero, no desaparece', () => {
    const soloPlancha = { ...ticket, order_items: [ticket.order_items[0]] };
    const { estaciones: lista } = estacionesDe([soloPlancha], estaciones);
    expect(lista.find(e => e.nombre === 'Parrilla').n).toBe(0);
    expect(lista.find(e => e.nombre === 'Plancha').n).toBe(1);
  });

  it('el plato sin estacion aparece aparte, para que no se pierda', () => {
    const huerfano = { ...ticket, order_items: [plato({ id: 'x', name_snapshot: 'Suelto' })] };
    const { estaciones: lista } = estacionesDe([huerfano], estaciones);
    expect(lista.find(e => e.id === 'sin-estacion').n).toBe(1);
  });

  it('sin platos huerfanos no aparece esa fila', () => {
    const { estaciones: lista } = estacionesDe([ticketDelSector(ticket, COCINA)], estaciones);
    expect(lista.find(e => e.id === 'sin-estacion')).toBeUndefined();
  });

  it('filtrar por estacion mira el id, no el nombre', () => {
    const t = ticketDelSector(ticket, COCINA);
    expect(tocaLaEstacion(t, parrilla.id)).toBe(true);
    expect(tocaLaEstacion(t, barra.id)).toBe(false);
    expect(tocaLaEstacion(t, 'todas')).toBe(true);
  });
});

describe('la abreviatura de la tablet', () => {
  it('usa la que cargo el local', () => {
    expect(abreviar({ name: 'Parrilla', short_name: 'PAR' })).toBe('PAR');
  });

  it('sin abreviatura corta el nombre, pero es un respaldo y no la regla', () => {
    expect(abreviar({ name: 'Postres' })).toBe('POS');
  });

  it('no rompe con una estacion vacia', () => {
    expect(abreviar(null)).toBe('');
    expect(abreviar({ name: '' })).toBe('');
  });
});

describe('la pantalla de produccion', () => {
  const sectores = [
    { id: COCINA, name: 'Cocina', mode: 'pantalla', umbral_min: 18, orden: 0, estaciones: [parrilla, plancha] },
    { id: BARRA, name: 'Barra', mode: 'papel', umbral_min: 5, orden: 1, estaciones: [barra] },
  ];

  it('sin sectores ofrece armar los tipicos', () => {
    const onCrearTipicos = vi.fn();
    render(<SectoresPanel sectores={[]} onCrearTipicos={onCrearTipicos} />);
    fireEvent.click(screen.getByRole('button', { name: /crear cocina y barra/i }));
    expect(onCrearTipicos).toHaveBeenCalled();
  });

  it('avisa cuantos productos quedaron sin estacion', () => {
    render(<SectoresPanel sectores={sectores} productosSinEstacion={7} />);
    expect(screen.getByText(/no aparecen en ninguna pantalla/i)).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('sin productos sueltos no muestra el aviso', () => {
    render(<SectoresPanel sectores={sectores} productosSinEstacion={0} />);
    expect(screen.queryByText(/no aparecen en ninguna pantalla/i)).not.toBeInTheDocument();
  });

  it('el modo del sector se ve y se cambia', async () => {
    const onGuardarSector = vi.fn().mockResolvedValue({ id: COCINA });
    render(<SectoresPanel sectores={[sectores[0]]} onGuardarSector={onGuardarSector} />);

    fireEvent.click(screen.getByRole('radio', { name: /comandera/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar sector/i }));

    await waitFor(() => {
      expect(onGuardarSector).toHaveBeenCalledWith(expect.objectContaining({ mode: 'papel' }));
    });
  });

  it('el umbral es del sector: la barra no espera lo mismo que la cocina', async () => {
    const onGuardarSector = vi.fn().mockResolvedValue({ id: BARRA });
    render(<SectoresPanel sectores={[sectores[1]]} onGuardarSector={onGuardarSector} />);

    const campo = screen.getByLabelText(/se considera demorado/i);
    expect(campo.value).toBe('5');
    fireEvent.change(campo, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar sector/i }));

    await waitFor(() => {
      expect(onGuardarSector).toHaveBeenCalledWith(expect.objectContaining({ umbral_min: '4' }));
    });
  });

  it('mover una estacion guarda LAS DOS, o quedan con el mismo orden', async () => {
    const onGuardarEstacion = vi.fn().mockResolvedValue({});
    render(<SectoresPanel sectores={[sectores[0]]} onGuardarEstacion={onGuardarEstacion} />);

    fireEvent.click(screen.getByRole('button', { name: /bajar parrilla/i }));

    await waitFor(() => expect(onGuardarEstacion).toHaveBeenCalledTimes(2));
    const ordenes = onGuardarEstacion.mock.calls.map(c => [c[0].name, c[0].orden]);
    expect(ordenes).toEqual([['Parrilla', 1], ['Plancha', 0]]);
  });

  it('la primera no se puede subir ni la ultima bajar', () => {
    render(<SectoresPanel sectores={[sectores[0]]} />);
    expect(screen.getByRole('button', { name: /subir parrilla/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /bajar plancha/i })).toBeDisabled();
  });
});
