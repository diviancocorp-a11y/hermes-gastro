// Estetica de las pantallas del pedido para una plantilla exclusiva: la marca en
// <html>, la capa decorativa y la ruta de vista previa. El disenador cambia como
// se ve, nunca que hace: lo decorativo no puede tapar ni bloquear nada.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const captureException = vi.hoisted(() => vi.fn());
const fetchCatalog = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/observability', () => ({ captureException, captureMessage: vi.fn() }));
vi.mock('../hooks/useTasaCatalogo', () => ({ default: () => ({ activa: false, tasa: null, cargando: false }) }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: async () => 'cochi' }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc, functions: { invoke: vi.fn() } } }));
vi.mock('../lib/catalogService', () => ({ fetchCatalog }));
// El chunk del disenador, controlado por el test.
const decoraciones = vi.hoisted(() => ({ DECORACIONES: {} }));
vi.mock('../catalog-pro/plantillas/cochi/pantallas.js', () => decoraciones);

import usePantallasDePlantilla, {
  PantallasDePlantillaContext, plantillaActiva, plantillaExclusivaDe, CARGADORES,
} from '../catalog-pro/plantillas/pantallasDePlantilla';
import CapaDePlantilla from '../catalog-pro/plantillas/CapaDePlantilla';
import CheckoutScreen from '../catalog-pro/CheckoutScreen';
import VistaPreviaPantalla from '../pages/VistaPreviaPantalla';

const html = () => document.documentElement.dataset.plantilla;

beforeEach(() => {
  decoraciones.DECORACIONES = {};
  captureException.mockReset(); fetchCatalog.mockReset(); rpc.mockReset();
  window.sessionStorage.clear();
});
afterEach(() => { delete document.documentElement.dataset.plantilla; window.history.pushState({}, '', '/'); });

describe('usePantallasDePlantilla', () => {
  it('con plantilla cochi y slug cochi marca <html> y carga las decoraciones', async () => {
    const Pedido = () => null;
    decoraciones.DECORACIONES = { 'pedido-recibido': Pedido };
    const { result } = renderHook(() => usePantallasDePlantilla({ plantilla: 'cochi', slug: 'cochi' }));
    expect(html()).toBe('cochi');
    await waitFor(() => expect(result.current['pedido-recibido']).toBe(Pedido));
  });

  it('con pop, con otro slug o sin slug no marca nada ni baja el chunk', () => {
    const cargador = vi.spyOn(CARGADORES, 'cochi');
    for (const args of [{ plantilla: 'pop', slug: 'cochi' }, { plantilla: 'cochi', slug: 'otro' }, { plantilla: 'cochi', slug: null }, { plantilla: 'default', slug: 'cochi' }, {}]) {
      const { result, unmount } = renderHook(() => usePantallasDePlantilla(args));
      expect(html()).toBeUndefined();
      expect(result.current).toEqual({});
      unmount();
    }
    expect(cargador).not.toHaveBeenCalled();
    cargador.mockRestore();
  });

  it('al desmontar o al dejar de estar activa, quita la marca', () => {
    const { rerender, unmount } = renderHook((p) => usePantallasDePlantilla(p), { initialProps: { plantilla: 'cochi', slug: 'cochi' } });
    expect(html()).toBe('cochi');
    rerender({ plantilla: 'pop', slug: 'cochi' });
    expect(html()).toBeUndefined();
    rerender({ plantilla: 'cochi', slug: 'cochi' });
    expect(html()).toBe('cochi');
    unmount();
    expect(html()).toBeUndefined();
  });

  it('helpers: solo es activa si el slug es el dueno de la plantilla exclusiva', () => {
    expect(plantillaActiva('cochi', 'cochi')).toBe(true);
    expect(plantillaActiva('cochi', 'otro')).toBe(false);
    expect(plantillaActiva('pop', 'cochi')).toBe(false);
    expect(plantillaExclusivaDe('cochi')).toBe('cochi');
    expect(plantillaExclusivaDe('otro')).toBeNull();
  });
});

const conCapas = (capas, el) => <PantallasDePlantillaContext.Provider value={capas}>{el}</PantallasDePlantillaContext.Provider>;

describe('CapaDePlantilla', () => {
  it('sin decoracion no renderiza nada', () => {
    const { container } = render(<CapaDePlantilla lugar="ficha" datos={{ nombre: 'x' }} />);
    expect(container.innerHTML).toBe('');
  });

  it('con decoracion: aria-hidden, inert, sin eventos y con datos congelados', () => {
    let recibidos;
    const Deco = ({ datos }) => { recibidos = datos; return <span data-testid="deco">{datos.codigo}</span>; };
    const { container } = render(conCapas({ 'pedido-recibido': Deco }, <CapaDePlantilla lugar="pedido-recibido" datos={{ codigo: '#ABC123' }} />));
    const capa = container.querySelector('.capa-plantilla');
    expect(capa.getAttribute('aria-hidden')).toBe('true');
    expect(capa.hasAttribute('inert')).toBe(true);
    expect(capa.getAttribute('data-capa')).toBe('pedido-recibido');
    expect(screen.getByTestId('deco').textContent).toBe('#ABC123');
    expect(Object.isFrozen(recibidos)).toBe(true);
  });

  it('si la decoracion tira, no rompe la pantalla y se reporta', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Rota = () => { throw new Error('boom'); };
    const { container } = render(conCapas({ ficha: Rota }, <div><CapaDePlantilla lugar="ficha" datos={{}} /><p>contenido</p></div>));
    expect(screen.getByText('contenido')).toBeTruthy();
    expect(container.querySelector('.capa-plantilla').children.length).toBe(0);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1].tags.source).toBe('capa-plantilla');
    consola.mockRestore();
  });
});

describe('Checkout con una decoracion registrada', () => {
  it('"Completar pedido" sigue clickeable: el contenido esta encima de la capa', () => {
    const onSubmit = vi.fn();
    const Deco = () => <div data-testid="deco" style={{ position: 'absolute', inset: 0 }} />;
    const form = { name: 'Ana', phone: '1155', email: 'a@a.com', delivery: 'retiro', payment: 'efectivo', payment_account_id: null, change_amount: 'justo' };
    const items = [{ id: 'a', name: 'Pan', price: 1500, qty: 1, product_id: 'a' }];
    const props = {
      step: 2, onStepChange() {}, onClose() {}, form, sf() {}, navigate() {}, settings: {},
      scheduleMode: 'now', setScheduleMode() {}, storeStatus: { open: true }, addresses: [], estimateDelivery() {}, setDeliveryCost() {}, setDeliveryKm() {},
      deliveryCost: 0, deliveryKm: 0, cart: items, ct: 1500, ctWithDelivery: 1500, discount: 0, coupon: null, couponCode: '', tipAmount: 0, tip: 0, tipCap: 1500,
      receiptFile: null, setReceiptFile() {}, setReceiptPreview() {}, setTip() {}, setTipCustom() {}, setCouponCode() {}, setCoupon() {}, setCouponErr() {},
      onSubmit, haversine() {}, calcDeliveryCost() {}, payments: [], paymentIcon() {}, paymentLabel() {}, getAvailableHours() {}, setGeoLoading() {},
    };
    const { container } = render(conCapas({ checkout: Deco }, <CheckoutScreen {...props} />));
    const raiz = container.querySelector('[data-pantalla="checkout"]');
    expect(raiz.getAttribute('data-paso')).toBe('pago');
    // La capa es el primer hijo y va detras (z-index -1 por CSS); el boton no esta dentro de ella.
    expect(raiz.firstElementChild.className).toBe('capa-plantilla');
    const boton = screen.getByRole('button', { name: 'Completar pedido' });
    expect(raiz.firstElementChild.contains(boton)).toBe(false);
    expect(boton.getAttribute('data-parte')).toBe('completar');
    fireEvent.click(boton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('/vista-previa/:pantalla', () => {
  const montar = (url) => render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<p>catalogo</p>} />
        <Route path="/vista-previa/:pantalla" element={<VistaPreviaPantalla />} />
      </Routes>
    </MemoryRouter>,
  );

  it('fuera de vista previa redirige al catalogo', () => {
    montar('/vista-previa/pedido-recibido');
    expect(screen.getByText('catalogo')).toBeTruthy();
  });

  it('una pantalla que no existe redirige aunque haya vista previa', () => {
    window.history.pushState({}, '', '/?tenant=cochi');
    montar('/vista-previa/checkout');
    expect(screen.getByText('catalogo')).toBeTruthy();
  });

  it('en vista previa muestra el pedido recibido con datos de ejemplo y sin pedir ningun pedido', async () => {
    window.history.pushState({}, '', '/vista-previa/pedido-recibido?tenant=cochi');
    fetchCatalog.mockResolvedValue({ settings: { biz_name: 'Cochi', catalog_template: 'cochi' }, products: [] });
    const Deco = ({ datos }) => <span data-testid="deco">{datos.nombreLocal}</span>;
    decoraciones.DECORACIONES = { 'pedido-recibido': Deco };
    const { container } = montar('/vista-previa/pedido-recibido');
    expect(container.querySelector('[data-pantalla="pedido-recibido"]')).toBeTruthy();
    expect(screen.getByText('#AB12CD')).toBeTruthy();
    expect(screen.getByText(/datos de ejemplo/)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('deco').textContent).toBe('Cochi'));
    expect(html()).toBe('cochi');
    expect(rpc).not.toHaveBeenCalled(); // ni get_order_tracker ni nada de pedidos
  });

  it('el seguimiento de ejemplo usa la vista presentacional y respeta ?estado', () => {
    window.history.pushState({}, '', '/vista-previa/seguimiento?tenant=cochi');
    fetchCatalog.mockResolvedValue(null);
    const { container } = montar('/vista-previa/seguimiento?estado=active');
    expect(container.querySelector('[data-pantalla="seguimiento"]').getAttribute('data-estado')).toBe('active');
    expect(rpc).not.toHaveBeenCalled();
  });
});
