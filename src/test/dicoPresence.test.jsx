import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DicoPresence from '../components/dico/DicoPresence';

const prod = (over = {}) => ({
  id: 'p1', name: 'Milanesa', price: 5000, active: true, ...over,
});

const datos = {
  vertical: 'gastro',
  productos: [prod({ price: 0 })],
  insumos: [],
  recetas: new Map(),
  gastos: [],
  settings: { waste_pct: 0, expense_pct: 0 },
  hoy: new Date('2026-08-16T12:00:00Z'),
  listo: true,
};

const intervencion = {
  id: 'catalogo-vacio',
  mensaje: 'No hay productos visibles. Vamos a crear el primero.',
  pose: 'pointDown',
  anclaje: 'target',
};

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

describe('DicoPresence', () => {
  it('muestra Native en reposo y conserva el aviso 2D', () => {
    const { container } = render(React.createElement(DicoPresence, datos));
    expect(container.querySelector('[data-dico-native]')).toBeInTheDocument();
    expect(container.querySelector('[data-dico-presence-state]')).toHaveAttribute('data-dico-presence-state', 'native_idle');

    fireEvent.click(screen.getByRole('button', { name: /ver lo que dice dico/i }));
    expect(container.querySelector('.dico-mensaje')).toBeInTheDocument();
    expect(container.querySelector('[data-dico-presence-state]')).toHaveAttribute('data-dico-presence-state', 'native_notice');
  });

  it('usa Dico 2D como acceso directo a la Sala y no abre una tarjeta basica', () => {
    const abrirSala = vi.fn();
    const { container } = render(React.createElement(DicoPresence, {
      ...datos,
      onAbrirSala: abrirSala,
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Abrir Habla con Dico' }));
    expect(abrirSala).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-dico-native="neutral"]')).toBeInTheDocument();
    expect(container.querySelector('.dico-mensaje')).toBeNull();
    expect(container.querySelector('.dico-avisos-badge')).toBeNull();
  });

  it('monta Physical libre y centrado, sin Slot ni Native simultaneos', () => {
    const { container, rerender } = render(React.createElement(DicoPresence, datos));
    rerender(React.createElement(DicoPresence, { ...datos, intervencion }));

    expect(container.querySelector('.dico-slot')).toBeNull();
    expect(container.querySelector('[data-dico-native]')).toBeNull();
    expect(document.body.querySelector('[data-dico-floating="true"]')).toBeInTheDocument();
    expect(document.body.querySelector('[data-dico-physical]')).toBeInTheDocument();
    expect(document.body.querySelector('.dico-mensaje')).toBeInTheDocument();
    expect(container.querySelector('[data-dico-presence-state]')).toBeNull();
  });

  it('usa el objetivo real para mover la escena y pulsarlo en dorado', () => {
    const objetivo = document.createElement('button');
    objetivo.getBoundingClientRect = () => ({ left: 100, top: 200, width: 120, height: 40 });
    document.body.appendChild(objetivo);

    render(React.createElement(DicoPresence, { ...datos, intervencion, objetivo }));
    expect(objetivo).toHaveClass('dico-guia-target');
    expect(document.body.querySelector('.dico-presencia-fisica-escena')).toBeInTheDocument();

    objetivo.remove();
  });

  it('usa MensajeDico tambien para el CTA guiado', () => {
    const cta = {
      ...intervencion,
      id: 'caja-cerrada-al-abrir',
      cta: { texto: 'Abrir caja', accion: 'abrir-caja' },
    };
    const accion = vi.fn();
    render(React.createElement(DicoPresence, { ...datos, intervencion: cta, onIntervencionCta: accion }));

    const boton = screen.getByRole('button', { name: 'Abrir caja' });
    expect(boton).toHaveClass('dico-mensaje-accion--guiado');
    fireEvent.click(boton);
    expect(accion).toHaveBeenCalledWith(cta);
  });

  it('cerrar Physical devuelve el control al productor', () => {
    const cerrar = vi.fn();
    render(React.createElement(DicoPresence, { ...datos, intervencion, onIntervencionCerrada: cerrar }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar lo que dice Dico' }));
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('notifica el estado simplificado sin maquina de apertura/cierre', () => {
    const cambios = vi.fn();
    const { rerender } = render(React.createElement(DicoPresence, { ...datos, onStateChange: cambios }));
    rerender(React.createElement(DicoPresence, { ...datos, intervencion, onStateChange: cambios }));
    expect(cambios.mock.calls.map(([estado]) => estado)).toEqual(['native_idle', 'physical_open']);
  });
});
