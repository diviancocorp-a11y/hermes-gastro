/**
 * DicoPhysical — Dico 3D sobre el atlas del pet.
 *
 * Lo que se prueba es lo que, si se rompe, no rompe nada: el recorte cae medio
 * cuadro corrido y Dico tiembla, o la animacion pasa por una columna vacia y
 * el personaje parpadea hasta desaparecer. Ninguna de las dos falla un build.
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import DicoPhysical, { posicionDeCelda, planDeAnimacion, planDePose } from '../components/dico/DicoPhysical';
import {
  DICO_PET_ATLAS, DICO_PET_FILAS, DICO_PET_POR_POSE, DICO_PET_PUBLIC_PATH, celdaDeMirada,
} from '../../platform/brand/dico-pet-assets.mjs';
import { PHYSICAL_POSES } from '../components/dico/vocabulario';

const RAIZ = process.cwd();
const physicalCss = readFileSync(join(RAIZ, 'src/components/dico/physical.css'), 'utf8');

const montar = (props = {}) => render(React.createElement(DicoPhysical, { reducedMotion: false, ...props }));
const celda = (c) => c.querySelector('.dico-pose-celda');
const cuadroVisible = (c) => Number(c.querySelector('[data-dico-physical-cuadro]').dataset.dicoPhysicalCuadro);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => vi.useRealTimers());

describe('el vocabulario sigue siendo el mismo', () => {
  it('las ocho poses del panel tienen fila en el atlas', () => {
    // Cambiar el vocabulario habria obligado a tocar DicoPresence, DicoAvisos
    // y cada llamada del panel. Lo que cambio es a que resuelven, no cuales son.
    expect(PHYSICAL_POSES).toHaveLength(8);
    for (const pose of PHYSICAL_POSES) {
      expect(DICO_PET_POR_POSE[pose], pose).toBeTruthy();
    }
  });

  it('processing y question NO son poses: caen en idle', () => {
    for (const inventada of ['processing', 'question', 'esperando', 'pregunta']) {
      const { container, unmount } = montar({ pose: inventada });
      expect(container.querySelector('[data-dico-physical]').dataset.dicoPhysical, inventada).toBe('idle');
      unmount();
    }
  });

  it('dos poses animadas nunca comparten fila', () => {
    // Si `error` y `worried` cayeran en la misma fila, cambiar de estado no se
    // veria y el contrato pasaria por la razon equivocada.
    const filas = PHYSICAL_POSES
      .filter(p => DICO_PET_POR_POSE[p].animacion)
      .map(p => planDePose(p).fila);
    expect(new Set(filas).size).toBe(filas.length);
  });

  it('mirar no es senalar: pointUp y pointDown son celdas fijas', () => {
    for (const pose of ['pointUp', 'pointDown']) {
      const plan = planDePose(pose);
      expect(plan.cuadros, pose).toBe(1);
      expect(plan.fps, pose).toBe(0);
    }
    // Arriba y abajo no pueden ser la misma celda.
    expect(planDePose('pointUp')).not.toEqual(planDePose('pointDown'));
  });
});

describe('el recorte cae donde tiene que caer', () => {
  it('la primera columna es 0% y la ultima 100%', () => {
    expect(posicionDeCelda(0, 0).x).toBe(0);
    expect(posicionDeCelda(DICO_PET_ATLAS.columnas - 1, 0).x).toBe(100);
    expect(posicionDeCelda(0, DICO_PET_ATLAS.filas - 1).y).toBe(100);
  });

  it('divide por columnas menos uno, no por columnas', () => {
    // Con `background-size` al 800%, el 100% es el borde derecho de la ultima
    // columna. Dividir por 8 deja cada cuadro corrido un octavo, y el error
    // crece hacia la derecha: el ultimo sale con medio personaje de otro.
    expect(posicionDeCelda(1, 0).x).toBeCloseTo(100 / 7, 6);
    expect(posicionDeCelda(1, 0).x).not.toBeCloseTo(100 / 8, 6);
  });

  it('el fondo se arma con los numeros del manifiesto', () => {
    const { container } = montar({ pose: 'idle' });
    const estilo = celda(container).style;
    expect(estilo.backgroundImage).toContain(DICO_PET_PUBLIC_PATH);
    expect(estilo.backgroundSize).toBe(
      `${DICO_PET_ATLAS.columnas * 100}% ${DICO_PET_ATLAS.filas * 100}%`);
  });

  it('cada pose recorta su propia fila', () => {
    const vistas = new Set();
    for (const pose of PHYSICAL_POSES) {
      const { container, unmount } = montar({ pose });
      const { x, y } = posicionDeCelda(planDePose(pose).columna || 0, planDePose(pose).fila);
      expect(celda(container).style.backgroundPosition, pose).toBe(`${x}% ${y}%`);
      vistas.add(celda(container).style.backgroundPosition);
      unmount();
    }
    expect(vistas.size).toBe(8);
  });
});

describe('la animacion no se sale de su fila', () => {
  it('puede usar las caminatas certificadas del atlas', () => {
    const plan = planDeAnimacion('correIzquierda');
    expect(plan.fila).toBe(DICO_PET_FILAS.correIzquierda.fila);
    expect(plan.cuadros).toBe(8);
    expect(plan.fps).toBe(14);
    expect(plan.bucle).toBe(true);
  });

  it('avanza al ritmo de la fila y vuelve al principio', () => {
    const { container } = montar({ pose: 'idle' });
    const { cuadros, fps } = planDePose('idle');
    expect(cuadroVisible(container)).toBe(0);

    act(() => { vi.advanceTimersByTime(Math.round(1000 / fps)); });
    expect(cuadroVisible(container)).toBe(1);

    // Una vuelta entera deja el sprite donde empezo.
    act(() => { vi.advanceTimersByTime(Math.round(1000 / fps) * (cuadros - 1)); });
    expect(cuadroVisible(container)).toBe(0);
  });

  it('nunca pasa por una columna vacia', () => {
    // Las filas se llenan de izquierda a derecha y el resto queda transparente.
    // Animar las ocho columnas de `idle` haria desaparecer a Dico dos veces
    // por vuelta.
    const { cuadros, fps } = planDePose('idle');
    expect(cuadros).toBeLessThan(DICO_PET_ATLAS.columnas);

    const { container } = montar({ pose: 'idle' });
    for (let i = 0; i < cuadros * 3; i += 1) {
      act(() => { vi.advanceTimersByTime(Math.round(1000 / fps)); });
      expect(cuadroVisible(container)).toBeLessThan(cuadros);
    }
  });

  it('thinking termina en el ultimo cuadro y no vuelve a empezar', () => {
    const { container } = montar({ pose: 'thinking' });
    const { cuadros, fps } = planDePose('thinking');
    act(() => { vi.advanceTimersByTime(Math.round(1000 / fps) * (cuadros + 2)); });
    expect(cuadroVisible(container)).toBe(cuadros - 1);
  });

  it('cambiar de pose vuelve al primer cuadro', () => {
    // Entrar a `falla` por el cuadro cinco porque el idle anterior iba por ahi
    // arranca la animacion a la mitad y se lee como un salto.
    const { container, rerender } = montar({ pose: 'idle' });
    act(() => { vi.advanceTimersByTime(1000); });
    rerender(React.createElement(DicoPhysical, { pose: 'error', reducedMotion: false }));
    expect(cuadroVisible(container)).toBe(0);
  });

  it('una mirada no se anima', () => {
    const { container } = montar({ pose: 'pointDown' });
    const antes = celda(container).style.backgroundPosition;
    act(() => { vi.advanceTimersByTime(2000); });
    expect(celda(container).style.backgroundPosition).toBe(antes);
  });
});

describe('reduced motion', () => {
  it('se queda en el primer cuadro y no arranca ningun intervalo', () => {
    const { container } = montar({ pose: 'idle', reducedMotion: true });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(cuadroVisible(container)).toBe(0);
    expect(container.querySelector('.dico-pose--quieto')).not.toBeNull();
  });

  it('cambiar de pose sigue funcionando quieto', () => {
    const { container, rerender } = montar({ pose: 'idle', reducedMotion: true });
    rerender(React.createElement(DicoPhysical, { pose: 'success', reducedMotion: true }));
    expect(container.querySelector('[data-dico-physical]').dataset.dicoPhysical).toBe('success');
  });
});

describe('geometria y limites del atlas', () => {
  it('el aspecto sale de la celda certificada', () => {
    const caja = physicalCss.match(/\.dico-pose \{([^}]*)\}/)[1];
    expect(caja).toContain(`aspect-ratio: ${DICO_PET_ATLAS.celdaAncho} / ${DICO_PET_ATLAS.celdaAlto}`);
  });

  it('la celda no participa del layout', () => {
    const bloque = physicalCss.match(/\.dico-pose-celda \{([^}]*)\}/)[1];
    expect(bloque).toContain('position: absolute');
    expect(bloque).toContain('inset: 0');
    expect(bloque).toContain('background-repeat: no-repeat');
  });

  it('la celda sale de dividir el atlas, no de un numero suelto', () => {
    expect(DICO_PET_ATLAS.ancho / DICO_PET_ATLAS.columnas).toBe(DICO_PET_ATLAS.celdaAncho);
    expect(DICO_PET_ATLAS.alto / DICO_PET_ATLAS.filas).toBe(DICO_PET_ATLAS.celdaAlto);
  });

  it('ninguna fila declarada se sale del atlas', () => {
    for (const [nombre, fila] of Object.entries(DICO_PET_FILAS)) {
      expect(fila.fila, nombre).toBeLessThan(DICO_PET_ATLAS.filas);
      expect(fila.cuadros, nombre).toBeGreaterThan(0);
      expect(fila.cuadros, nombre).toBeLessThanOrEqual(DICO_PET_ATLAS.columnas);
    }
  });

  it('las dieciseis direcciones de mirada caen dentro de sus dos filas', () => {
    const vistas = new Set();
    for (let i = 0; i < 16; i += 1) {
      const c = celdaDeMirada(i * 22.5);
      expect([DICO_PET_FILAS.miradaA.fila, DICO_PET_FILAS.miradaB.fila]).toContain(c.fila);
      expect(c.columna).toBeLessThan(DICO_PET_ATLAS.columnas);
      vistas.add(`${c.fila}:${c.columna}`);
    }
    expect(vistas.size).toBe(16);
  });

  it('0 grados es ARRIBA y da la vuelta entera', () => {
    // El QA del pack lo verifico como norte de brujula, en sentido horario.
    expect(celdaDeMirada(0)).toEqual(celdaDeMirada(360));
    expect(celdaDeMirada(-22.5)).toEqual(celdaDeMirada(337.5));
  });
});

describe('lo que DicoPhysical no hace', () => {
  it('no rasteriza texto ni monta una cara encima', () => {
    // El atlas ya trae la cara. Una capa de tinta arriba seria una cara sobre
    // otra cara, y el texto va SIEMPRE en la burbuja.
    const { container } = montar({ pose: 'explain' });
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent.trim()).toBe('');
  });
});
