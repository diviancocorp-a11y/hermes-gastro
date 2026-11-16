// Ficha con opciones y sugerencia + editor del panel (Cochi fase 4, 0135).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductDetailScreen from '../catalog-pro/ProductDetailScreen';
import { normalizarGrupos, gruposAFormulario } from '../lib/opcionesEditor';
import { OptionGroupsSchema } from '../lib/schemas/index.js';
import { validarSugerencia } from '../services/platformAdmin';

const bandeja = {
  id: 'p1', name: 'Bandeja 3 carnes', category: 'Bandejas', sale_price: 17, description: 'x',
  option_groups: [
    { id: 'proteina', name: 'Elige tenders o alitas', type: 'single', required: true,
      choices: [{ id: 'tenders', label: 'Tenders' }, { id: 'alitas', label: 'Alitas' }] },
    { id: 'extras', name: 'Extras', type: 'multiple', max: 2,
      choices: [{ id: 'queso', label: 'Queso', price: 1.5, max_qty: 2 }, { id: 'bacon', label: 'Bacon', price: 2 }, { id: 'huevo', label: 'Huevo', price: 1 }] },
  ],
};
const papas = { id: 'p2', name: 'Papas fritas pequeñas', category: 'Extras', sale_price: 1.5 };
const regla = {
  id: 'r1', title: 'Agrégale papas', body: null, when_categories: ['Bandejas'], add_product_id: 'p2',
  special_price: 1, max_per_item: 1, days: [], start_time: null, end_time: null, start_date: null, end_date: null,
};

function ficha(extra = {}) {
  const onAddToCart = vi.fn();
  render(<ProductDetailScreen product={bandeja} soldOutIds={new Set()} hasDeal={() => false}
    dealPrice={(p) => Number(p.sale_price)} suggestions={[regla]} allProducts={[bandeja, papas]}
    timezone="America/Caracas" onAddToCart={onAddToCart} {...extra} />);
  return onAddToCart;
}

describe('ficha con opciones', () => {
  it('no agrega sin completar lo obligatorio y marca el grupo', () => {
    const onAdd = ficha();
    fireEvent.click(screen.getByText('Agregar al pedido'));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Obligatorio/i).length).toBeGreaterThan(0);
  });

  it('manda seleccion, nota y extras; la sugerencia viaja como linea propia', () => {
    const onAdd = ficha();
    fireEvent.click(screen.getByLabelText('Alitas'));
    fireEvent.click(screen.getByLabelText(/Bacon/));
    fireEvent.click(screen.getByLabelText(/Agrégale papas/));
    fireEvent.change(screen.getByPlaceholderText(/Sin sal/), { target: { value: '  sin\ncebolla ' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [prod, qty, size, extra] = onAdd.mock.calls[0];
    expect(prod.id).toBe('p1');
    expect(qty).toBe(1);
    expect(size).toBeNull();
    expect(extra.selection).toEqual([
      { groupId: 'proteina', choiceId: 'alitas', qty: 1 },
      { groupId: 'extras', choiceId: 'bacon', qty: 1 },
    ]);
    expect(extra.note).toBe('sin cebolla');
    expect(extra.extrasPrice).toBe(2);
    expect(extra.suggestion).toMatchObject({ unitPrice: 1, qty: 1 });
    expect(extra.suggestion.rule.id).toBe('r1');
  });

  it('un producto sin opciones se agrega como siempre', () => {
    const onAdd = vi.fn();
    render(<ProductDetailScreen product={{ id: 'x', name: 'Cafe', category: 'Bebidas', sale_price: 3 }}
      soldOutIds={new Set()} hasDeal={() => false} dealPrice={(p) => Number(p.sale_price)} onAddToCart={onAdd} />);
    fireEvent.click(screen.getByText('Agregar al pedido'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][3].selection).toEqual([]);
    expect(onAdd.mock.calls[0][3].suggestion).toBeNull();
  });

  it('el maximo de un grupo deshabilita las demas casillas', () => {
    ficha();
    fireEvent.click(screen.getByLabelText(/Queso/));
    fireEvent.click(screen.getByLabelText(/Bacon/));
    expect(screen.getByLabelText(/Huevo/).disabled).toBe(true);
  });
});

describe('editor del panel', () => {
  it('normaliza ids, descarta vacios y valida con el mismo Zod que guarda', () => {
    const grupos = normalizarGrupos([
      { name: ' Elegí la salsa ', type: 'single', required: true, max: '', choices: [
        { label: 'Agridulce', price: '', max_qty: '' }, { label: 'Al ajillo', price: '0.5' }, { label: '  ' },
      ] },
      { name: '', choices: [{ label: 'x' }] },
      { name: 'Extras', type: 'multiple', required: false, max: '9', choices: [{ label: 'Queso', price: '1.5', max_qty: '2' }] },
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0]).toMatchObject({ id: 'elegi-la-salsa', name: 'Elegí la salsa', required: true });
    expect(grupos[0].choices.map(c => c.id)).toEqual(['agridulce', 'al-ajillo']);
    expect(grupos[0].choices[1].price).toBe(0.5);
    expect(grupos[1].max).toBe(1); // no puede superar la cantidad de opciones
    expect(OptionGroupsSchema.safeParse(grupos).success).toBe(true);
  });

  it('conserva los ids ya guardados al editar y repetidos se desambiguan', () => {
    const guardado = [{ id: 'proteina', name: 'Proteina', type: 'single', required: true, choices: [{ id: 'tenders', label: 'Tenders' }] }];
    const form = gruposAFormulario(guardado);
    form[0].name = 'Elegí proteína';
    form[0].choices.push({ label: 'Tenders' });
    const salida = normalizarGrupos(form);
    expect(salida[0].id).toBe('proteina');
    expect(salida[0].choices.map(c => c.id)).toEqual(['tenders', 'tenders-2']);
  });

  it('la sugerencia pide titulo, categorias y un maximo valido', () => {
    expect(validarSugerencia({ title: '', when_categories: [], max_per_item: 0 }).length).toBe(3);
    expect(validarSugerencia({ title: 'Papas', when_categories: ['Shawarmas'], special_price: '1', max_per_item: 1 })).toEqual([]);
  });
});
