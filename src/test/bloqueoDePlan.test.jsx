import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../components/ConfirmSlideProvider', () => ({
  useConfirm: () => async () => false,
}));
vi.mock('../lib/observability', () => ({ trackEvent: vi.fn() }));
vi.mock('../services/eventosApp', () => ({ registrarEvento: vi.fn() }));
// El CRM real consulta cupones y settings: aca solo importa SI se monta.
vi.mock('../components/admin/CRM', () => ({ default: () => <div>CRM del negocio</div> }));
vi.mock('../services/platformPagos', () => ({
  estadoMercadoPago: vi.fn(async () => ({ conectado: false })),
  conectarMercadoPago: vi.fn(),
}));

import { registrarEvento as trackEvent } from '../services/eventosApp';
import { estadoMercadoPago } from '../services/platformPagos';
import BloqueoDePlan, { AvisoDePrueba } from '../components/admin/platform/BloqueoDePlan';
import VentasPanel from '../components/admin/platform/VentasPanel';
import ResultadoDelDia from '../components/admin/platform/ResultadoDelDia';
import CobrosOnline from '../components/admin/platform/CobrosOnline';
import CajaPanel from '../components/admin/platform/CajaPanel';
import MonthSummary from '../components/admin/MonthSummary';
import { contarClientesInactivos } from '../modules/clientesInactivos';

const BASE = {
  sales: [], orders: [], products: [], ingredients: [], expenses: [],
  showToast: vi.fn(), sucursal: null,
  settings: { promo_cumple: true }, onGuardarSettings: vi.fn(async () => true),
};

const CLIENTES = [
  { name: 'Ana', days_since_last_order: 10 },
  { name: 'Beto', days_since_last_order: 90 },
  { name: 'Caro', days_since_last_order: 91 },
  { name: 'Dani', days_since_last_order: 400 },
  { name: 'Eli', days_since_last_order: null },
];

beforeEach(() => { vi.mocked(trackEvent).mockClear(); });

describe('contarClientesInactivos', () => {
  it('cuenta los que compraron por ultima vez hace MAS de 90 dias, como el CRM', () => {
    expect(contarClientesInactivos(CLIENTES)).toBe(2);
  });
  it('sin clientes da 0', () => {
    expect(contarClientesInactivos(null)).toBe(0);
    expect(contarClientesInactivos([])).toBe(0);
  });
});

describe('BloqueoDePlan', () => {
  it('dice el dato, la accion y el plan minimo, y registra la vista una vez', () => {
    const { rerender } = render(
      <BloqueoDePlan funcion="crm" titulo="Clientes" dato="Tenés 23 clientes que no compran hace 3 meses." detalle="Verlos y escribirles" />
    );
    expect(screen.getByRole('region', { name: 'Clientes' })).toBeTruthy();
    expect(screen.getByText('Tenés 23 clientes que no compran hace 3 meses.')).toBeTruthy();
    expect(screen.getByText(/Verlos y escribirles está en/).textContent).toBe('Verlos y escribirles está en Dante.');
    rerender(<BloqueoDePlan funcion="crm" titulo="Clientes" dato="otro" detalle="Verlos y escribirles" />);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('plan-bloqueo-visto', { funcion: 'crm' });
  });

  it('remontarlo (navegar dias, ir y volver de una solapa) no cuenta otra vista', () => {
    const { unmount } = render(<BloqueoDePlan funcion="historial_completo" titulo="Historial" />);
    unmount();
    render(<BloqueoDePlan funcion="historial_completo" titulo="Historial" />);
    const vistos = vi.mocked(trackEvent).mock.calls
      .filter(([n, p]) => n === 'plan-bloqueo-visto' && p.funcion === 'historial_completo');
    expect(vistos).toHaveLength(1);
  });

  it('acepta un nivel de encabezado', () => {
    render(<BloqueoDePlan funcion="soporte_chat" titulo="Soporte" nivel={4} />);
    expect(screen.getByRole('heading', { level: 4, name: 'Soporte' })).toBeTruthy();
  });

  it('el CTA abre los planes en otra pestaña y registra el click', () => {
    render(<BloqueoDePlan funcion="consolidado" titulo="Consolidado" />);
    expect(screen.getByText(/Está en/).textContent).toBe('Está en Magnus.');
    const cta = screen.getByRole('link', { name: /Ver planes/ });
    expect(cta.getAttribute('href')).toBe('https://divianco.app/#comparar-planes');
    expect(cta.getAttribute('target')).toBe('_blank');
    expect(cta.getAttribute('rel')).toContain('noopener');
    fireEvent.click(cta);
    expect(trackEvent).toHaveBeenCalledWith('plan-bloqueo-click', { funcion: 'consolidado' });
  });
});

describe('AvisoDePrueba', () => {
  it('dice cuantos dias quedan, y sin prueba no se dibuja', () => {
    const { container, rerender } = render(<AvisoDePrueba dias={null} />);
    expect(container.textContent).toBe('');
    rerender(<AvisoDePrueba dias={9} />);
    expect(screen.getByRole('status').textContent).toBe('Estás probando Dante: te quedan 9 días.');
    rerender(<AvisoDePrueba dias={1} />);
    expect(screen.getByRole('status').textContent).toBe('Estás probando Dante: te queda 1 día.');
  });
});

describe('VentasPanel segun el plan', () => {
  const abrirClientes = () => fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));

  it('en Paris el CRM y las promos quedan bloqueados, con los clientes perdidos reales', async () => {
    const onFetchClientesConEstado = vi.fn(async () => ({ ok: true, clientes: CLIENTES }));
    render(<VentasPanel {...BASE} plan="digital" onFetchClientesConEstado={onFetchClientesConEstado} />);
    abrirClientes();

    expect(screen.queryByText('CRM del negocio')).toBeNull();
    expect(screen.queryByText('Promos del catálogo', { selector: 'div' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Promos del catálogo' })).toBeTruthy();
    expect(await screen.findByText('Tenés 2 clientes que no compran hace 3 meses.')).toBeTruthy();
    expect(screen.getByText(/Verlos y escribirles está en/)).toBeTruthy();
    expect(onFetchClientesConEstado).toHaveBeenCalledTimes(1);
    // Los bloqueos son h3: la solapa trae su h2.
    expect(screen.getByRole('heading', { level: 2, name: 'Clientes' })).toBeTruthy();
  });

  it('en Paris con la base caida no afirma ningun numero', async () => {
    const onFetchClientesConEstado = vi.fn(async () => ({ ok: false }));
    render(<VentasPanel {...BASE} plan="digital" onFetchClientesConEstado={onFetchClientesConEstado} />);
    abrirClientes();
    await waitFor(() => expect(onFetchClientesConEstado).toHaveBeenCalled());
    expect(screen.queryByText(/clientes que no compran|no tenés clientes/)).toBeNull();
    expect(screen.getByText(/Verlos y escribirles está en/)).toBeTruthy();
  });

  it('en Paris sin clientes perdidos avisa que Dante los marca cuando pase', async () => {
    render(<VentasPanel {...BASE} plan="digital" onFetchClientesConEstado={vi.fn(async () => ({ ok: true, clientes: [CLIENTES[0]] }))} />);
    abrirClientes();
    expect(await screen.findByText(/no tenés clientes que hayan dejado de comprar/)).toBeTruthy();
    expect(screen.getByText(/avise cuando alguno deje de venir está en/)).toBeTruthy();
  });

  it.each([[null], ['local']])('con plan %s se ve el CRM como siempre', (plan) => {
    const onFetchClientes = vi.fn(async () => CLIENTES);
    render(<VentasPanel {...BASE} plan={plan} onFetchClientes={onFetchClientes} />);
    abrirClientes();
    expect(screen.getByText('CRM del negocio')).toBeTruthy();
    expect(screen.queryByRole('region', { name: /Clientes que dejaron de venir/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Ver planes/ })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Clientes' })).toBeNull();
  });
});

describe('Resumen del mes segun el plan', () => {
  const mes = new Date().toISOString().slice(0, 7);
  const SALES = [{ id: 's1', date: mes + '-02', total: 12345, qty: 1, recipe_id: 'r1' }];
  const props = {
    sales: SALES, expenses: [], orders: [], recipes: [], ingredients: [], waste: [],
    settings: {}, calculateRecipeCost: () => 0, onBack: vi.fn(), permiteUsar: false,
  };

  it('en Paris se ve lo vendido y el resultado queda en el bloqueo', () => {
    render(<MonthSummary {...props} bloqueoDeGanancia={<BloqueoDePlan funcion="ganancia" titulo="La ganancia del mes" encajado />} />);
    expect(screen.getAllByText('$12.345').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ganancia neta')).toBeNull();
    expect(screen.queryByText('Margen bruto')).toBeNull();
    expect(screen.queryByText('Análisis automático')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Exportar informe del mes' })).toBeNull();
    expect(screen.getByRole('region', { name: 'La ganancia del mes' })).toBeTruthy();
  });

  it('sin bloqueo se ve el resultado como siempre', () => {
    render(<MonthSummary {...props} />);
    expect(screen.getByText('Ganancia neta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exportar informe del mes' })).toBeTruthy();
  });

  it('VentasPanel en Paris le pasa el bloqueo al Resumen', () => {
    render(<VentasPanel {...BASE} sales={SALES} plan="digital" />);
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    expect(screen.getByRole('region', { name: 'La ganancia del mes' })).toBeTruthy();
    expect(screen.queryByText('Ganancia neta')).toBeNull();
  });
});

describe('ResultadoDelDia sin ganancia', () => {
  const DIA = {
    dia: '2026-10-15', ventas: 15000, descuentos: 1000, costo_mercaderia: 3800,
    lineas_sin_costo: 1, tickets: 2, nomina: 8000, horas: 4, merma: 1300,
    gastos_del_dia: 2000, gastos_fijos: 1000, ganancia_neta: -2100,
  };
  const SUCURSAL = { id: 'b-1', name: 'Casa central' };

  it('muestra lo vendido y bloquea la ganancia y la cuenta', async () => {
    render(<ResultadoDelDia sucursal={SUCURSAL} verGanancia={false} cargar={vi.fn(async () => ({ ok: true, data: DIA }))} />);
    expect(await screen.findByText('Ventas del día')).toBeTruthy();
    expect(screen.getByText('$15.000')).toBeTruthy();
    expect(screen.queryByText('−$2.100')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('region', { name: 'La ganancia del día' })).toBeTruthy();
  });
});

describe('CobrosOnline segun el plan', () => {
  beforeEach(() => { vi.mocked(estadoMercadoPago).mockClear(); });

  it('en Paris no muestra el formulario ni consulta MercadoPago', () => {
    render(<CobrosOnline plan="digital" showToast={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Cobrar online con Mercado Pago' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(estadoMercadoPago).not.toHaveBeenCalled();
  });

  it('sin plan sigue como siempre', async () => {
    render(<CobrosOnline plan={null} showToast={vi.fn()} />);
    await waitFor(() => expect(estadoMercadoPago).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /Ver planes/ })).toBeNull();
  });
});

describe('Caja: factura ARCA segun el plan', () => {
  const turno = { id: 't-1', business_day: '2026-09-09', opened_at: '2026-09-09T12:00:00Z', opening_amount: 1000 };
  const perfil = { enabled: true, point_of_sale: 3, environment: 'homologation' };

  it('en Paris va el bloqueo en vez del estado fiscal', () => {
    render(<CajaPanel turno={turno} esperado={0} perfilFiscal={perfil} documentosFiscales={[]} plan="digital" />);
    expect(screen.getByRole('region', { name: 'Factura electrónica' })).toBeTruthy();
    expect(screen.getByText('No incluida')).toBeTruthy();
    expect(screen.queryByText('PV 00003 · Homologación')).toBeNull();
    expect(screen.queryByText(/comprobantes requieren seguimiento/)).toBeNull();
  });

  it('en Paris sigue contando los comprobantes trabados de la prueba', () => {
    render(<CajaPanel turno={turno} esperado={0} perfilFiscal={perfil} plan="digital"
      documentosFiscales={[{ id: 'f1', status: 'rejected' }, { id: 'f2', status: 'retry_required' }, { id: 'f3', status: 'authorized' }]} />);
    expect(screen.getByText('2 comprobantes requieren seguimiento')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Factura electrónica' })).toBeTruthy();
  });

  it('sin plan muestra el estado fiscal como siempre', () => {
    render(<CajaPanel turno={turno} esperado={0} perfilFiscal={perfil} documentosFiscales={[]} plan={null} />);
    expect(screen.getByText('PV 00003 · Homologación')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Factura electrónica' })).toBeNull();
  });
});
