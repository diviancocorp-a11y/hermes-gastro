import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Card, StatCard, Input, Badge, Avatar, Modal, ToastProvider } from '../components/ui';

describe('UI Components', () => {
  describe('Button', () => {
    it('renders with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('applies variant classes', () => {
      const { container } = render(<Button variant="danger">Delete</Button>);
      expect(container.firstChild).toHaveClass('bg-red-light');
    });

    it('disables when disabled prop is true', () => {
      render(<Button disabled>Nope</Button>);
      expect(screen.getByText('Nope')).toBeDisabled();
    });

    it('shows spinner when loading', () => {
      const { container } = render(<Button loading>Saving</Button>);
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
      expect(screen.getByText('Saving')).toBeDisabled();
    });
  });

  describe('Card', () => {
    it('renders children', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<Card className="mt-4">Test</Card>);
      expect(container.firstChild).toHaveClass('mt-4');
    });
  });

  describe('StatCard', () => {
    it('renders label and value', () => {
      render(<StatCard label="Revenue" value="$5,000" />);
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
    });

    it('renders detail text when provided', () => {
      render(<StatCard label="Sales" value="42" detail="+5 today" />);
      expect(screen.getByText('+5 today')).toBeInTheDocument();
    });
  });

  describe('Input', () => {
    it('renders with label', () => {
      render(<Input label="Email" placeholder="your@email.com" />);
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    });

    it('shows error message', () => {
      render(<Input label="Name" error="Required" />);
      expect(screen.getByText('Required')).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('renders with text', () => {
      render(<Badge variant="success">Active</Badge>);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('applies variant styles', () => {
      const { container } = render(<Badge variant="danger">Error</Badge>);
      expect(container.firstChild).toHaveClass('bg-red-light');
    });
  });

  describe('Avatar', () => {
    it('renders letter when no src', () => {
      render(<Avatar letter="N" />);
      expect(screen.getByText('N')).toBeInTheDocument();
    });

    it('renders image when src provided', () => {
      render(<Avatar src="https://example.com/img.jpg" alt="User" />);
      expect(screen.getByAltText('User')).toBeInTheDocument();
    });
  });

  describe('Modal', () => {
    it('renders nothing when open is false', () => {
      const { container } = render(<Modal open={false}>Hidden</Modal>);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders children when open', () => {
      render(<Modal open={true}>Visible content</Modal>);
      expect(screen.getByText('Visible content')).toBeInTheDocument();
    });
  });

  describe('ToastProvider', () => {
    it('renders children', () => {
      render(<ToastProvider><div>App</div></ToastProvider>);
      expect(screen.getByText('App')).toBeInTheDocument();
    });
  });
});
