// src/test/exports.test.js
import { describe, it, expect } from 'vitest';
import {
  generateCSV,
  prepareSalesExport,
  prepareExpensesExport,
  prepareInventoryExport,
  prepareOrdersExport,
} from '../lib/exports';

describe('Export Utilities', () => {
  describe('generateCSV', () => {
    it('generates valid CSV with headers and rows', () => {
      const csv = generateCSV(['Name', 'Amount'], [['Torta', 5000], ['Alfajor', 2000]]);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Name,Amount');
      expect(lines[1]).toBe('Torta,5000');
      expect(lines[2]).toBe('Alfajor,2000');
    });

    it('escapes commas in values', () => {
      const csv = generateCSV(['Name'], [['Torta, grande']]);
      expect(csv).toContain('"Torta, grande"');
    });

    it('escapes double quotes', () => {
      const csv = generateCSV(['Name'], [['Torta "especial"']]);
      expect(csv).toContain('"Torta ""especial"""');
    });

    it('handles null and undefined values', () => {
      const csv = generateCSV(['A', 'B'], [[null, undefined]]);
      expect(csv.split('\n')[1]).toBe(',');
    });
  });

  describe('prepareSalesExport', () => {
    it('returns correct headers and rows', () => {
      const sales = [
        { date: '2025-01-15', recipe_id: 'r1', qty: 2, total: 5000, payment_method: 'efectivo' },
      ];
      const recipes = [{ id: 'r1', name: 'Torta Chocolate' }];
      const { headers, rows } = prepareSalesExport(sales, recipes);

      expect(headers).toContain('Fecha');
      expect(headers).toContain('Producto');
      expect(headers).toContain('Total');
      expect(rows[0][0]).toBe('2025-01-15');
      expect(rows[0][1]).toBe('Torta Chocolate');
      expect(rows[0][2]).toBe(2);
      expect(rows[0][3]).toBe(5000);
    });

    it('handles missing recipe gracefully', () => {
      const sales = [{ date: '2025-01-15', recipe_id: 'missing', qty: 1, total: 1000 }];
      const { rows } = prepareSalesExport(sales, []);
      expect(rows[0][1]).toBe('missing'); // falls back to recipe_id
    });
  });

  describe('prepareExpensesExport', () => {
    it('returns correct structure', () => {
      const expenses = [
        { date: '2025-01-15', description: 'Harina', category: 'Ingredientes', amount: 5000, supplier: 'Molinos' },
      ];
      const { headers, rows } = prepareExpensesExport(expenses);
      expect(headers.length).toBe(5);
      expect(rows[0][1]).toBe('Harina');
      expect(rows[0][3]).toBe(5000);
    });
  });

  describe('prepareInventoryExport', () => {
    it('returns correct structure', () => {
      const ingredients = [
        { name: 'Harina', qty: 50, unit: 'kg', min: 10, cost: 500 },
      ];
      const { headers, rows } = prepareInventoryExport(ingredients);
      expect(headers).toContain('Ingrediente');
      expect(rows[0][0]).toBe('Harina');
      expect(rows[0][1]).toBe(50);
    });
  });

  describe('prepareOrdersExport', () => {
    it('returns correct structure with item names', () => {
      const orders = [
        { created_at: '2025-01-15', customer: 'Ana', phone: '1111', status: 'completed', delivery: 'envio', total: 5000, items: [{ id: 'r1', qty: 2 }] },
      ];
      const recipes = [{ id: 'r1', name: 'Torta' }];
      const { headers, rows } = prepareOrdersExport(orders, recipes);
      expect(headers).toContain('Cliente');
      expect(rows[0][1]).toBe('Ana');
      expect(rows[0][6]).toContain('Torta x2');
    });

    it('handles empty items', () => {
      const orders = [{ created_at: '2025-01-15', customer: 'Ana', total: 1000, items: [] }];
      const { rows } = prepareOrdersExport(orders, []);
      expect(rows[0][6]).toBe('');
    });
  });
});
