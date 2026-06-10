import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmationAnimation from '../components/catalog/ConfirmationAnimation.jsx';
import OrderSentView from '../components/catalog/OrderSentView.jsx';
// ProductCard tests removed in Sprint 3 — component muerto (el catalogo vivo usa cards de catalog-pro).
// VerificationScreen removed in FASE 3 (60s verification flow eliminated).

describe('ConfirmationAnimation', () => {
  it('renders confirmation text', () => {
    render(<ConfirmationAnimation />);
    expect(screen.getByText('¡Pedido confirmado!')).toBeInTheDocument();
    expect(screen.getByText(/Gracias por elegir/)).toBeInTheDocument();
  });

  it('renders SVG heart', () => {
    const { container } = render(<ConfirmationAnimation />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('OrderSentView', () => {
  const baseProps = {
    orderId: 'abc-def-123456',
    form: { payment: 'efectivo', delivery: 'retiro' },
    receiptFile: null,
    onReset: vi.fn(),
  };

  it('renders confirmation heading', () => {
    render(<OrderSentView {...baseProps} />);
    expect(screen.getByText('¡Pedido confirmado!')).toBeInTheDocument();
  });

  it('shows order code', () => {
    render(<OrderSentView {...baseProps} />);
    expect(screen.getByText('#123456')).toBeInTheDocument();
  });

  it('shows pickup info for retiro delivery', () => {
    render(<OrderSentView {...baseProps} settings={{ store_address: 'Andrés Chazarreta 1435' }} />);
    expect(screen.getByText(/Andrés Chazarreta 1435/)).toBeInTheDocument();
  });

  it('hides pickup info for envío delivery', () => {
    render(<OrderSentView {...baseProps} form={{ payment: 'efectivo', delivery: 'envio' }} settings={{ store_address: 'Andrés Chazarreta 1435' }} />);
    expect(screen.queryByText(/Andrés Chazarreta/)).not.toBeInTheDocument();
  });

  it('shows WhatsApp link for digital payment', () => {
    render(<OrderSentView {...baseProps} form={{ payment: 'transferencia', delivery: 'retiro' }} />);
    expect(screen.getByText(/WhatsApp/)).toBeInTheDocument();
  });

  it('calls onReset when back button clicked', () => {
    const onReset = vi.fn();
    render(<OrderSentView {...baseProps} onReset={onReset} />);
    fireEvent.click(screen.getByText('← Volver a la tienda'));
    expect(onReset).toHaveBeenCalled();
  });
});
