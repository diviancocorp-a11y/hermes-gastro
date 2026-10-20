// La compra de insumos es inventario, no gasto: lo que cuesta es lo vendido.
// Mismo criterio en el dia (resultado_del_dia, 0108, test SQL en
// platform/tests/resultado_del_dia.sql) y en el mes (MonthSummary y UsarPnL).
// Antes, la compra del edificio (category 'Materia Prima', usar_category
// null) se restaba entera como gasto ademas del costo segun recetas.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { esCompraDeInsumos } from '../constants/usar';
import MonthSummary from '../components/admin/MonthSummary';
import UsarPnL from '../components/admin/UsarPnL';

// Una fila tal cual la asienta register_purchase (0098)
const COMPRA_EDIFICIO = {
  id: 'e-compra', description: 'Compra de insumos', amount: 5000,
  category: 'Materia Prima', expense_type: 'variable', usar_category: null,
  items: [{ name: 'Harina', qty: 10, unit: 'kg', unit_cost: 500, subtotal: 5000 }],
};
// Las del legacy: una fila por categoria de alimento
const COMPRA_LEGACY = {
  id: 'e-legacy', description: 'Compra materia prima — Secos', amount: 700,
  category: 'Materia Prima', expense_type: 'variable', usar_category: 'food_dry',
};
// Un gasto de verdad, cargado a mano
const GAS = {
  id: 'e-gas', description: 'Gas', amount: 2000,
  category: 'Servicios', expense_type: 'variable', usar_category: 'utilities',
};

function hoyISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function filaDe(label) {
  return screen.getByText(label).parentElement.textContent;
}

describe('esCompraDeInsumos', () => {
  it('la compra del edificio es compra aunque no tenga usar_category', () => {
    expect(esCompraDeInsumos(COMPRA_EDIFICIO)).toBe(true);
  });

  it('las del legacy, por usar_category food_* o packaging', () => {
    expect(esCompraDeInsumos(COMPRA_LEGACY)).toBe(true);
    expect(esCompraDeInsumos({ amount: 1, usar_category: 'packaging' })).toBe(true);
  });

  it('un gasto cargado a mano no es compra', () => {
    expect(esCompraDeInsumos(GAS)).toBe(false);
    expect(esCompraDeInsumos({ amount: 1, category: 'Otros', usar_category: null })).toBe(false);
    expect(esCompraDeInsumos(null)).toBe(false);
  });
});

describe('el mes no resta la compra como gasto', () => {
  const dia = hoyISO();
  // 1 venta de 10000 con receta de costo 3000
  const receta = { id: 'r-1', name: 'Pizza' };
  const sales = [{ id: 's-1', date: dia, recipe_id: 'r-1', qty: 1, total: 10000 }];
  const expenses = [
    { ...COMPRA_EDIFICIO, date: dia },
    { ...GAS, date: dia },
  ];

  it('MonthSummary: ganancia = ventas - costo segun recetas - gastos no-compra', () => {
    render(
      <MonthSummary
        sales={sales}
        expenses={expenses}
        recipes={[receta]}
        calculateRecipeCost={() => 3000}
        permiteUsar={false}
      />
    );
    // 10000 - 3000 - 2000. Con el bug: 10000 - 3000 - 7000 = 0
    expect(filaDe('− Gastos del mes')).toContain('−$2.000');
    expect(filaDe('Ganancia neta')).toContain('$5.000');
  });

  it('UsarPnL: la compra no cae en "Otros" del OPEX', () => {
    render(
      <UsarPnL
        orders={[{ id: 'o-1', status: 'completed', total: 10000, delivery_channel: 'mostrador' }]}
        expenses={expenses}
      />
    );
    expect(filaDe('Otros (alquiler, servicios)')).toContain('-$2.000');
    // sin ventas con receta el COGS es 0: 10000 - 2000
    expect(filaDe('EBITDA (ganancia operativa)')).toContain('$8.000');
  });
});
