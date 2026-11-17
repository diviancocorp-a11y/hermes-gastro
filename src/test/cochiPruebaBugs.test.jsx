// Bugs de la prueba real de Cochi (17/nov): agregar rapido saltaba las opciones
// obligatorias, y la sugerencia de papas no llegaba a la ficha.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('../lib/activeTenant.js', () => ({ resolveTenantSlug: async () => 'cochi' }));

import { supabase } from '../lib/supabase';
import { fetchCatalog } from '../services/catalog.js';
import PopProductoCard from '../catalog-pro/plantillas/PopProductoCard';
import ProductDetailScreen from '../catalog-pro/ProductDetailScreen';
import { requiereOpciones } from '../lib/opcionesPedido';

const grupoObligatorio = {
  id: 'proteina', name: 'Elige tenders o alitas', type: 'single', required: true,
  choices: [{ id: 'tenders', label: 'Tenders' }, { id: 'alitas', label: 'Alitas' }],
};
const bandeja = { id: 'b1', name: 'Bandeja 3 carnes', category: 'Bandejas', sale_price: 17, option_groups: [grupoObligatorio] };
const shawarma = { id: 's1', name: 'Shawarma César', category: 'Shawarmas', sale_price: 8, option_groups: [] };
const sandwich = { id: 's2', name: 'Shawarma de Pollo', category: 'Sandwiches', sale_price: 7, option_groups: null };
const papas = { id: '4ba8c89f-9dcd-4fbf-86a0-49b6dcb71398', name: 'Papas fritas pequeñas', category: 'Extras', sale_price: 1.5 };
const reglaPapas = {
  id: 'r1', title: 'Agrégale papas fritas', body: null, when_categories: ['Shawarmas', 'Sandwiches'],
  add_product_id: papas.id, special_price: 1, max_per_item: 1, days: [], start_time: null, end_time: null,
  start_date: null, end_date: null,
};

const vista = (raw) => ({ raw, id: raw.id, name: raw.name, desc: '', price: raw.sale_price, oldPrice: null, img: null, soldOut: false, tag: null, disp: { puede: true, etiqueta: null } });

function card(raw, cantidad = 0) {
  const onAgregar = vi.fn(); const onAbrir = vi.fn();
  render(<PopProductoCard v={vista(raw)} moneda={{ principal: 'USD', secundaria: null, tasa: null }}
    cantidadDe={() => cantidad} onAgregar={onAgregar} onQuitar={() => {}} onAbrir={onAbrir} />);
  return { onAgregar, onAbrir };
}

describe('agregar rapido con opciones obligatorias', () => {
  it('requiereOpciones: required o min>=1; opcionales y sin grupos no', () => {
    expect(requiereOpciones(bandeja)).toBe(true);
    expect(requiereOpciones({ option_groups: [{ id: 'g', type: 'multiple', min: 1, choices: [{ id: 'a' }] }] })).toBe(true);
    expect(requiereOpciones({ option_groups: [{ id: 'g', type: 'multiple', choices: [{ id: 'a' }] }] })).toBe(false);
    expect(requiereOpciones(shawarma)).toBe(false);
    expect(requiereOpciones(sandwich)).toBe(false);
  });

  it('Agregar abre la ficha y no suma al carrito', () => {
    const { onAgregar, onAbrir } = card(bandeja);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Bandeja 3 carnes' }));
    expect(onAbrir).toHaveBeenCalledWith(bandeja);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('el + de una linea que ya esta en el carrito tampoco duplica sin opcion', () => {
    const { onAgregar, onAbrir } = card(bandeja, 1);
    fireEvent.click(screen.getByRole('button', { name: /Sumar una unidad/ }));
    expect(onAbrir).toHaveBeenCalledWith(bandeja);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('un producto sin opciones se agrega directo', () => {
    const { onAgregar, onAbrir } = card(shawarma);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Shawarma César' }));
    expect(onAgregar).toHaveBeenCalledWith(shawarma);
    expect(onAbrir).not.toHaveBeenCalled();
  });
});

describe('sugerencia de papas a $1 en los shawarmas', () => {
  it('fetchCatalog entrega suggestions del RPC (causa: las descartaba)', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { settings: {}, products: [shawarma], suggestions: [reglaPapas], serverNow: 'x' }, error: null });
    const data = await fetchCatalog();
    expect(data.suggestions).toEqual([reglaPapas]);
    supabase.rpc.mockResolvedValueOnce({ data: { settings: {}, products: [] }, error: null });
    expect((await fetchCatalog()).suggestions).toEqual([]);
  });

  it.each([[shawarma], [sandwich]])('la ficha de %o ofrece las papas a $1', (producto) => {
    render(<ProductDetailScreen product={producto} soldOutIds={new Set()} hasDeal={() => false}
      dealPrice={(p) => Number(p.sale_price)} suggestions={[reglaPapas]} allProducts={[producto, papas]}
      timezone="America/Caracas" onAddToCart={() => {}} />);
    expect(screen.getByLabelText(/Agrégale papas fritas/)).toBeTruthy();
  });
});
