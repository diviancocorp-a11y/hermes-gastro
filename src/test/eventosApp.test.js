// Eventos del panel en el edificio (0124): lo que guarda el front y como lo
// resumen GerenteDico y morning-health.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ insert })) } }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantId: vi.fn() }));

import { supabase } from '../lib/supabase';
import { resolveTenantId } from '../lib/activeTenant';
import { registrarEvento } from '../services/eventosApp';
import { resumirEventos, lineasDeBloqueos } from '../../platform/functions/gerente-webhook/eventos.js';

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
  vi.mocked(resolveTenantId).mockReset().mockResolvedValue('t1');
});

describe('registrarEvento', () => {
  it('guarda el evento con el negocio del host', async () => {
    expect(await registrarEvento('plan-bloqueo-visto', { funcion: 'crm' })).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('eventos_app');
    expect(insert).toHaveBeenCalledWith({ tenant_id: 't1', nombre: 'plan-bloqueo-visto', props: { funcion: 'crm' } });
  });

  it('un nombre fuera de la lista no llega a la base', async () => {
    expect(await registrarEvento('web_vital', { value: 1 })).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('sin negocio no guarda', async () => {
    vi.mocked(resolveTenantId).mockResolvedValue(null);
    expect(await registrarEvento('plan-bloqueo-click', { funcion: 'crm' })).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('nunca tira: un error de la base devuelve false', async () => {
    insert.mockRejectedValue(new Error('caida'));
    expect(await registrarEvento('plan-bloqueo-click', { funcion: 'crm' })).toBe(false);
    insert.mockResolvedValue({ error: { message: 'rls' } });
    expect(await registrarEvento('plan-bloqueo-click', { funcion: 'crm' })).toBe(false);
  });
});

const FILAS = [
  { tenant_id: 't1', nombre: 'plan-bloqueo-visto', props: { funcion: 'ganancia' } },
  { tenant_id: 't2', nombre: 'plan-bloqueo-visto', props: { funcion: 'ganancia' } },
  { tenant_id: 't1', nombre: 'plan-bloqueo-visto', props: { funcion: 'cobros_online' } },
  { tenant_id: 't1', nombre: 'plan-bloqueo-click', props: { funcion: 'cobros_online' } },
];
const SLUGS = { t1: 'la-nona-pato', t2: 'monare' };

describe('resumirEventos', () => {
  it('cuenta vistas y clicks por funcion, con los negocios, y pone primero lo que alguien toco', () => {
    const r = resumirEventos(FILAS, SLUGS);
    expect(r.total).toBe(4);
    expect(r.por_evento).toEqual({ 'plan-bloqueo-visto': 3, 'plan-bloqueo-click': 1 });
    expect(r.bloqueos).toEqual([
      { funcion: 'cobros_online', vistos: 1, clicks: 1, negocios_que_vieron: ['la-nona-pato'], negocios_que_tocaron_ver_planes: ['la-nona-pato'] },
      { funcion: 'ganancia', vistos: 2, clicks: 0, negocios_que_vieron: ['la-nona-pato', 'monare'], negocios_que_tocaron_ver_planes: [] },
    ]);
  });

  it('sin filas da todo en cero', () => {
    expect(resumirEventos(null)).toEqual({ total: 0, por_evento: {}, bloqueos: [] });
  });
});

describe('lineasDeBloqueos', () => {
  it('sin eventos no agrega nada al reporte', () => {
    expect(lineasDeBloqueos(resumirEventos([]), '24h')).toEqual([]);
  });

  it('escapa el guion bajo para el Markdown de Telegram', () => {
    expect(lineasDeBloqueos(resumirEventos(FILAS, SLUGS), '24h')).toEqual([
      '📊 *Bloqueos de plan (24h)*',
      '• cobros\\_online: 1 vista, 1 en Ver planes (la-nona-pato)',
      '• ganancia: 2 vistas, nadie tocó Ver planes',
    ]);
  });
});
