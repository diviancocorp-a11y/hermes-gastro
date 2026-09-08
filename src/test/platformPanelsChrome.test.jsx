import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
// El confirm de borrado abre un provider con animaciones; para estos tests
// alcanza con que exista la funcion.
vi.mock('../components/ConfirmSlideProvider', () => ({
  useConfirm: () => async () => false,
}));

import ProductsPanel from '../components/admin/platform/ProductsPanel';
import OrdersPanel from '../components/admin/platform/OrdersPanel';
import FinanzasPanel from '../components/admin/platform/FinanzasPanel';

// Lo minimo para montar FinanzasPanel sin tocar la base.
const finanzasProps = {
  expenses: [], setExpenses: vi.fn(),
  ingredients: [], setIngredients: vi.fn(),
  settings: {}, user: null, showToast: vi.fn(), recargar: vi.fn(),
  onCrearGasto: vi.fn(), onAnularGasto: vi.fn(),
  onRegistrarCompra: vi.fn(), onCrearInsumo: vi.fn(),
  onFetchProveedores: vi.fn().mockResolvedValue([]),
  onSaveProveedor: vi.fn(), onToggleProveedor: vi.fn(), onDeleteProveedor: vi.fn(),
};

// El bug que estos tests cuidan (16/ago): las pestanias principales usaban
// `ag-page-over` como contenedor raiz. Esa clase es un overlay full-screen
// (position:fixed, z-index 950) y admin-shared.css tiene una regla explicita:
//
//   body:has(.ag-page-over) .ag-topbar,
//   body:has(.ag-page-over) .ag-bottom-nav { display: none; }
//
// O sea que el panel entero quedaba sin engranaje y sin barra de navegacion.
// Lo peor: el header y el nav SI se renderizaban, solo que tapados — asi que
// en el DOM estaba todo bien y en pantalla no habia nada. No hay test de
// integracion que lo agarre; hay que mirar la clase.
//
// Los overlays de verdad (el formulario de alta/edicion) si deben usarla: ahi
// tapar la navegacion es el comportamiento buscado.

function raiz(container) {
  return container.firstElementChild;
}

describe('las pestañas principales no tapan el chrome del panel', () => {
  it('ProductsPanel no usa ag-page-over en su raiz', () => {
    const { container } = render(
      <ProductsPanel products={[]} vertical="gastro" loading={false}
        onSave={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} showToast={vi.fn()} />
    );
    expect(raiz(container).className).not.toContain('ag-page-over');
    expect(container.querySelector('.ag-page-over')).toBeNull();
  });

  it('OrdersPanel no usa ag-page-over en su raiz', () => {
    const { container } = render(
      <OrdersPanel orders={[]} loading={false} onSetStatus={vi.fn()} showToast={vi.fn()} />
    );
    expect(raiz(container).className).not.toContain('ag-page-over');
    expect(container.querySelector('.ag-page-over')).toBeNull();
  });

  // Suppliers es el caso peligroso: su raiz NORMAL es `.ag-page-over` (en el
  // admin viejo se abre desde el menu ☰ y taparlo todo esta bien). Dentro del
  // panel del edificio es una solapa, no un takeover — por eso va con asPage.
  it('ninguna solapa de Finanzas usa ag-page-over, incluida Proveedores', async () => {
    const { container } = render(<FinanzasPanel {...finanzasProps} />);
    expect(raiz(container).className || '').not.toContain('ag-page-over');
    expect(container.querySelector('.ag-page-over')).toBeNull();

    for (const solapa of ['Compra', 'Proveedores']) {
      screen.getByRole('button', { name: solapa }).click();
      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: solapa }).getAttribute('aria-current')).toBe('page');
      });
      expect(container.querySelector('.ag-page-over'), solapa).toBeNull();
    }
  });

  it('un rubro sin stock no ve la solapa de Compra', () => {
    render(<FinanzasPanel {...finanzasProps} permiteCompras={false} />);
    expect(screen.queryByRole('button', { name: 'Compra' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Proveedores' })).toBeTruthy();
  });

  it('el formulario de producto SI puede taparlo: es un takeover con Atrás', async () => {
    const { container } = render(
      <ProductsPanel products={[]} vertical="gastro" loading={false}
        onSave={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} showToast={vi.fn()} />
    );
    screen.getByRole('button', { name: /Agregar/i }).click();
    // Tras abrir el formulario, el overlay es esperable.
    await vi.waitFor(() => {
      expect(container.querySelector('.ag-page-over')).not.toBeNull();
    });
    expect(screen.getByRole('button', { name: /Volver/i })).toBeTruthy();
  });
});

describe('terminología por rubro en las pestañas', () => {
  // El contrato es "la pantalla habla el idioma del rubro", y sigue vigente.
  // Lo que cambio en Phase 4 es DONDE se cumple: ProductsPanel ya no dibuja un
  // <h2> con el plural, porque el shell (`.ag-section-title` en PlatformAdmin)
  // ya ponia ese mismo titulo con la misma terminologia — la pantalla decia
  // "Productos" dos veces, en dos tipografias. Aca se verifica el termino en
  // los dos lugares del componente que siguen expresandolo: el CTA (singular)
  // y el buscador (frase propia del rubro).
  const casos = [
    { vertical: 'gastro', singular: 'producto', buscar: 'Buscar producto...' },
    { vertical: 'barber', singular: 'servicio', buscar: 'Buscar servicio...' },
    { vertical: 'retail', singular: 'artículo', buscar: 'Buscar artículo...' },
  ];

  for (const { vertical, singular, buscar } of casos) {
    it(`${vertical} nombra lo que vende: ${singular}`, () => {
      render(<ProductsPanel
        products={[{ id: 'p1', name: 'Uno', price: 100, active: true, category: 'Cat' }]}
        vertical={vertical} loading={false}
        onSave={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} showToast={vi.fn()} />);
      expect(screen.getByRole('button', { name: `+ Agregar ${singular}` })).toBeTruthy();
      expect(screen.getByPlaceholderText(buscar)).toBeTruthy();
    });

    it(`${vertical} NO repite el titulo de seccion que ya pone el shell`, () => {
      render(<ProductsPanel products={[]} vertical={vertical} loading={false}
        onSave={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} showToast={vi.fn()} />);
      // Si alguien vuelve a agregar el <h2>, la pantalla queda otra vez con el
      // titulo duplicado y este caso lo agarra.
      expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    });
  }
});

describe('acciones en vivo de Productos', () => {
  it('Impulsar emite una orden directa y muestra el destino resuelto', () => {
    const onImpulsar = vi.fn(() => true);
    render(<ProductsPanel
      products={[{
        id: 'p1', name: 'Negroni', price: 5000, stock: 10, active: true, category: 'Cócteles',
      }]}
      vertical="gastro"
      loading={false}
      operativo
      orders={[]}
      itemsPorPedido={new Map()}
      recetas={new Map()}
      ingredientes={[]}
      onImpulsar={onImpulsar}
      onSave={vi.fn()}
      onToggleActive={vi.fn()}
      onDelete={vi.fn()}
      showToast={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Impulsar' }));

    expect(onImpulsar).toHaveBeenCalledWith(expect.objectContaining({
      destino: { area: 'barra', etiqueta: 'equipo de barra' },
    }));
    expect(screen.getByText('Dico avisó a equipo de barra')).toBeTruthy();
    expect(screen.queryByText(/brief activo/i)).toBeNull();
  });

  it('en mobile nace plegado arriba y avisa cuantos impulsos esperan', () => {
    const matchMediaOriginal = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    const ahora = Date.now();
    try {
      const { container } = render(<ProductsPanel
        products={[{
          id: 'p1', name: 'Negroni', price: 5000, stock: 10, active: true, category: 'Cócteles',
        }]}
        vertical="gastro"
        loading={false}
        operativo
        minutosOperando={65}
        turno={{ opened_at: new Date(ahora - 65 * 60000).toISOString() }}
        orders={[{
          id: 'o1', status: 'completed', created_at: new Date(ahora - 10 * 60000).toISOString(),
        }]}
        itemsPorPedido={new Map()}
        recetas={new Map()}
        ingredientes={[]}
        onImpulsar={vi.fn(() => true)}
        onSave={vi.fn()}
        onToggleActive={vi.fn()}
        onDelete={vi.fn()}
        showToast={vi.fn()}
      />);

      const cuerpo = container.querySelector('.ag-productos-cuerpo');
      expect(cuerpo.firstElementChild).toHaveClass('ag-productos-categorias');
      expect(container.querySelector('.ag-gestion-productos')).toHaveClass('esta-operativo');
      expect(screen.getByLabelText('1 impulsos pendientes')).toBeTruthy();
      expect(screen.queryByText('+')).toBeNull();
      expect(screen.queryByText('−')).toBeNull();
      expect(screen.queryByText(/transacciones hoy/)).toBeNull();
      expect(container.querySelector('.ag-gestion-flecha')).not.toHaveClass('esta-abierta');

      fireEvent.click(screen.getByRole('button', { name: 'Abrir acciones de Dico' }));
      expect(container.querySelector('.ag-gestion-flecha')).toHaveClass('esta-abierta');
      expect(container.querySelector('.ag-gestion-alcance').textContent)
        .toBe('01:05 operando · 1 transacción hoy');
    } finally {
      window.matchMedia = matchMediaOriginal;
    }
  });

  it('cerrado presenta el último análisis y permite cambiar el período', () => {
    const matchMediaOriginal = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    try {
      const { container } = render(<ProductsPanel
        products={[{ id: 'p1', name: 'Uno', price: 100, active: true, category: 'Cat' }]}
        vertical="gastro"
        loading={false}
        operativo={false}
        orders={[]}
        itemsPorPedido={new Map()}
        recetas={new Map()}
        ingredientes={[]}
        turnosPrevios={[{
          id: 't1', status: 'closed', business_day: '2026-09-06',
          opened_at: '2026-09-06T17:00:00Z', closed_at: '2026-09-07T02:00:00Z',
        }]}
        onSave={vi.fn()}
        onToggleActive={vi.fn()}
        onDelete={vi.fn()}
        showToast={vi.fn()}
      />);

      expect(screen.getByText('DICO ANALIZA')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Ingeniería de menú' })).toBeTruthy();
      expect(container.querySelector('.ag-gestion-flecha')).not.toHaveClass('esta-abierta');
      fireEvent.click(screen.getByRole('button', { name: 'Abrir acciones de Dico' }));
      expect(container.querySelector('.ag-gestion-flecha')).toHaveClass('esta-abierta');
      expect(screen.getByText(/Último análisis/)).toBeTruthy();
      expect(screen.getByRole('combobox', { name: 'Período del análisis' }).value).toBe('turno');
      fireEvent.click(screen.getByRole('button', { name: 'Cómo funciona la matriz Kasavana' }));
      expect(screen.getByRole('note').textContent).toMatch(/Estrellas se mantienen/);
    } finally {
      window.matchMedia = matchMediaOriginal;
    }
  });
});
