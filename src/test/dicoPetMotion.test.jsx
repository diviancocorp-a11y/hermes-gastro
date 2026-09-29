import { createElement } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useDicoPetMotion from '../components/dico/useDicoPetMotion';
import {
  DICO_PET_ACCIONES,
  DICO_PET_RUTINA_VIVA,
} from '../../platform/brand/dico-pet-assets.mjs';

function Probe({ pose = 'idle', enabled = true, reducedMotion = false }) {
  const movimiento = useDicoPetMotion({ pose, enabled, reducedMotion });
  return createElement('output', {
    'data-pose': movimiento.pose,
    'data-accion': movimiento.accion || '',
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
});

afterEach(() => vi.useRealTimers());

describe('rutina ambiental del pet', () => {
  it('encadena miradas y pensamiento con pausas, sin quedarse en idle', () => {
    const { container } = render(createElement(Probe));
    const salida = () => container.querySelector('output');

    expect(salida()).toHaveAttribute('data-accion', DICO_PET_RUTINA_VIVA[0]);
    expect(salida()).toHaveAttribute('data-pose', 'idle');

    act(() => { vi.advanceTimersByTime(DICO_PET_ACCIONES.respirar.duracion); });
    expect(salida()).toHaveAttribute('data-accion', 'mirarArriba');
    expect(salida()).toHaveAttribute('data-pose', 'pointUp');

    act(() => { vi.advanceTimersByTime(DICO_PET_ACCIONES.mirarArriba.duracion); });
    expect(salida()).toHaveAttribute('data-accion', 'pausa');
    expect(salida()).toHaveAttribute('data-pose', 'idle');
  });

  it('una pose controlada tiene prioridad sobre la rutina', () => {
    const { container, rerender } = render(createElement(Probe, { pose: 'success' }));
    const salida = () => container.querySelector('output');

    expect(salida()).toHaveAttribute('data-pose', 'success');
    expect(salida()).toHaveAttribute('data-accion', '');
    act(() => { vi.advanceTimersByTime(12000); });
    expect(salida()).toHaveAttribute('data-pose', 'success');

    rerender(createElement(Probe, { pose: 'idle' }));
    expect(salida()).toHaveAttribute('data-pose', 'idle');
  });

  it('reduced motion congela el comportamiento ambiental', () => {
    const { container } = render(createElement(Probe, { reducedMotion: true }));
    const salida = () => container.querySelector('output');

    act(() => { vi.advanceTimersByTime(12000); });
    expect(salida()).toHaveAttribute('data-pose', 'idle');
    expect(salida()).toHaveAttribute('data-accion', '');
  });
});
