/**
 * Como expresa Dico, con las dos versiones que quedaron.
 *
 *   la marca   expresa con la CARA: siete `nativeState`, cejas y ojos.
 *   el pet     expresa con la POSE: ocho `physicalPose`, cuerpo entero.
 *
 * Son EJES DISTINTOS y no se traducen uno al otro. `explain`, `pointDown` y
 * `pointUp` son poses corporales y no tienen cara equivalente; `curious` y
 * `question` son caras y no tienen pose propia. Atarlos fue el error que dejo
 * a `processing` viviendo como si fuera una emocion.
 *
 * Lo que se prueba es que ninguna de las dos quede clavada en su valor por
 * defecto, que es como estuvo Physical una vez —`className="dico--idle"`
 * escrito a mano en el JSX— sin que fallara nada.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import DicoNative from '../components/dico/DicoNative';
import DicoPhysical from '../components/dico/DicoPhysical';
import {
  NATIVE_STATES, PHYSICAL_POSES, ACTIVITIES,
  nativeStateCanonico, physicalPoseCanonica, activityCanonica,
} from '../components/dico/vocabulario';


beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
});

describe('los tres ejes siguen siendo independientes', () => {
  it('cada uno tiene su lista y su default', () => {
    expect(NATIVE_STATES).toHaveLength(7);
    expect(PHYSICAL_POSES).toHaveLength(8);
    expect(ACTIVITIES).toHaveLength(5);
    expect(nativeStateCanonico('inventado')).toBe('neutral');
    expect(physicalPoseCanonica('inventado')).toBe('idle');
    expect(activityCanonica('inventado')).toBe('idle');
  });

  it('una pose corporal NO es un estado facial', () => {
    // Pedirle `explain` a la marca no puede resolver a una cara parecida: la
    // marca no tiene cuerpo con que explicar. Cae en el default.
    for (const pose of ['explain', 'pointDown', 'pointUp']) {
      expect(nativeStateCanonico(pose), pose).toBe('neutral');
    }
  });

  it('una cara NO es una pose', () => {
    for (const cara of ['curious', 'celebrate', 'concerned']) {
      expect(physicalPoseCanonica(cara), cara).toBe('idle');
    }
  });

  it('processing y thinking son ACTIVIDAD, no emocion ni pose', () => {
    expect(ACTIVITIES).toContain('processing');
    expect(ACTIVITIES).toContain('thinking');
    expect(NATIVE_STATES).not.toContain('processing');
    expect(PHYSICAL_POSES).not.toContain('processing');
  });
});

describe('la marca no queda clavada en neutral', () => {
  it('cada estado pide su propio asset', () => {
    const vistos = new Set();
    for (const estado of NATIVE_STATES) {
      const { container, unmount } = render(React.createElement(DicoNative, { state: estado }));
      const src = container.querySelector('.dico-native-arte').getAttribute('src');
      expect(src, estado).toBe(`/brand/dico/dico-2d-${estado}.png`);
      vistos.add(src);
      unmount();
    }
    expect(vistos.size).toBe(7);
  });
});

describe('el pet no queda clavado en idle', () => {
  it('cada pose llega al primitive', () => {
    for (const pose of PHYSICAL_POSES) {
      const { container, unmount } = render(React.createElement(DicoPhysical, { pose }));
      expect(container.querySelector('[data-dico-physical]').dataset.dicoPhysical, pose).toBe(pose);
      unmount();
    }
  });

  it('un valor desconocido cae en idle en vez de pedir un cuadro que no existe', () => {
    const { container } = render(React.createElement(DicoPhysical, { pose: 'inventado' }));
    expect(container.querySelector('[data-dico-physical]').dataset.dicoPhysical).toBe('idle');
  });

  it('no le monta una cara encima: el atlas ya la trae', () => {
    const { container } = render(React.createElement(DicoPhysical, { pose: 'explain' }));
    expect(container.querySelector('.dico-physical-cara')).toBeNull();
  });
});
