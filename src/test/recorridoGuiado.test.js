import { describe, expect, it, vi } from 'vitest';
import { crearRecorridoGuiado } from '../lib/recorridoGuiado';

const momento = { id: 'cobro', indice: 2, inicio: 9, fin: 14.999, resultado: 12 };

describe('recorrido guiado de las maquetas', () => {
  it('prepara antes de la acción y no confunde preparación con resultado', () => {
    const control = crearRecorridoGuiado(vi.fn());
    expect(control.configurar('preparar', momento, 40, false)).toEqual({ tiempo: 9, fijo: true });
    expect(control.indice).toBe(2);
    expect(control.avanzar(50)).toBeNull();
  });
  it('reproduce desde el inicio, se detiene antes de pasar al siguiente tramo y avisa una vez', () => {
    const fin = vi.fn();
    const control = crearRecorridoGuiado(fin);
    expect(control.configurar('reproducir', momento, 40, false)).toEqual({ tiempo: 9, fijo: false });
    expect(control.avanzar(14)).toBeNull();
    expect(control.avanzar(15.02)).toEqual({ tiempo: 14.999, indice: 2 });
    expect(control.avanzar(20)).toBeNull();
    expect(fin).toHaveBeenCalledExactlyOnceWith('cobro');
  });
  it('pausa y continúa desde el mismo instante sin reiniciar', () => {
    const control = crearRecorridoGuiado(vi.fn());
    control.configurar('reproducir', momento, 0, false);
    expect(control.configurar('pausar', momento, 10.5, false)).toEqual({ tiempo: 10.5, fijo: true });
    expect(control.avanzar(20)).toBeNull();
    expect(control.configurar('continuar', momento, 10.5, false)).toEqual({ tiempo: 10.5, fijo: false });
    expect(control.avanzar(15)?.indice).toBe(2);
  });
  it('repetir rearma el tramo y permite notificar otro resultado', () => {
    const fin = vi.fn();
    const control = crearRecorridoGuiado(fin);
    for (let i = 0; i < 2; i++) {
      control.configurar('reproducir', momento, 0, false);
      control.avanzar(15);
    }
    expect(fin).toHaveBeenCalledTimes(2);
  });
  it('con movimiento reducido muestra el resultado quieto y termina sin reproducir', () => {
    const fin = vi.fn();
    const control = crearRecorridoGuiado(fin);
    expect(control.configurar('reproducir', momento, 0, true)).toEqual({ tiempo: 12, fijo: true });
    expect(fin).toHaveBeenCalledExactlyOnceWith('cobro');
    expect(control.avanzar(40)).toBeNull();
  });
  it('cambiar la preferencia durante una demostración detiene el movimiento en su resultado', () => {
    const fin = vi.fn();
    const control = crearRecorridoGuiado(fin);
    control.configurar('reproducir', momento, 0, false);
    expect(control.reducir()).toEqual({ tiempo: 12, indice: 2 });
    expect(control.avanzar(20)).toBeNull();
    expect(fin).toHaveBeenCalledExactlyOnceWith('cobro');
  });
  it('salir libera el control y no emite resultados pendientes', () => {
    const fin = vi.fn();
    const control = crearRecorridoGuiado(fin);
    control.configurar('reproducir', momento, 0, false);
    control.cancelar();
    expect(control.activo).toBe(false);
    expect(control.indice).toBeNull();
    expect(control.avanzar(40)).toBeNull();
    expect(fin).not.toHaveBeenCalled();
  });
});
