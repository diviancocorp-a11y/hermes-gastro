import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

const ThrowError = () => { throw new Error('Test error'); };
const GoodChild = () => <div>All good</div>;

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  const origError = console.error;
  beforeEach(() => { console.error = vi.fn(); });
  afterEach(() => { console.error = origError; });

  it('renders children when no error', () => {
    render(<ErrorBoundary><GoodChild /></ErrorBoundary>);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('catches error and shows fallback UI', () => {
    render(<ErrorBoundary><ThrowError /></ErrorBoundary>);
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByText('Recargar página')).toBeInTheDocument();
  });

  it('shows reload button that calls window.location.reload', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });
    render(<ErrorBoundary><ThrowError /></ErrorBoundary>);
    fireEvent.click(screen.getByText('Recargar página'));
    expect(reloadMock).toHaveBeenCalled();
  });
});
