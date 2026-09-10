// src/components/landing/PalabraEscrita.jsx
//
// La palabra del titular que cambia sola, escrita como si alguien la trazara.
// El texto fijo va en Overused Grotesk; esta va en Butler, que es la letra con
// la que Dico firma.
//
// ─── Por que NO parsea la fuente en el navegador ───
//
// La receta conocida para esto es cargar opentype.js, parsear el .ttf en el
// cliente, convertir cada glifo a <path> y animar `stroke-dashoffset`. Aca eso
// no se puede y ademas no conviene:
//
//   1. Las fuentes del repo son WOFF2 y opentype.js no lee WOFF2. Habria que
//      sumar el TTF al repo solo para el trazo.
//   2. Serian ~200 KB de parser mas la fuente entera descargada de nuevo, en
//      la primera pantalla, para animar cuatro palabras que no cambian nunca.
//   3. El original lo baja de un CDN. El manual de marca prohibe CDN, y un
//      <script> externo en la puerta de entrada es superficie que no hace falta.
//
// La forma correcta para texto conocido de antemano es generar los contornos
// UNA vez, en build, y embarcar solo el resultado: `scripts/generar-trazos.mjs`
// escribe `src/components/landing/trazos.json` a partir del TTF. Ahi el cliente
// no descarga parser ni fuente extra y la animacion arranca en el primer frame.
//
// Mientras ese JSON no exista, el componente NO se rompe: dibuja la palabra con
// la fuente real y la revela de izquierda a derecha, con la punta dorada
// avanzando. Es el mismo gesto, sin el trazo del contorno.

import { useEffect, useState } from 'react';
import './palabra-escrita.css';

// El import es estatico y opcional a la vez: si el archivo no esta, Vite falla
// el build, asi que el repo trae un JSON vacio y el script lo completa.
import TRAZOS from './trazos.json';

const PAUSA = 2600;

export default function PalabraEscrita({
  palabras = [],
  duracion = 1.5,
  pausa = PAUSA,
  className = '',
}) {
  const [i, setI] = useState(0);

  // Quien pidio menos movimiento no ve la rotacion: se queda con la primera
  // palabra, que es texto real y no un adorno que se pueda perder.
  const quieto =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (quieto || palabras.length < 2) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % palabras.length), pausa);
    return () => clearInterval(id);
  }, [quieto, palabras.length, pausa]);

  const palabra = palabras[i] ?? '';
  const trazo = TRAZOS?.[palabra];

  // El ancho se reserva con la palabra mas larga: sin esto el titular se
  // reacomoda en cada cambio y arrastra las lineas de abajo.
  const masLarga = palabras.reduce((a, b) => (b.length > a.length ? b : a), '');

  return (
    <span className={`pe-root ${className}`.trim()}>
      <span className="pe-reserva" aria-hidden="true">{masLarga}</span>
      <span className="pe-vivo" aria-live="polite">
        {trazo
          ? <Trazada key={palabra} palabra={palabra} trazo={trazo} duracion={duracion} quieto={quieto} />
          : <Revelada key={palabra} palabra={palabra} duracion={duracion} quieto={quieto} />}
      </span>
    </span>
  );
}

/* ─── Con los contornos ya generados: la pluma cruza la palabra ───
 *
 * Cada contorno es su propio <path> a proposito. Un patron de guiones REINICIA
 * en cada subpath, asi que un solo path con la palabra entera no se puede
 * dibujar de a poco: cada letra apareceria completa o nada. Separarlos y
 * escalonar los delays es lo que produce la pluma cruzando de izquierda a
 * derecha. El relleno, en cambio, tiene que ser un unico path: el hueco de una
 * "e" es otro contorno y solo se lee como hueco si la regla de relleno lo ve
 * junto con el de afuera. */
function Trazada({ palabra, trazo, duracion, quieto }) {
  const [dibujado, setDibujado] = useState(quieto);

  useEffect(() => {
    if (quieto) return undefined;
    // Dos frames: el primero fija los offsets sin transicion, el segundo la
    // habilita y va a cero. Los dos en el mismo commit no animan nada.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setDibujado(true)));
    return () => cancelAnimationFrame(id);
  }, [quieto]);

  const contornos = trazo.contornos || [];
  const total = Math.max(1, contornos.length);

  return (
    <svg
      className="pe-svg"
      viewBox={trazo.viewBox}
      role="img"
      aria-label={palabra}
      style={{ width: `calc(1em * ${trazo.relacion})` }}
    >
      <path
        className="pe-relleno"
        d={trazo.completo}
        style={{
          opacity: dibujado ? 1 : 0,
          transitionDuration: `${(duracion * 0.35).toFixed(2)}s`,
          transitionDelay: `${(duracion * 0.68).toFixed(2)}s`,
        }}
      />
      {contornos.map((d, n) => (
        <path
          key={n}
          className="pe-linea"
          d={d}
          style={{
            strokeDasharray: trazo.largos?.[n] || 1,
            strokeDashoffset: dibujado ? 0 : (trazo.largos?.[n] || 1),
            transitionDuration: `${((duracion / total) * 2.4).toFixed(3)}s`,
            transitionDelay: `${((n / total) * duracion).toFixed(3)}s`,
          }}
        />
      ))}
    </svg>
  );
}

/* ─── Sin contornos: la palabra se revela y la punta dorada la acompania ───
 *
 * Es texto de verdad, con la fuente de verdad: se puede seleccionar, lo lee un
 * lector de pantalla y no depende de que ningun JSON este al dia. */
function Revelada({ palabra, duracion, quieto }) {
  return (
    <span
      className={`pe-revelada${quieto ? ' quieta' : ''}`}
      style={{ '--pe-dur': `${duracion}s` }}
    >
      <span className="pe-texto">{palabra}</span>
      <span className="pe-punta" aria-hidden="true" />
    </span>
  );
}
