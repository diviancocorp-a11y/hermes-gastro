/**
 * DicoPhysical — Dico 3D en runtime, desde el atlas del pet.
 *
 * Es un PRIMITIVE, no una maquina: recibe una pose y la dibuja. No sabe cuando
 * aparecer —eso lo decide `DicoPresence`—, no conoce el POS, no habla. Lo que
 * dice Dico va en la burbuja, que es otro componente: aca no se rasteriza
 * texto ni se simula lipsync nunca.
 *
 * ───────────────────── POR QUE YA NO HAY CRUCE ─────────────────────
 *
 * El pack anterior eran ocho WebP sueltos, y cambiar de pose significaba
 * esperar una descarga: sin cruce, la primera vez que se usaba una pose se
 * veia un hueco transparente. De ahi venian las dos capas, el `--lista` y el
 * temporizador que las retiraba.
 *
 * El atlas es UNA imagen. Cuando Dico esta en pantalla ya esta cargada entera,
 * asi que cambiar de pose es mover el recorte: no hay nada que esperar y nada
 * contra que cruzar. Un fundido entre dos cuadros del mismo sprite ademas se
 * ve mal, porque durante el cruce se superponen dos dibujos del mismo cuerpo.
 *
 * ──────────────── POR QUE EL CUADRO LO MUEVE JAVASCRIPT ────────────────
 *
 * Cada fila tiene su propia cantidad de cuadros y su propio ritmo: el saludo
 * son cuatro a 10 fps y la carrera ocho a 14. Con `steps()` de CSS eso son
 * once animaciones declaradas a mano, cada una con su keyframe de
 * `background-position`, y cualquier cambio en el atlas obliga a reescribirlas
 * todas. Con un intervalo, el ritmo sale del manifiesto y el atlas manda.
 *
 * Es UN intervalo, a 14 cuadros por segundo en el peor caso, para un
 * personaje que aparece de a ratos. No es el cuello de botella de nada.
 *
 * ───────────────────────── MIRAR NO ES SENALAR ─────────────────────────
 *
 * `pointUp` y `pointDown` no levantan el guante: el pack no tiene esa pose.
 * Resuelven a una de las dieciseis direcciones de mirada, que dan la misma
 * instruccion con los ojos. Inventar un brazo levantado recortando otro cuadro
 * habria sido dibujar una anatomia que el personaje no tiene.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PHYSICAL_POSES, physicalPoseCanonica } from './vocabulario';
import {
  DICO_PET_ATLAS,
  DICO_PET_FILAS,
  DICO_PET_POR_POSE,
  DICO_PET_PUBLIC_PATH,
  celdaDeMirada,
} from '../../../platform/brand/dico-pet-assets.mjs';
import useMediaQuery from '../../lib/useMediaQuery';
import './physical.css';

/**
 * Donde cae el recorte para una celda, en porcentaje.
 *
 * La formula divide por `columnas - 1` y no por `columnas`: con
 * `background-size` al 800%, el 100% de posicion es el borde DERECHO de la
 * ultima columna, no el ancho de una. Dividir por 8 deja cada cuadro corrido
 * un octavo y el error crece hacia la derecha.
 */
export function posicionDeCelda(columna, fila, atlas = DICO_PET_ATLAS) {
  const x = atlas.columnas > 1 ? (columna / (atlas.columnas - 1)) * 100 : 0;
  const y = atlas.filas > 1 ? (fila / (atlas.filas - 1)) * 100 : 0;
  return { x, y };
}

/** Que fila y que ritmo le toca a una pose del vocabulario. */
export function planDePose(pose) {
  const entrada = DICO_PET_POR_POSE[physicalPoseCanonica(pose)];
  if (entrada?.animacion) {
    const fila = DICO_PET_FILAS[entrada.animacion];
    return { fila: fila.fila, cuadros: fila.cuadros, fps: fila.fps, bucle: fila.bucle, columna: 0 };
  }
  // Mirada: una celda fija, sin ritmo.
  const celda = celdaDeMirada(entrada?.mirada ?? 0);
  return { fila: celda.fila, cuadros: 1, fps: 0, bucle: false, columna: celda.columna };
}

/** Resuelve una fila de movimiento del atlas sin convertirla en una pose publica. */
export function planDeAnimacion(animacion) {
  const fila = DICO_PET_FILAS[animacion];
  if (!fila) return planDePose('idle');
  return { fila: fila.fila, cuadros: fila.cuadros, fps: fila.fps, bucle: fila.bucle, columna: 0 };
}

export default function DicoPhysical({
  pose = 'idle',
  /** Override para tests. Sin esto sale de la media query. */
  reducedMotion,
  className = '',
  title = 'Dico',
  animacion = null,
}) {
  const actual = physicalPoseCanonica(pose);
  const menosMovimiento = useMediaQuery('(prefers-reduced-motion: reduce)');
  const quieto = reducedMotion ?? menosMovimiento;

  const plan = useMemo(
    () => (animacion ? planDeAnimacion(animacion) : planDePose(actual)),
    [actual, animacion],
  );
  const [cuadro, setCuadro] = useState(0);

  // El cuadro vuelve a cero al cambiar de pose. Entrar a `falla` por el cuadro
  // cinco porque el `idle` anterior iba por ahi arranca la animacion a la
  // mitad y se lee como un salto.
  const movimientoActual = `${actual}:${animacion || ''}`;
  const poseAnterior = useRef(movimientoActual);
  if (poseAnterior.current !== movimientoActual) {
    poseAnterior.current = movimientoActual;
    setCuadro(0);
  }

  useEffect(() => {
    if (quieto || plan.fps <= 0 || plan.cuadros <= 1) return undefined;
    const id = setInterval(
      () => setCuadro((c) => {
        if (!plan.bucle && c >= plan.cuadros - 1) return c;
        return (c + 1) % plan.cuadros;
      }),
      Math.round(1000 / plan.fps),
    );
    return () => clearInterval(id);
  }, [quieto, plan.fps, plan.cuadros, plan.bucle]);

  const columna = plan.cuadros > 1 ? cuadro : plan.columna;
  const { x, y } = posicionDeCelda(columna, plan.fila);

  return (
    <div
      className={['dico-pose', quieto ? 'dico-pose--quieto' : '', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={title}
      data-dico-physical={actual}
      data-dico-physical-cuadro={columna}
    >
      <span
        key={movimientoActual}
        className="dico-pose-celda"
        style={{
          backgroundImage: `url(${DICO_PET_PUBLIC_PATH})`,
          backgroundSize: `${DICO_PET_ATLAS.columnas * 100}% ${DICO_PET_ATLAS.filas * 100}%`,
          backgroundPosition: `${x}% ${y}%`,
        }}
      />
    </div>
  );
}

export { PHYSICAL_POSES };
