import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CajaPanel from '../components/admin/platform/CajaPanel';

const turno = {
  id: 'turno-1',
  business_day: '2026-09-09',
  opened_at: '2026-09-09T12:00:00Z',
  opening_amount: 1000,
};

describe('CajaPanel supervision', () => {
  it('muestra rendiciones, incidencias, bloqueos y estado ARCA', () => {
    render(<CajaPanel
      turno={turno}
      esperado={1500}
      rendiciones={[{
        id: 'rendicion-1', status: 'submitted', expected_cash: 500,
        declared_cash: 480, difference: -20, staff: { name: 'Lucia' },
      }]}
      incidencias={[{
        id: 'incidencia-1', title: 'Revisar devolución', severity: 'critical',
        description: 'La mesa pidió anular un cobro.',
      }]}
      bloqueos={{ open_tables: 2, pending_settlements: 1, critical_exceptions: 1 }}
      perfilFiscal={{ enabled: true, point_of_sale: 3, environment: 'homologation' }}
      documentosFiscales={[{ id: 'fiscal-1', status: 'retry_required' }]}
    />);

    expect(screen.getByText('Lucia')).toBeInTheDocument();
    expect(screen.getByText('Revisar devolución')).toBeInTheDocument();
    expect(screen.getByText('1 comprobantes requieren seguimiento')).toBeInTheDocument();
    expect(screen.getByText('2 mesas abiertas')).toBeInTheDocument();
    expect(screen.getByText('PV 00003 · Homologación')).toBeInTheDocument();
  });

  it('envia la revision y la resolucion escritas por el supervisor', () => {
    const onRevisar = vi.fn();
    const onResolver = vi.fn();
    render(<CajaPanel
      turno={turno}
      esperado={1000}
      rendiciones={[{
        id: 'rendicion-1', status: 'under_review', expected_cash: 0,
        declared_cash: 0, difference: 0, staff: { name: 'Tomas' },
      }]}
      incidencias={[{
        id: 'incidencia-1', title: 'Medio incorrecto', severity: 'approval',
      }]}
      onRevisarRendicion={onRevisar}
      onResolverIncidencia={onResolver}
    />);

    fireEvent.change(screen.getByLabelText('Nota para Tomas'), {
      target: { value: 'Comprobantes revisados' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Recibir y cerrar' }));
    expect(onRevisar).toHaveBeenCalledWith(
      'rendicion-1', 'approve', 'Comprobantes revisados',
    );

    fireEvent.change(screen.getByLabelText('Resolución de Medio incorrecto'), {
      target: { value: 'Se corrigió a tarjeta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));
    expect(onResolver).toHaveBeenCalledWith('incidencia-1', 'Se corrigió a tarjeta');
  });
});
