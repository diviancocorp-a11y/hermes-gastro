/**
 * Rutina ambiental del pet.
 *
 * Solo decide que accion mostrar cuando el pet esta libre. Las intervenciones
 * siguen teniendo prioridad y pasan por la pose que ya trae la UI.
 */
import { useEffect, useState } from 'react';
import {
  DICO_PET_ACCIONES,
  DICO_PET_RUTINA_VIVA,
} from '../../../platform/brand/dico-pet-assets.mjs';
import { physicalPoseCanonica } from './vocabulario';
import useMediaQuery from '../../lib/useMediaQuery';

export function useDicoPetMotion({ pose = 'idle', enabled = false, reducedMotion, rutina = DICO_PET_RUTINA_VIVA, repetir = true } = {}) {
  const poseControlada = physicalPoseCanonica(pose);
  const mediaReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const quieto = reducedMotion ?? mediaReducedMotion;
  const puedeVivir = enabled && !quieto && poseControlada === 'idle';
  const [paso, setPaso] = useState(0);
  const [termino, setTermino] = useState(false);

  useEffect(() => {
    if (!puedeVivir || termino || !rutina.length) return undefined;
    const nombre = rutina[paso] || rutina[0];
    const duracion = DICO_PET_ACCIONES[nombre]?.duracion || 1200;
    const id = window.setTimeout(() => {
      if (!repetir && paso >= rutina.length - 1) {
        setTermino(true);
        return;
      }
      setPaso((actual) => (actual + 1) % rutina.length);
    }, duracion);
    return () => window.clearTimeout(id);
  }, [paso, puedeVivir, repetir, rutina, termino]);

  const accion = puedeVivir && !termino ? DICO_PET_ACCIONES[rutina[paso] || rutina[0]] : null;
  return {
    pose: accion?.pose || poseControlada,
    accion: puedeVivir ? rutina[paso] || rutina[0] : null,
    reducido: quieto,
  };
}

export default useDicoPetMotion;
