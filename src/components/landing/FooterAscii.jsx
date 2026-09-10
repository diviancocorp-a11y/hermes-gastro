// src/components/landing/FooterAscii.jsx
//
// El cierre de la landing: una imagen reducida a una trama de puntos que late.
// Es un Retro Moment del manual (12): Dico no imita el pasado, recuerda las
// herramientas que reemplazo. Una pantalla de puntos es exactamente eso.
//
// ─── Dos desvios deliberados del preset "Sunset" de 21st.dev ───
//
//   1. El tint. El preset trae #ff3b1f, un naranja que no existe en la paleta
//      de Dico y que ademas queda al lado del Error #E2564B. Aca el tint es
//      GOLD #E0AC3C, que es el color de "accion, valor y presencia de Dico".
//      El manual (03) es explicito: la sensacion premium viene de la escasez
//      del material, no de acumular efectos, y "Gold nunca es warning".
//   2. La foto. El preset apunta a una foto de stock que no vive en este repo.
//      El protagonista del cierre es la moneda fisica de Dico, que ya esta
//      versionada. El manual (14) pide "una pieza = un protagonista".
//
// El pipeline si es el del preset, en su orden: fondo, grilla, primitiva por
// celda segun luminancia, ajustes de color, tint con blend, y despues los
// post-efectos activos (vignette 55, bloom 45). La animacion es "pulse".

import { useEffect, useRef } from 'react';
import './footer-ascii.css';

// El preset completo, tal cual, para que se lea que hace cada numero.
// Lo que no esta activado en esta configuracion no se implementa: seria un
// motor de 26 modos para dibujar uno.
const PRESET = {
  renderMode: 'dots',
  bgMode: 'solid',
  bgOpacity: 90,
  cellSize: 10,
  coverage: 100,
  invert: false,
  brightness: 0,
  contrast: 115,
  saturation: 100,
  density: 0,
  edgeEmphasis: 0,
  tint: '#e0ac3c',       // GOLD del manual, no el #ff3b1f del preset
  tintOpacity: 32,
  overlayBlend: 'overlay',
  vignette: 55,
  bloom: 45,
  animStyle: 'pulse',
  animSpeed: 100,
  animIntensity: 60,
};

const FONDO = '#0e1013';   // CARBON
const IMAGEN = '/brand/dico/physical/dico-3d-idle.webp';

export default function FooterAscii({ src = IMAGEN, alto = 260 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return undefined;

    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // La muestra se toma UNA vez por tamanio, no por frame: leer los pixeles
    // de la imagen en cada cuadro es lo que convierte esto en un ventilador.
    // Lo unico que cambia con el tiempo es el radio de cada punto.
    let celdas = [];
    let ancho = 0;
    let alto2 = 0;
    let raf = 0;
    let visible = true;
    let imagen = null;

    function medir() {
      const caja = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = Math.max(1, Math.round(caja.width));
      alto2 = Math.max(1, Math.round(caja.height));
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(alto2 * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Paso 1 y 2 del pipeline: la imagen entra a un canvas del tamanio final
       y la grilla se promedia celda por celda. */
    function muestrear() {
      if (!imagen || !ancho || !alto2) return;
      const off = document.createElement('canvas');
      off.width = ancho;
      off.height = alto2;
      const octx = off.getContext('2d', { willReadFrequently: true });
      if (!octx) return;

      octx.fillStyle = FONDO;
      octx.fillRect(0, 0, ancho, alto2);

      // La moneda va centrada y contenida, sin recortarse: es una marca, no
      // una textura de fondo que se pueda cortar por cualquier lado.
      const escala = Math.min(ancho / imagen.width, alto2 / imagen.height) * 0.86;
      const w = imagen.width * escala;
      const h = imagen.height * escala;
      octx.drawImage(imagen, (ancho - w) / 2, (alto2 - h) / 2, w, h);

      const datos = octx.getImageData(0, 0, ancho, alto2).data;
      const paso = PRESET.cellSize;
      const nuevas = [];

      for (let y = 0; y < alto2; y += paso) {
        for (let x = 0; x < ancho; x += paso) {
          let r = 0; let g = 0; let b = 0; let n = 0;
          const hastaY = Math.min(y + paso, alto2);
          const hastaX = Math.min(x + paso, ancho);
          // Se saltea de a 2 px: el promedio de una celda de 10 px no cambia
          // por mirar los 100 y cuesta cuatro veces menos.
          for (let yy = y; yy < hastaY; yy += 2) {
            for (let xx = x; xx < hastaX; xx += 2) {
              const i = (yy * ancho + xx) * 4;
              r += datos[i]; g += datos[i + 1]; b += datos[i + 2]; n += 1;
            }
          }
          if (!n) continue;
          r /= n; g /= n; b /= n;

          // Luminancia perceptual, no el promedio de los tres canales.
          let lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

          // Paso 4: brillo y contraste sobre la luminancia, en ese orden.
          lum += PRESET.brightness / 100;
          lum = (lum - 0.5) * (PRESET.contrast / 100) + 0.5;
          lum = Math.min(1, Math.max(0, lum));
          if (PRESET.invert) lum = 1 - lum;

          // Las celdas que quedan en negro no se guardan: son la mayoria del
          // cuadro y dibujarlas es pintar nada sobre el fondo.
          if (lum < 0.06) continue;
          nuevas.push({ x: x + paso / 2, y: y + paso / 2, lum, r, g, b });
        }
      }
      celdas = nuevas;
    }

    /* Paso 3 a 5: se dibuja la trama, se le pone el tint y encima los
       post-efectos activos. */
    function pintar(t) {
      ctx.fillStyle = FONDO;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillRect(0, 0, ancho, alto2);

      // "pulse": toda la trama respira a la vez. La velocidad sale de
      // animSpeed y la profundidad de animIntensity, que es cuanto se aparta
      // del tamanio de reposo.
      const vel = (PRESET.animSpeed / 100) * 0.0016;
      const prof = (PRESET.animIntensity / 100) * 0.34;
      const pulso = quieto ? 1 : 1 + Math.sin(t * vel) * prof;

      const radioMax = (PRESET.cellSize / 2) * 0.92;

      for (let i = 0; i < celdas.length; i += 1) {
        const c = celdas[i];
        const radio = radioMax * c.lum * pulso;
        if (radio <= 0.3) continue;
        // El punto conserva el color de su celda: la trama sigue siendo la
        // foto, no una silueta monocroma.
        ctx.fillStyle = `rgb(${c.r | 0} ${c.g | 0} ${c.b | 0})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tint: GOLD al 32% en overlay.
      ctx.globalCompositeOperation = PRESET.overlayBlend;
      ctx.globalAlpha = PRESET.tintOpacity / 100;
      ctx.fillStyle = PRESET.tint;
      ctx.fillRect(0, 0, ancho, alto2);

      // Bloom: una copia agrandada y difusa de lo ya dibujado, sumada encima.
      // `filter` mas `drawImage` del propio canvas evita un segundo buffer.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (PRESET.bloom / 100) * 0.5;
      ctx.filter = `blur(${Math.round(PRESET.cellSize * 0.9)}px)`;
      ctx.drawImage(canvas, 0, 0, ancho, alto2);
      ctx.filter = 'none';

      // Vignette: oscurece los bordes. Va al final porque tiene que comerse
      // tambien el bloom, no quedar debajo.
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(
        ancho / 2, alto2 / 2, Math.min(ancho, alto2) * 0.16,
        ancho / 2, alto2 / 2, Math.max(ancho, alto2) * 0.72,
      );
      g.addColorStop(0, 'rgba(8,9,11,0)');
      g.addColorStop(1, `rgba(8,9,11,${(PRESET.vignette / 100).toFixed(2)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ancho, alto2);
    }

    function cuadro(t) {
      if (visible) pintar(t);
      raf = requestAnimationFrame(cuadro);
    }

    // Fuera de pantalla no se anima. Es el cierre de la pagina: la mayor
    // parte de la visita transcurre sin que se vea.
    const observador = new IntersectionObserver(
      ([e]) => { visible = e.isIntersecting; },
      { rootMargin: '120px' },
    );
    observador.observe(canvas);

    // ResizeObserver y no `resize` de window: en el primer pintado el canvas
    // puede medir 0 de ancho (la fuente todavia no cargo y el alto del bloque
    // de arriba sigue moviendose), y ahi la trama queda de 1 px hasta que
    // alguien agrande la ventana. El observador vuelve a muestrear cuando la
    // caja se asienta, sin depender de que el usuario haga nada.
    const alCambiarTamanio = () => { medir(); muestrear(); };
    const observadorCaja = new ResizeObserver(alCambiarTamanio);
    observadorCaja.observe(canvas);

    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    img.onload = () => {
      imagen = img;
      medir();
      muestrear();
      if (quieto) { pintar(0); return; }
      raf = requestAnimationFrame(cuadro);
    };
    // Si la imagen no carga, el canvas queda del color del fondo y el pie se
    // ve igual: el efecto es decoracion, no contenido.

    return () => {
      cancelAnimationFrame(raf);
      observador.disconnect();
      observadorCaja.disconnect();
    };
  }, [src]);

  return (
    <div className="fa-root" style={{ height: alto }} aria-hidden="true">
      <canvas ref={canvasRef} className="fa-canvas" />
    </div>
  );
}
