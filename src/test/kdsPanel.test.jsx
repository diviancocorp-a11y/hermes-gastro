/**
 * KDS: la cocina en grilla de tickets.
 *
 * Lo que se prueba son las reglas que deciden lo que la cocina ve:
 *
 *   1. el cronometro cuenta desde que BAJO A COCINA, no desde que entro
 *   2. los tres colores salen del umbral, y "atencion" es relativo
 *   3. la estacion cuenta lo PENDIENTE, que es donde hay trabajo
 *   4. marcar un plato no alterna: un toque repetido da siempre lo mismo
 *
 * La primera es la que justifica media migracion. Si el cronometro contara
 * desde `created_at`, un pedido programado para las 21:00 cargado a las 19:00
 * entraria en rojo a la cocina, y el rojo dejaria de significar nada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import {
  zonaDelTicket, minutosEnCocina, cronometro, estadoDeDemora, avanceDeDemora,
  platosListos, estacionesDe, tocaLaEstacion, tituloDelTicket, normalizarTicket,
  etiquetaDePasador,
} from '../services/platformKds';
import KdsPanel from '../components/admin/platform/KdsPanel';

const AHORA = new Date('2026-09-11T22:00:00Z');
const haceMin = (m) => new Date(AHORA.getTime() - m * 60000).toISOString();

const plato = (o = {}) => ({
  id: o.id || crypto.randomUUID(), order_id: 'o', tenant_id: 't',
  name_snapshot: 'Plato', qty: 1, station: null, note: null, ready_at: null,
  created_at: '2026-09-11T21:00:00Z', ...o,
});

const ticket = (o = {}) => normalizarTicket({
  id: o.id || crypto.randomUUID(), tenant_id: 't', branch_id: 'b',
  status: 'preparing', channel: null, delivery: null, delivery_date: null,
  customer_name: null, note: null, allergy_note: null, diners: null,
  staff_id: null, resource_id: null, ticket_number: 12,
  kitchen_at: haceMin(5), ready_at: null, created_at: haceMin(60),
  order_items: [plato()], ...o,
}, AHORA);

beforeEach(() => vi.clearAllMocks());

describe('de donde viene el ticket', () => {
  it('con mesa es salon', () => {
    expect(zonaDelTicket(ticket({ resource_id: 'm1' }), AHORA)).toBe('salon');
  });

  it('sin mesa y sin envio es mostrador', () => {
    expect(zonaDelTicket(ticket(), AHORA)).toBe('mostrador');
  });

  it('take away NO es delivery aunque tenga el campo cargado', () => {
    expect(zonaDelTicket(ticket({ delivery: 'takeaway' }), AHORA)).toBe('mostrador');
  });

  it('programado gana sobre delivery: lo primero es que no sale ahora', () => {
    const t = ticket({ delivery: 'envio', delivery_date: '2026-09-12' });
    expect(zonaDelTicket(t, AHORA)).toBe('programado');
  });

  it('una fecha pasada ya no es programado', () => {
    const t = ticket({ delivery: 'envio', delivery_date: '2026-09-10' });
    expect(zonaDelTicket(t, AHORA)).toBe('delivery');
  });
});

describe('el cronometro cuenta desde que bajo a cocina', () => {
  it('un pedido viejo que recien baja arranca en cero', () => {
    // Entro hace 3 horas, bajo hace 1 minuto: la cocina lleva 1 minuto.
    const t = ticket({ created_at: haceMin(180), kitchen_at: haceMin(1) });
    expect(minutosEnCocina(t, AHORA)).toBeCloseTo(1, 5);
  });

  it('sin kitchen_at no cuenta nada: todavia no esta en cocina', () => {
    expect(minutosEnCocina(ticket({ kitchen_at: null }), AHORA)).toBe(0);
  });

  it('se muestra como minutos y segundos', () => {
    expect(cronometro(19.1)).toBe('19:06');
    expect(cronometro(0)).toBe('0:00');
    expect(cronometro(5.1)).toBe('5:06');
  });
});

describe('los tres colores', () => {
  it('pasado el umbral esta demorado', () => {
    expect(estadoDeDemora(18, 18)).toBe('demorado');
    expect(estadoDeDemora(25, 18)).toBe('demorado');
  });

  it('atencion es relativo al umbral, no un valor fijo', () => {
    // El 60% sale del render: ahi 11:06 contra un umbral de 18 esta en ambar.
    // Con dos tercios habria quedado verde y el aviso llegaria tarde.
    expect(estadoDeDemora(11.1, 18)).toBe('atencion');
    expect(estadoDeDemora(10.5, 18)).toBe('en-tiempo');
    expect(estadoDeDemora(3.7, 6)).toBe('atencion');
    expect(estadoDeDemora(3.5, 6)).toBe('en-tiempo');
  });

  it('la barra de la tablet se topa en 1', () => {
    expect(avanceDeDemora(9, 18)).toBe(0.5);
    expect(avanceDeDemora(40, 18)).toBe(1);
  });

  it('un umbral invalido cae a 18 en vez de romper la pantalla', () => {
    expect(estadoDeDemora(20, 0)).toBe('demorado');
    expect(estadoDeDemora(5, null)).toBe('en-tiempo');
  });
});

describe('estaciones', () => {
  const tks = [
    ticket({ order_items: [
      plato({ id: 'a', station: 'Parrilla' }),
      plato({ id: 'b', station: 'Plancha' }),
      plato({ id: 'c', station: 'Parrilla', ready_at: haceMin(1) }),
    ] }),
    ticket({ order_items: [plato({ id: 'd', station: 'Parrilla' })] }),
  ];

  it('cuenta TICKETS, no platos: el numero es una promesa de lo que vas a ver', () => {
    const { estaciones, total } = estacionesDe(tks);
    expect(total).toBe(2); // dos tickets con trabajo pendiente
    // El primero tiene un plato de parrilla pendiente y otro ya marcado: es
    // UN ticket, no dos.
    expect(estaciones.find(e => e.nombre === 'Parrilla').n).toBe(2);
    expect(estaciones.find(e => e.nombre === 'Plancha').n).toBe(1);
  });

  it('un ticket con dos platos de la misma estacion cuenta una vez', () => {
    const t = ticket({ order_items: [
      plato({ id: 'x', station: 'Parrilla' }),
      plato({ id: 'y', station: 'Parrilla' }),
    ] });
    expect(estacionesDe([t]).estaciones.find(e => e.nombre === 'Parrilla').n).toBe(1);
  });

  it('un ticket con todo marcado no cuenta en ninguna estacion', () => {
    const t = ticket({ order_items: [plato({ station: 'Parrilla', ready_at: haceMin(1) })] });
    expect(estacionesDe([t]).total).toBe(0);
  });

  it('el plato sin estacion no desaparece', () => {
    const { estaciones } = estacionesDe([ticket({ order_items: [plato({ station: null })] })]);
    expect(estaciones.map(e => e.nombre)).toContain('sin-estacion');
  });

  it('un ticket toca la estacion solo si le queda algo pendiente ahi', () => {
    const t = ticket({ order_items: [plato({ station: 'Parrilla', ready_at: haceMin(1) })] });
    expect(tocaLaEstacion(t, 'Parrilla')).toBe(false);
    expect(tocaLaEstacion(t, 'todas')).toBe(true);
  });
});

describe('como se llama el ticket', () => {
  it('en salon manda la mesa, que es lo que el mozo pregunta', () => {
    const t = normalizarTicket({ resource_id: 'm', resources: { name: 'Mesa 7' }, ticket_number: 3, order_items: [] }, AHORA);
    expect(t.titulo).toBe('Mesa 7');
  });

  it('fuera del salon manda el numero', () => {
    expect(tituloDelTicket({ ticket_number: 12 }, AHORA)).toBe('Pedido 12');
    expect(tituloDelTicket({ ticket_number: 87, delivery: 'envio' }, AHORA)).toBe('Delivery 87');
  });

  it('sin numero lo dice en vez de inventar uno', () => {
    expect(tituloDelTicket({ ticket_number: null }, AHORA)).toBe('Sin número');
  });

  it('los platos pendientes van arriba de los marcados', () => {
    const t = normalizarTicket({
      order_items: [plato({ id: 'y', ready_at: haceMin(1) }), plato({ id: 'x' })],
    }, AHORA);
    expect(t.order_items.map(i => i.id)).toEqual(['x', 'y']);
  });
});

describe('la etiqueta del pasador', () => {
  const t = ticket({
    resource_id: 'm', ticket_number: 247, diners: 2,
    allergy_note: 'Celíaca',
    order_items: [
      plato({ id: '1', qty: 1, name_snapshot: 'Sorrentinos de calabaza', note: 'salsa aparte' }),
      plato({ id: '2', qty: 1, name_snapshot: 'Agua con gas' }),
    ],
  });

  it('entra en 32 columnas: es una termica de 58 mm', () => {
    const e = etiquetaDePasador(t, { anchoCols: 32, ahora: AHORA });
    for (const l of e.split('\n')) expect(l.length).toBeLessThanOrEqual(32);
  });

  it('la alergia va ARRIBA de los platos, no al final', () => {
    const lineas = etiquetaDePasador(t, { ahora: AHORA }).split('\n');
    const alergia = lineas.findIndex(l => l.includes('Celíaca'));
    const primerPlato = lineas.findIndex(l => l.includes('Sorrentinos'));
    expect(alergia).toBeGreaterThan(-1);
    expect(alergia).toBeLessThan(primerPlato);
  });

  it('lleva el numero, los platos y sus modificadores', () => {
    const e = etiquetaDePasador(t, { ahora: AHORA });
    expect(e).toContain('TICKET 247');
    expect(e).toContain('1x Sorrentinos de calabaza');
    expect(e).toContain('salsa aparte');
  });

  it('un ticket sin alergia no imprime la marca', () => {
    const e = etiquetaDePasador(ticket({ allergy_note: null }), { ahora: AHORA });
    expect(e).not.toContain('!');
  });
});

describe('la pantalla', () => {
  const tks = [
    ticket({
      id: 't1', resource_id: 'm', resources: { name: 'Mesa 7' }, diners: 6,
      kitchen_at: haceMin(19), allergy_note: 'Alergia: frutos secos',
      order_items: [
        plato({ id: 'p1', qty: 2, name_snapshot: 'Milanesa napolitana', note: 'a punto · sin jamón en una', station: 'Plancha' }),
        plato({ id: 'p2', qty: 1, name_snapshot: 'Provoleta', station: 'Parrilla' }),
      ],
    }),
    ticket({ id: 't2', ticket_number: 13, kitchen_at: haceMin(1), order_items: [plato({ id: 'p3', station: 'Plancha' })] }),
  ];

  it('el ticket pasado del umbral sale en rojo, el nuevo en verde', () => {
    render(<KdsPanel tickets={tks} umbralMin={18} ahoraFijo={AHORA} />);
    const arts = document.querySelectorAll('.ag-kds-ticket');
    expect(arts[0].getAttribute('data-estado')).toBe('demorado');
    expect(arts[1].getAttribute('data-estado')).toBe('en-tiempo');
  });

  it('la alergia se muestra, porque es el dato que no se puede pasar por alto', () => {
    render(<KdsPanel tickets={tks} ahoraFijo={AHORA} />);
    expect(screen.getByText(/frutos secos/)).toBeInTheDocument();
  });

  it('los modificadores del plato se muestran aparte del nombre', () => {
    render(<KdsPanel tickets={tks} ahoraFijo={AHORA} />);
    expect(screen.getByText('a punto · sin jamón en una')).toBeInTheDocument();
  });

  it('el contador del boton cuenta los platos marcados', () => {
    render(<KdsPanel tickets={tks} ahoraFijo={AHORA} />);
    expect(screen.getByRole('button', { name: /ticket listo \(0\/2\)/i })).toBeInTheDocument();
  });

  it('filtrar por estacion deja solo los tickets con trabajo ahi', () => {
    render(<KdsPanel tickets={tks} ahoraFijo={AHORA} />);
    fireEvent.click(screen.getByRole('button', { name: /^Parrilla/ }));
    // Solo el primero tiene un plato de parrilla pendiente.
    expect(document.querySelectorAll('.ag-kds-ticket')).toHaveLength(1);
  });

  it('tocar un plato lo manda a marcar, sin alternar a ciegas', async () => {
    const onMarcarPlato = vi.fn().mockResolvedValue({});
    render(<KdsPanel tickets={tks} ahoraFijo={AHORA} onMarcarPlato={onMarcarPlato} />);
    fireEvent.click(screen.getByRole('button', { name: /Milanesa napolitana/ }));
    await waitFor(() => {
      expect(onMarcarPlato).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1' }), expect.objectContaining({ id: 'p1' }), true);
    });
  });

  it('un plato ya marcado se manda a desmarcar', async () => {
    const onMarcarPlato = vi.fn().mockResolvedValue({});
    const t = ticket({ order_items: [plato({ id: 'z', name_snapshot: 'Flan', ready_at: haceMin(1) })] });
    render(<KdsPanel tickets={[t]} ahoraFijo={AHORA} onMarcarPlato={onMarcarPlato} />);
    fireEvent.click(screen.getByRole('button', { name: /Flan/ }));
    await waitFor(() => {
      expect(onMarcarPlato).toHaveBeenCalledWith(expect.anything(), expect.anything(), false);
    });
  });

  it('cerrar el ticket avisa al padre', async () => {
    const onCerrarTicket = vi.fn().mockResolvedValue({});
    render(<KdsPanel tickets={[tks[1]]} ahoraFijo={AHORA} onCerrarTicket={onCerrarTicket} />);
    fireEvent.click(screen.getByRole('button', { name: /ticket listo/i }));
    await waitFor(() => expect(onCerrarTicket).toHaveBeenCalled());
  });

  it('sin nada en cocina lo dice, y dice de donde vienen los tickets', () => {
    render(<KdsPanel tickets={[]} ahoraFijo={AHORA} />);
    expect(screen.getByText(/no hay nada en cocina/i)).toBeInTheDocument();
    expect(screen.getByText(/cuando se aprueban/i)).toBeInTheDocument();
  });

  it('el modo tablet muestra la barra de demora y saca el boton Todo', () => {
    render(<KdsPanel tickets={tks} modo="tablet" ahoraFijo={AHORA} />);
    expect(document.querySelector('.ag-kds-barra-demora')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^todo$/i })).not.toBeInTheDocument();
  });

  it('el modo tv no dibuja la barra: ahi la demora es el numero', () => {
    render(<KdsPanel tickets={tks} modo="tv" ahoraFijo={AHORA} />);
    expect(document.querySelector('.ag-kds-barra-demora')).toBeNull();
  });
});

describe('el KDS no hace lo administrativo, y es a proposito', () => {
  it('no ofrece cobrar, cancelar, aprobar ni rechazar', () => {
    render(<KdsPanel tickets={[ticket()]} ahoraFijo={AHORA} />);
    for (const accion of [/cobrar/i, /cancelar/i, /aprobar/i, /rechazar/i]) {
      expect(screen.queryByRole('button', { name: accion })).not.toBeInTheDocument();
    }
  });
});
