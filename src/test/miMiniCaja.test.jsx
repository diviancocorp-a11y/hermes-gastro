// La mini caja del mozo: montos en formato argentino (auditoria de Caja, 19/oct).
//
// Number(String(x).replace(',', '.')) || 0 leia "1.500,50" como 0 y "12.500"
// como 12.5: el mozo presentaba un pre-cierre con faltante que no tenia.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MiMiniCaja from '../components/admin/platform/MiMiniCaja';

const turno = { id: 't1' };
const yo = { id: 's1', name: 'Vale' };

function montar(props = {}) {
  return render(<MiMiniCaja turno={turno} yo={yo} esperado={1000} {...props} />);
}

const campo = () => screen.getByPlaceholderText('0');
const presentar = () => screen.getByRole('button', { name: 'Presentar pre-cierre' });

describe('MiMiniCaja — montos en formato argentino', () => {
  it('presenta centavos escritos con coma y punto de miles', () => {
    const onPresentar = vi.fn().mockResolvedValue();
    montar({ onPresentar });
    fireEvent.change(campo(), { target: { value: '1.500,50' } });
    fireEvent.click(presentar());
    expect(onPresentar).toHaveBeenCalledWith(1500.5, null);
  });

  it('el punto de miles no se lee como decimal', () => {
    const onPresentar = vi.fn().mockResolvedValue();
    montar({ onPresentar });
    fireEvent.change(campo(), { target: { value: '12.500' } });
    fireEvent.click(presentar());
    expect(onPresentar).toHaveBeenCalledWith(12500, null);
  });

  it('la diferencia sale del monto bien leido', () => {
    montar();
    fireEvent.change(campo(), { target: { value: '1.500,50' } });
    expect(screen.getByText('Sobra')).toBeInTheDocument();
    expect(screen.getByText(/500,50/)).toBeInTheDocument();
  });

  it('un numero que no se entiende no se presenta y dice por que', () => {
    const onPresentar = vi.fn();
    montar({ onPresentar });
    fireEvent.change(campo(), { target: { value: '1,2,3' } });
    expect(presentar()).toBeDisabled();
    const aviso = screen.getByText(/No entiendo ese número/);
    expect(aviso).toHaveTextContent(/1\.500,50/);
    expect(aviso).toHaveAttribute('aria-live', 'polite');
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/Sobra|Falta|Coincide/)).not.toBeInTheDocument();
    fireEvent.click(presentar());
    expect(onPresentar).not.toHaveBeenCalled();
  });

  it('a medio tipear no avisa error, pero tampoco deja presentar', () => {
    montar();
    fireEvent.change(campo(), { target: { value: '1.500,' } });
    expect(screen.queryByText(/No entiendo ese número/)).not.toBeInTheDocument();
    expect(presentar()).toBeDisabled();
  });
});
