// P0 del catalogo publico (docs/plataforma/CATALOGO-MEJORAS.md):
//   1. sin estrellas ni opiniones inventadas;
//   2. esqueleto (y aviso sin conexion) en vez de "0 productos" al arrancar;
//   3. --ac-on con contraste AA contra --ac en los tres temas;
//   4. carrito guardado por tenant, que vence y se valida al leer.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HomeScreen from '../catalog-pro/HomeScreen';
import ProductDetailScreen from '../catalog-pro/ProductDetailScreen';
import CategoryScreen from '../catalog-pro/CategoryScreen';
import { mapProduct } from '../catalog-pro/homeHelpers';
import * as homeHelpers from '../catalog-pro/homeHelpers';
import {
  leerCarrito, leerCarritoGuardado, guardarCarrito, borrarCarrito, validarCarrito, avisoDelCarrito,
  claveCarrito, decidirPedidoMp, CARRITO_VENCE_MS, CARRITO_QTY_MAX,
} from '../lib/carritoGuardado';

vi.mock('../catalog-pro/OrderStatusCard', () => ({ default: () => null }));
vi.mock('../catalog-pro/ReservarEntrada', () => ({ default: () => null }));
vi.mock('../catalog-pro/CatalogMusicToggle', () => ({ default: () => null }));
vi.mock('../catalog-pro/PromoCarousel', () => ({ default: () => null }));
vi.mock('../catalog-pro/SuperCombos', () => ({ default: () => null }));

afterEach(cleanup);

const productos = [
  { id: 'a', name: 'Producto A', sale_price: 1000, description: 'Uno', image_url: '/a.png', category: 'Varios' },
  { id: 'b', name: 'Producto B', sale_price: 2000, description: 'Dos', image_url: '/b.png', category: 'Varios' },
];

// ── 1. Sin resenas inventadas ─────────────────────────────────────────
describe('catalogo sin estrellas ni opiniones inventadas', () => {
  // Un numero tipo "4.7" suelto o "(123)" es lo que pintaba el Rating.
  const pareceRating = /^\s*[1-5][.,]\d\s*$|^\(\d+\)$|opiniones|Qué dicen|Mejor valorados/i;

  it('mapProduct ya no fabrica rating ni reviews', () => {
    const p = mapProduct(productos[0]);
    expect(p).not.toHaveProperty('rating');
    expect(p).not.toHaveProperty('reviews');
    expect(homeHelpers).not.toHaveProperty('ratingFor');
    expect(homeHelpers).not.toHaveProperty('reviewsFor');
  });

  it('el Home no muestra puntajes en las tarjetas', () => {
    const { container } = render(<HomeScreen products={productos} categories={[{ name: 'Todos' }]} />);
    expect(screen.getAllByText('Producto A').length).toBeGreaterThan(0);
    const textos = [...container.querySelectorAll('*')].filter(n => n.children.length === 0).map(n => n.textContent);
    expect(textos.filter(t => pareceRating.test(t))).toEqual([]);
  });

  it('el detalle no tiene la seccion "Qué dicen" ni la cantidad de opiniones', () => {
    const { container } = render(<ProductDetailScreen product={productos[0]} />);
    expect(screen.queryByText(/Qué dicen/)).not.toBeInTheDocument();
    expect(screen.queryByText(/opiniones/)).not.toBeInTheDocument();
    const textos = [...container.querySelectorAll('*')].filter(n => n.children.length === 0).map(n => n.textContent);
    expect(textos.filter(t => pareceRating.test(t))).toEqual([]);
  });

  it('la categoria no ordena por "mas pedidos" ni "mejor valorados"', () => {
    render(<CategoryScreen categoryName="Varios" products={productos} />);
    fireEvent.click(screen.getByRole('button', { name: /Orden de la carta/ }));
    expect(screen.queryByText('Mejor valorados')).not.toBeInTheDocument();
    expect(screen.queryByText('Más pedidos')).not.toBeInTheDocument();
  });
});

// ── 2. Arranque ───────────────────────────────────────────────────────
describe('arranque del catalogo', () => {
  it('mientras carga muestra el esqueleto, nunca "0 productos" ni el vacio de filtros', () => {
    const { container } = render(<HomeScreen loading products={[]} settings={{}} store={{ name: 'Dico', isOpen: false, openHint: 'todavía no toma pedidos' }} />);
    expect(container.querySelector('.cp-arranque.cp-root')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando la carta');
    expect(screen.queryByText(/0 productos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No encontramos productos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/todavía no toma pedidos/)).not.toBeInTheDocument();
    // Sin cache no se muestra el nombre de respaldo del build.
    expect(screen.queryByText('Dico')).not.toBeInTheDocument();
  });

  it('con la identidad de la visita anterior pinta nombre y reserva las barras', () => {
    const { container } = render(<HomeScreen loading products={[]} identidad={{ nombre: 'Negocio de prueba', slogan: 'Eslogan' }} barras={2} />);
    expect(screen.getByText('Negocio de prueba')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando la carta de Negocio de prueba');
    expect(container.querySelectorAll('.cp-arr-barra')).toHaveLength(2);
  });

  it('sin conexion muestra el aviso de la conexion con reintentar', () => {
    const onRetry = vi.fn();
    render(<HomeScreen error="offline" products={[]} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Estás sin conexión');
    expect(screen.getByRole('alert')).toHaveTextContent('internet');
    expect(screen.queryByText(/0 productos/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('un error del servidor no culpa a la conexion', () => {
    render(<HomeScreen error="servidor" products={[]} onRetry={() => {}} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos cargar la carta');
    expect(alerta).toHaveTextContent('Probá de nuevo en un momento');
    expect(alerta).not.toHaveTextContent(/conexión|internet/);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('el aviso de carga queda afuera de la region aria-busy y el titulo no usa .h-1', () => {
    const { container } = render(<HomeScreen loading products={[]} />);
    const estado = screen.getByRole('status');
    expect(estado.closest('[aria-busy="true"]')).toBeNull();
    expect(container.querySelector('.h-1, .h-2')).toBeNull();
    expect(screen.getByRole('heading', { name: /Qué te/ })).toHaveClass('cp-arr-saludo-titulo');
  });

  it('cuando llegan los datos vuelve el Home de siempre', () => {
    render(<HomeScreen products={productos} categories={[{ name: 'Todos' }]} />);
    expect(screen.getByRole('region', { name: 'Filtros del catálogo' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el brillo del esqueleto se apaga con reduced motion', () => {
    const css = readFileSync(resolve('src/catalog-pro/arranque.css'), 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.cp-arr-hueso\s*{[^}]*animation:\s*none/);
  });
});

// ── 3. Contraste de --ac-on ────────────────────────────────────────────
const tokensCss = readFileSync(resolve('src/catalog-pro/tokens.css'), 'utf8');

function bloque(selector) {
  const i = tokensCss.indexOf(selector);
  if (i < 0) throw new Error(`no esta ${selector}`);
  const abre = tokensCss.indexOf('{', i);
  return tokensCss.slice(abre + 1, tokensCss.indexOf('}', abre));
}
function vars(texto) {
  const out = {};
  for (const m of texto.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
function resolver(tabla, valor, n = 0) {
  const m = /^var\((--[\w-]+)\)$/.exec(valor);
  if (!m) return valor;
  if (n > 5 || !tabla[m[1]]) throw new Error(`no resuelve ${valor}`);
  return resolver(tabla, tabla[m[1]], n + 1);
}
function luminancia(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const base = vars(bloque('.cp-root {'));
const temas = {
  ambar: { ...base, ...vars(bloque('[data-cp-theme="ambar"] .cp-root')) },
  noche: { ...base, ...vars(bloque('[data-cp-theme="noche"] .cp-root')) },
  carbon: { ...base, ...vars(bloque('[data-cp-theme="carbon"] .cp-root')) },
};

describe('--ac-on: texto sobre el color de marca', () => {
  for (const [tema, tabla] of Object.entries(temas)) {
    it(`${tema}: >= 4.5:1 contra --ac y contra --ac2 (hover)`, () => {
      const on = resolver(tabla, tabla['--ac-on']);
      expect(contraste(on, resolver(tabla, tabla['--ac']))).toBeGreaterThanOrEqual(4.5);
      expect(contraste(on, resolver(tabla, tabla['--ac2']))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('el boton primario usa --ac-on y no blanco', () => {
    expect(tokensCss).toMatch(/\.btn-primary\s*{[^}]*color:\s*var\(--ac-on\)/);
  });

  it('ningun color blanco fijo sobre var(--ac) en el catalogo', () => {
    const archivos = [
      'src/catalog-pro/AgeGate.jsx', 'src/catalog-pro/CartScreen.jsx', 'src/catalog-pro/CheckoutScreen.jsx',
      'src/catalog-pro/HomeScreen.jsx', 'src/catalog-pro/OrdersScreen.jsx', 'src/catalog-pro/PushOptInBanner.jsx',
      'src/catalog-pro/ProductDetailScreen.jsx', 'src/catalog-pro/SchedulePicker.jsx', 'src/catalog-pro/atoms.jsx',
      'src/catalog-pro/BirthdayGift.jsx', 'src/pages/Catalog.jsx',
    ];
    const malos = [];
    for (const f of archivos) {
      const lineas = readFileSync(resolve(f), 'utf8').split('\n');
      lineas.forEach((l, i) => {
        if (/background:\s*"var\(--ac(, #[0-9A-Fa-f]+)?\)",\s*color:\s*"(#fff|#FFF|white|var\(--bg\))"/.test(l)) malos.push(`${f}:${i + 1}`);
      });
    }
    expect(malos).toEqual([]);
  });
});

// ── 4. Carrito guardado ────────────────────────────────────────────────
describe('carrito guardado por tenant', () => {
  beforeEach(() => localStorage.clear());
  const linea = { id: 'a', product_id: 'a', name: 'Producto A', price: 1000, qty: 2 };

  it('cada tenant tiene su clave y no se mezclan', () => {
    guardarCarrito('negocio-uno', [linea]);
    guardarCarrito('negocio-dos', [{ ...linea, id: 'b', product_id: 'b', name: 'Producto B' }]);
    expect(claveCarrito('negocio-uno')).not.toBe(claveCarrito('negocio-dos'));
    expect(leerCarrito('negocio-uno').map(i => i.id)).toEqual(['a']);
    expect(leerCarrito('negocio-dos').map(i => i.id)).toEqual(['b']);
    expect(leerCarrito('negocio-tres')).toEqual([]);
  });

  it('sin slug no guarda nada', () => {
    guardarCarrito(null, [linea]);
    expect(localStorage.length).toBe(0);
  });

  it('vence a las 24 h y se borra', () => {
    const t0 = 1_700_000_000_000;
    guardarCarrito('negocio-uno', [linea], t0);
    expect(leerCarrito('negocio-uno', t0 + CARRITO_VENCE_MS - 1)).toHaveLength(1);
    expect(leerCarrito('negocio-uno', t0 + CARRITO_VENCE_MS + 1)).toEqual([]);
    expect(localStorage.getItem(claveCarrito('negocio-uno'))).toBeNull();
  });

  it('un guardado roto o de otro tenant copiado a mano se descarta', () => {
    localStorage.setItem(claveCarrito('negocio-uno'), '{roto');
    expect(leerCarrito('negocio-uno')).toEqual([]);
    localStorage.setItem(claveCarrito('negocio-uno'), JSON.stringify({ v: 1, slug: 'otro', guardado: Date.now(), items: [linea] }));
    expect(leerCarrito('negocio-uno')).toEqual([]);
  });

  it('descarta lineas con cantidad no entera, cero o por encima del tope', () => {
    localStorage.setItem(claveCarrito('negocio-uno'), JSON.stringify({
      v: 1, slug: 'negocio-uno', guardado: Date.now(),
      items: [linea, { ...linea, id: 'f', qty: 1.5 }, { ...linea, id: 'g', qty: 0 },
        { ...linea, id: 'h', qty: CARRITO_QTY_MAX + 1 }, { ...linea, id: 'i', qty: '2' }, { ...linea, id: 'j', qty: CARRITO_QTY_MAX }],
    }));
    expect(leerCarrito('negocio-uno').map(i => i.id)).toEqual(['a', 'j']);
  });

  it('guarda el pedido MP pendiente junto al carrito y lo devuelve al leer', () => {
    guardarCarrito('negocio-uno', [linea], Date.now(), { mpPedido: 'pedido-1' });
    expect(leerCarritoGuardado('negocio-uno')).toEqual({ items: [linea], mpPedido: 'pedido-1' });
    guardarCarrito('negocio-uno', [linea]);
    expect(leerCarritoGuardado('negocio-uno').mpPedido).toBeNull();
    borrarCarrito('negocio-uno');
    expect(localStorage.getItem(claveCarrito('negocio-uno'))).toBeNull();
  });

  it('decide si el pedido MP se reusa, se rehace o ya se pago', () => {
    expect(decidirPedidoMp({ status: 'pending_payment', payment_status: 'rejected' })).toBe('reusar');
    expect(decidirPedidoMp({ status: 'pending_payment', payment_status: null })).toBe('reusar');
    expect(decidirPedidoMp(null, { fallo: true })).toBe('reusar');
    expect(decidirPedidoMp(null)).toBe('nuevo');
    expect(decidirPedidoMp({ status: 'cancelled' })).toBe('nuevo');
    expect(decidirPedidoMp({ status: 'pending_payment', payment_status: 'approved' })).toBe('pagado');
    expect(decidirPedidoMp({ status: 'new', payment_status: 'approved' })).toBe('pagado');
  });

  it('vaciar el carrito borra la clave', () => {
    guardarCarrito('negocio-uno', [linea]);
    guardarCarrito('negocio-uno', []);
    expect(localStorage.getItem(claveCarrito('negocio-uno'))).toBeNull();
  });

  it('al leer descarta lo que ya no existe o esta agotado y actualiza precios', () => {
    const guardado = [
      linea,
      { id: 'b', product_id: 'b', name: 'Producto B', price: 2000, qty: 1 },
      { id: 'x', product_id: 'x', name: 'Producto borrado', price: 500, qty: 1 },
      { id: 'c__Grande', product_id: 'c', size_label: 'Grande', name: 'Producto C · Grande', price: 900, qty: 1 },
      { id: 'c__Chica', product_id: 'c', size_label: 'Chica', name: 'Producto C · Chica', price: 400, qty: 1 },
    ];
    const catalogo = [
      { id: 'a', name: 'Producto A', sale_price: 1200 },
      { id: 'b', name: 'Producto B', sale_price: 2000 },
      { id: 'c', name: 'Producto C', sale_price: 0, sizes: [{ label: 'Grande', qty: 1, price: 900 }] },
      { id: 'd', name: 'Producto D', sale_price: 10 },
    ];
    const r = validarCarrito(guardado, catalogo, {
      precioDe: p => p.sale_price, agotados: new Set(['b']),
    });
    expect(r.items.map(i => [i.id, i.price, i.qty])).toEqual([['a', 1200, 2], ['c__Grande', 900, 1]]);
    expect(r.quitados).toEqual(['Producto B', 'Producto borrado', 'Producto C · Chica']);
    expect(r.actualizados).toEqual(['Producto A']);
    expect(avisoDelCarrito(r)).toBe('Sacamos 3 productos del carrito: ya no están disponibles. Actualizamos el precio de Producto A.');
    expect(avisoDelCarrito({ quitados: [], actualizados: [] })).toBeNull();
  });
});
