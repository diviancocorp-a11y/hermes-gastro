// src/test/analytics.test.jsx
// Reescrito en Sprint 3: los widgets ahora reciben Wrapper (AnaCard) que
// renderiza title/meta; el DefaultCard interno los descarta. Los tests viejos
// renderizaban sin Wrapper y buscaban titulos con emojis que ya no existen.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SalesChart from '../components/admin/analytics/SalesChart';
import TopProducts from '../components/admin/analytics/TopProducts';
import CohortAnalysis from '../components/admin/analytics/CohortAnalysis';
import TicketByChannel from '../components/admin/analytics/TicketByChannel';
import SalesHeatmap from '../components/admin/analytics/SalesHeatmap';
import CheckoutFunnel from '../components/admin/analytics/CheckoutFunnel';
import Analytics from '../components/admin/Analytics';

// Wrapper de test minimo con el mismo contrato que AnaCard: { title, meta, children }
function TestCard({ title, meta, children }) {
  return (
    <div className="test-card">
      <div className="test-card-title">{title}</div>
      <div className="test-card-meta">{meta}</div>
      {children}
    </div>
  );
}

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
    it('renders without crashing (svg presente con datos)', () => {
      const { container } = render(<SalesChart sales={mockSales} Wrapper={TestCard} />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('shows period toggle buttons (van en meta del Card)', () => {
      render(<SalesChart sales={mockSales} Wrapper={TestCard} />);
      expect(screen.getByText('Día')).toBeTruthy();
      expect(screen.getByText('Semana')).toBeTruthy();
      expect(screen.getByText('Mes')).toBeTruthy();
    });

    it('shows empty state with no data', () => {
      render(<SalesChart sales={[]} Wrapper={TestCard} />);
      expect(screen.getByText('Sin datos')).toBeTruthy();
    });

    it('switches period on click', () => {
      render(<SalesChart sales={mockSales} Wrapper={TestCard} />);
      fireEvent.click(screen.getByText('Semana'));
      expect(screen.getByText('Semana')).toBeTruthy();
    });
  });

  describe('TopProducts', () => {
    it('renders product list', () => {
      render(<TopProducts sales={mockSales} recipes={mockRecipes} calculateRecipeCost={mockCalcCost} Wrapper={TestCard} />);
      expect(screen.getByText('Top 10 por margen')).toBeTruthy();
      expect(screen.getByText('Torta Chocolate')).toBeTruthy();
    });

    it('returns null with no data', () => {
      const { container } = render(<TopProducts sales={[]} recipes={[]} calculateRecipeCost={mockCalcCost} Wrapper={TestCard} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('CohortAnalysis', () => {
    it('renders cohort cards', () => {
      render(<CohortAnalysis orders={mockOrders} Wrapper={TestCard} />);
      expect(screen.getByText('Retención de clientes')).toBeTruthy();
    });

    it('counts unique customers (meta "N únicos")', () => {
      render(<CohortAnalysis orders={mockOrders} Wrapper={TestCard} />);
      expect(screen.getByText(/únicos/)).toBeTruthy();
    });
  });

  describe('TicketByChannel', () => {
    it('renders channel stats', () => {
      render(<TicketByChannel orders={mockOrders} Wrapper={TestCard} />);
      expect(screen.getByText(/Delivery/)).toBeTruthy();
    });
  });

  describe('SalesHeatmap', () => {
    it('renders heatmap grid', () => {
      render(<SalesHeatmap orders={mockOrders} Wrapper={TestCard} />);
      expect(screen.getByText('Mapa de calor')).toBeTruthy();
    });
  });

  describe('CheckoutFunnel', () => {
    it('renders funnel stages', () => {
      render(<CheckoutFunnel orders={mockOrders} Wrapper={TestCard} />);
      expect(screen.getByText('Embudo de checkout')).toBeTruthy();
    });
  });

  describe('Analytics container', () => {
    it('renders all widgets together (titulos via AnaCard real)', () => {
      render(<Analytics sales={mockSales} orders={mockOrders} recipes={mockRecipes} calculateRecipeCost={mockCalcCost} />);
      expect(screen.getByText('Ventas en el tiempo')).toBeTruthy();
      expect(screen.getByText('Top 10 por margen')).toBeTruthy();
      expect(screen.getByText('Retención de clientes')).toBeTruthy();
      expect(screen.getByText('Mapa de calor')).toBeTruthy();
      expect(screen.getByText('Embudo de checkout')).toBeTruthy();
    });
  });
});
