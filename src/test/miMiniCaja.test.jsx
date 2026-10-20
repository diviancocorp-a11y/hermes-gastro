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

// La region que describe al campo: la ayuda y el aviso viven en el mismo lugar.
const regionDe = (campo) => document.getElementById(campo.getAttribute('aria-describedby'));

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
    expect(aviso.closest('[aria-live="polite"]')).not.toBeNull();
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/Sobra|Falta|Coincide/)).not.toBeInTheDocument();
    fireEvent.click(presentar());
    expect(onPresentar).not.toHaveBeenCalled();
  });

  it('el aviso entra en una region live que ya estaba montada', () => {
    // Un aria-live que entra al DOM con el texto adentro no se anuncia en
    // muchos lectores (WCAG 4.1.3): la region tiene que estar antes.
    montar();
    const region = regionDe(campo());
    expect(region).toHaveAttribute('aria-live', 'polite');
    fireEvent.change(campo(), { target: { value: '1,2,3' } });
    expect(regionDe(campo())).toBe(region);
    expect(region).toHaveTextContent(/No entiendo ese número/);
  });

  it('la ayuda y el aviso no se meten en el nombre del campo', () => {
    montar();
    expect(screen.getByRole('textbox', { name: '¿Cuánta plata tenés?' }))
      .toHaveAccessibleDescription(/Contá lo que tenés en mano/);
    fireEvent.change(campo(), { target: { value: '1,2,3' } });
    expect(screen.getByRole('textbox', { name: '¿Cuánta plata tenés?' }))
      .toHaveAccessibleDescription(/No entiendo ese número/);
  });

  it('la region no hereda el estilo de la etiqueta del campo', () => {
    // .ag-minicaja-campo > span es la pregunta (13px en negrita): la ayuda
    // no puede ser un span hijo directo del label.
    montar();
    expect(regionDe(campo()).matches('.ag-minicaja-campo > span')).toBe(false);
  });

  it('a medio tipear no avisa error, pero tampoco deja presentar', () => {
    montar();
    fireEvent.change(campo(), { target: { value: '1.500,' } });
    expect(screen.queryByText(/No entiendo ese número/)).not.toBeInTheDocument();
    expect(presentar()).toBeDisabled();
  });
});
