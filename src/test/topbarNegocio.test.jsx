import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LogoNegocio, VerCatalogo } from '../components/admin/platform/TopbarNegocio';

describe('LogoNegocio (burbuja del perfil)', () => {
  it('muestra el logo, decorativo, cuando hay logo_url', () => {
    const { container } = render(<LogoNegocio url="https://cdn.test/logo.png" />);
    const img = container.querySelector('img.ag-sesion-logo');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://cdn.test/logo.png');
    expect(img.getAttribute('alt')).toBe('');
  });

  it.each([undefined, null, '', '   '])('no renderiza nada con logo_url=%j', (url) => {
    const { container } = render(<LogoNegocio url={url} />);
    expect(container.firstChild).toBeNull();
  });

  it('sin logo renderiza el fallback', () => {
    const { container } = render(<LogoNegocio url="" fallback="AP" />);
    expect(container.textContent).toBe('AP');
  });

  it('desaparece si la imagen falla y vuelve a intentar con un logo nuevo', () => {
    const { container, rerender } = render(<LogoNegocio url="https://cdn.test/roto.png" />);
    fireEvent.error(container.querySelector('img'));
    expect(container.firstChild).toBeNull();
    rerender(<LogoNegocio url="https://cdn.test/nuevo.png" />);
    expect(container.querySelector('img').getAttribute('src')).toBe('https://cdn.test/nuevo.png');
  });
});

describe('VerCatalogo (cabecera de Productos)', () => {
  it('abre la raiz del mismo host en pestaña nueva y con rel seguro', () => {
    render(<VerCatalogo />);
    const a = screen.getByRole('link', { name: /ver catálogo/i });
    expect(a.getAttribute('href')).toBe('/');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('aria-label')).toBe('Ver catálogo (se abre en otra pestaña)');
    expect(a.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Ver catálogo: de la topbar a Productos', () => {
  const ADMIN = readFileSync(join(process.cwd(), 'src', 'pages', 'PlatformAdmin.jsx'), 'utf8');
  const bloque = (desde, hasta) => ADMIN.slice(ADMIN.indexOf(desde), ADMIN.indexOf(hasta, ADMIN.indexOf(desde)));

  it('la cabecera de Productos lo monta, fuera del permiso de editar', () => {
    const cabecera = bloque('ag-productos-head-superior', 'ag-productos-head-resumen');
    expect(cabecera).toContain('<VerCatalogo />');
    expect(cabecera.indexOf('<VerCatalogo />')).toBeLessThan(cabecera.indexOf('puedeEditarProductos'));
  });

  it('la topbar ya no lo monta ni lleva el logo a la izquierda', () => {
    const topbar = bloque('<header className="ag-topbar', '</header>');
    expect(topbar).not.toContain('VerCatalogo');
    expect(topbar).not.toContain('LogoNegocio');
    expect(topbar).toContain('logoUrl={sett?.logo_url}');
  });
});
