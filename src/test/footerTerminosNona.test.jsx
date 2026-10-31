// Footer del catalogo: La Nona Pato muestra los terminos de la plataforma
// (protegen a Dico) y no el link al libro de quejas; los demas tenants no cambian.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../lib/activeTenant', () => ({ getTenantSlugSync: vi.fn() }));

import { getTenantSlugSync } from '../lib/activeTenant';
import CatalogFooter from '../catalog-pro/CatalogFooter';

const settings = { biz_name: 'La Nona Pato' };

describe('CatalogFooter: terminos por tenant', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('la-nona-pato: terminos de Dico y sin libro de quejas', () => {
    getTenantSlugSync.mockReturnValue('la-nona-pato');
    render(<CatalogFooter settings={settings} />);
    expect(screen.queryByText('Libro de quejas')).toBeNull();
    fireEvent.click(screen.getByText('Términos y condiciones'));
    expect(screen.getByText(/Existen para proteger a Dico/)).toBeTruthy();
    expect(screen.getByText(/No tienen nada que ver con La Nona Pato/)).toBeTruthy();
  });

  it('otro tenant: terminos del negocio y libro de quejas intactos', () => {
    getTenantSlugSync.mockReturnValue('crazy-miga');
    render(<CatalogFooter settings={{ biz_name: 'Crazy Miga' }} />);
    expect(screen.getByText('Libro de quejas')).toBeTruthy();
    fireEvent.click(screen.getByText('Términos y condiciones'));
    expect(screen.queryByText(/Existen para proteger a Dico/)).toBeNull();
    expect(screen.getByText(/Estos términos rigen el uso del catálogo público de Crazy Miga/)).toBeTruthy();
  });
});
