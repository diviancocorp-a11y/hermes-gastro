import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from '../components/catalog/ProductCard.jsx';
import ConfirmationAnimation from '../components/catalog/ConfirmationAnimation.jsx';
import OrderSentView from '../components/catalog/OrderSentView.jsx';
// VerificationScreen removed in FASE 3 (60s verification flow eliminated).

describe('ProductCard', () => {
  const baseProps = {
    p: { id: '1', name: 'Alfajor', description: 'Rico alfajor', category: 'Alfajores', sale_price: 1000, image_url: '' },
    qty: 0,
    hasDeal: false,
    dealPrice: 0,
    originalPrice: 1000,
    onAdd: vi.fn(),
    onUpdate: vi.fn(),
    isFav: false,
    onToggleFav: vi.fn(),
    isLoggedIn: false,
  };

  it('renders product name and description', () => {
    render(<ProductCard {...baseProps} />);
    expect(screen.getByText('Alfajor')).toBeInTheDocument();
    expect(screen.getByText('Rico alfajor')).toBeInTheDocument();
  });

  it('shows add button when qty is 0', () => {
    render(<ProductCard {...baseProps} />);
    const addBtn = document.querySelector('.btn-add');
    expect(addBtn).toBeInTheDocument();
  });

  it('shows quantity controls when qty > 0', () => {
    render(<ProductCard {...baseProps} qty={2} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows deal pricing when hasDeal', () => {
    render(<ProductCard {...baseProps} hasDeal={true} dealPrice={850} originalPrice={1000} />);
    expect(document.querySelector('.price-old')).toBeInTheDocument();
    expect(document.querySelector('.price-deal')).toBeInTheDocument();
    expect(document.querySelector('.prod-deal-tag')).toBeInTheDocument();
  });

  it('shows favorite button only when logged in', () => {
    const { container, rerender } = render(<ProductCard {...baseProps} isLoggedIn={false} />);
    expect(screen.queryByText('🤍')).not.toBeInTheDocument();

    rerender(<ProductCard {...baseProps} isLoggedIn={true} />);
    expect(screen.getByText('🤍')).toBeInTheDocument();
  });

  it('calls onToggleFav when fav button clicked', () => {
    const onToggleFav = vi.fn();
    render(<ProductCard {...baseProps} isLoggedIn={true} onToggleFav={onToggleFav} />);
    fireEvent.click(screen.getByText('🤍'));
    expect(onToggleFav).toHaveBeenCalledWith('1');
  });

  it('shows filled heart when isFav', () => {
    render(<ProductCard {...baseProps} isLoggedIn={true} isFav={true} />);
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });
});

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

// VerificationScreen tests removed in FASE 3 — component deleted.

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
