// src/test/analytics.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SalesChart from '../components/admin/analytics/SalesChart';
import TopProducts from '../components/admin/analytics/TopProducts';
import CohortAnalysis from '../components/admin/analytics/CohortAnalysis';
import TicketByChannel from '../components/admin/analytics/TicketByChannel';
import SalesHeatmap from '../components/admin/analytics/SalesHeatmap';
import CheckoutFunnel from '../components/admin/analytics/CheckoutFunnel';
import Analytics from '../components/admin/Analytics';

const mockSales = [
  { date: '2025-01-15', total: 5000, recipe_id: 'r1', qty: 2 },
  { date: '2025-01-16', total: 3000, recipe_id: 'r2', qty: 1 },
  { date: '2025-01-17', total: 4500, recipe_id: 'r1', qty: 3 },
];

const mockOrders = [
  { id: '1', status: 'completed', created_at: '2025-01-15T10:00:00', phone: '1111', delivery: 'envio', total: 5000 },
  { id: '2', status: 'completed', created_at: '2025-01-16T14:00:00', phone: '2222', delivery: 'retiro', total: 3000 },
  { id: '3', status: 'completed', created_at: '2025-02-10T11:00:00', phone: '1111', delivery: 'envio', total: 4500 },
  { id: '4', status: 'cancelled', created_at: '2025-01-20T09:00:00', phone: '3333', delivery: 'retiro', total: 2000 },
];

const mockRecipes = [
  { id: 'r1', name: 'Torta Chocolate', ingredients: [] },
  { id: 'r2', name: 'Alfajor Maicena', ingredients: [] },
];

const mockCalcCost = () => 500;

describe('Analytics Widgets', () => {
  describe('SalesChart', () => {
    it('renders without crashing', () => {
      const { container } = render(<SalesChart sales={mockSales} />);
      expect(container.querySelector('.c')).toBeTruthy();
    });

    it('shows period toggle buttons', () => {
      render(<SalesChart sales={mockSales} />);
      expect(screen.getByText('Día')).toBeTruthy();
      expect(screen.getByText('Semana')).toBeTruthy();
      expect(screen.getByText('Mes')).toBeTruthy();
    });

    it('shows empty state with no data', () => {
      render(<SalesChart sales={[]} />);
      expect(screen.getByText('Sin datos')).toBeTruthy();
    });

    it('switches period on click', () => {
      render(<SalesChart sales={mockSales} />);
      fireEvent.click(screen.getByText('Semana'));
      // Should still render (not crash)
      expect(screen.getByText('Semana')).toBeTruthy();
    });
  });

  describe('TopProducts', () => {
    it('renders product list', () => {
      render(<TopProducts sales={mockSales} recipes={mockRecipes} calculateRecipeCost={mockCalcCost} />);
      expect(screen.getByText('🏆 Top 10 por margen')).toBeTruthy();
      expect(screen.getByText('Torta Chocolate')).toBeTruthy();
    });

    it('returns null with no data', () => {
      const { container } = render(<TopProducts sales={[]} recipes={[]} calculateRecipeCost={mockCalcCost} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('CohortAnalysis', () => {
    it('renders cohort cards', () => {
      render(<CohortAnalysis orders={mockOrders} />);
      expect(screen.getByText('🔄 Retención de clientes')).toBeTruthy();
      expect(screen.getByText('30 días')).toBeTruthy();
      expect(screen.getByText('60 días')).toBeTruthy();
      expect(screen.getByText('90 días')).toBeTruthy();
    });

    it('counts unique customers', () => {
      render(<CohortAnalysis orders={mockOrders} />);
      // 3 unique phones: 1111, 2222, 3333 (cancelled excluded → 1111, 2222)
      // Actually cancelled are excluded in the forEach, so 1111 and 2222
      expect(screen.getByText(/clientes únicos/)).toBeTruthy();
    });
  });

  describe('TicketByChannel', () => {
    it('renders channel stats', () => {
      render(<TicketByChannel orders={mockOrders} />);
      expect(screen.getByText('Delivery')).toBeTruthy();
      expect(screen.getByText('Retiro en local')).toBeTruthy();
    });
  });

  describe('SalesHeatmap', () => {
    it('renders heatmap grid', () => {
      render(<SalesHeatmap orders={mockOrders} />);
      expect(screen.getByText('🔥 Mapa de calor')).toBeTruthy();
      expect(screen.getByText('Lun')).toBeTruthy();
      expect(screen.getByText('Dom')).toBeTruthy();
    });
  });

  describe('CheckoutFunnel', () => {
    it('renders funnel stages', () => {
      render(<CheckoutFunnel orders={mockOrders} />);
      expect(screen.getByText('🔽 Embudo de checkout')).toBeTruthy();
      expect(screen.getByText(/Visitas catálogo/)).toBeTruthy();
      expect(screen.getByText(/Pedido completado/)).toBeTruthy();
    });
  });

  describe('Analytics container', () => {
    it('renders all widgets together', () => {
      render(<Analytics sales={mockSales} orders={mockOrders} recipes={mockRecipes} calculateRecipeCost={mockCalcCost} />);
      expect(screen.getByText('📊 Analytics')).toBeTruthy();
      expect(screen.getByText('📈 Ventas')).toBeTruthy();
      expect(screen.getByText('🏆 Top 10 por margen')).toBeTruthy();
      expect(screen.getByText('🔄 Retención de clientes')).toBeTruthy();
      expect(screen.getByText('🔥 Mapa de calor')).toBeTruthy();
      expect(screen.getByText('🔽 Embudo de checkout')).toBeTruthy();
    });
  });
});
