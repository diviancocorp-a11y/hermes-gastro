/*!
 * Glyph Portal © 2026 Christian Katzmann. MIT.
 * Origin: UsefulPortal.astro on https://ktzm.dk → UsefulPortal.tsx → ClarityPortal.tsx.
 * A scroll-driven camera through live type. Keep this notice with copies.
 *
 * @license MIT
 * Copyright (c) 2026 Christian Katzmann
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// Port a JS para la landing de DICO. Cambios contra el original:
// - sin modo interactivo (eleccion de letra), sin anotaciones, sin el link
//   "Enter section" ni la caption: la letra la fija `focusChar`;
// - los estilos viven en src/styles/glyph-portal.css, scopeados por
//   [data-gp-root], y los colores entran por --gp-paper, --gp-field,
//   --gp-foreground (y --gp-ink opcional) que pone quien lo usa;
// - el root es la section y recibe id, className, aria-* y data-* por props;
// - la fuente y el peso salen de las props o, si no vienen, de --gp-font-family
//   y --gp-font-weight del root (asi el que lo usa pasa un token, no un literal);
// - alcanza con que la PRIMERA familia de la pila este cargada; si no lo esta,
//   se pide y el efecto se rehace al llegar (el original exigia toda la pila y
//   dejaba ese montaje estatico para siempre);
// - sin JS o si la tinta no se pudo medir, se ve el poster (data-gp-fallback).
import { useId, useLayoutEffect, useRef, useState } from 'react';
import '../../styles/glyph-portal.css';

const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const smooth = (a, b, n) => {
  const t = clamp((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const DEFAULT_FONT = 'sans-serif';

/** Largest opaque square, in linear time. Unlike a stem guess, it works in O, S and Ø. */
function interior(context, char, font) {
  const canvas = context.canvas;
  context.font = font;
  const m = context.measureText(char);
  const pad = 8;
  const left = Math.ceil(m.actualBoundingBoxLeft);
  const ascent = Math.ceil(m.actualBoundingBoxAscent);
  canvas.width = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2);
  canvas.height = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2);
  context.font = font;
  context.fontKerning = 'none';
  context.fillText(char, pad + left, pad + ascent);
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  const rows = new Uint16Array(width + 1);
  let size = 0, bx = 0, by = 0;
  for (let y = 0; y < height; y++) {
    let diagonal = 0;
    for (let x = 0; x < width; x++) {
      const above = rows[x + 1];
      rows[x + 1] = pixels[(y * width + x) * 4 + 3] > 245
        ? Math.min(above, rows[x], diagonal) + 1 : 0;
      diagonal = above;
      if (rows[x + 1] > size) { size = rows[x + 1]; bx = x; by = y; }
    }
  }
  if (size < 3) return null;
  // Scan at 3x SVG size. Inscribe a disk in the square, with room for raster disagreement.
  return { x: (bx + 1 - size / 2 - pad - left) / 3,
    y: (by + 1 - size / 2 - pad - ascent) / 3, radius: (size / 2 - 1) / 3 };
}

function scrollParent(element) {
  for (let p = element.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY) && p !== document.body && p !== document.documentElement) return p;
  }
  return null;
}

export default function GlyphPortal({
  word = 'SUBLIME', focusChar, front, campo, children, scrollLength = 2.4,
  fontFamily, fontWeight, onProgress, ...resto
}) {
  const uid = `gp-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const clipId = `${uid}-clip`;
  const sectionRef = useRef(null);
  const progressRef = useRef(onProgress);
  useLayoutEffect(() => { progressRef.current = onProgress; }, [onProgress]);
  // Sube cuando termina de cargar la fuente pedida: rehace el efecto de camara.
  const [fuente, setFuente] = useState(0);
  const text = word.trim().normalize('NFC') || 'SUBLIME';
  const length = Number.isFinite(scrollLength) ? clamp(scrollLength, 1, 8) : 2.4;
  const hasFront = front != null;

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const pin = section.querySelector('[data-gp-pin]');
    const field = section.querySelector('[data-gp-field]');
    const art = section.querySelector('[data-gp-art]');
    const clip = section.querySelector(`#${clipId}`);
    const glyph = section.querySelector('[data-gp-glyph]');
    section.style.setProperty('--gp-length', String(length));
    section.style.setProperty('--gp-characters', String(Array.from(text).length));
    if (fontFamily) section.style.setProperty('--gp-font-family', fontFamily);
    if (Number.isFinite(fontWeight)) section.style.setProperty('--gp-font-weight', String(fontWeight));
    const raiz = getComputedStyle(section);
    const family = raiz.getPropertyValue('--gp-font-family').trim() || DEFAULT_FONT;
    const pesoCss = Number(raiz.getPropertyValue('--gp-font-weight').trim() || 900);
    const weight = Number.isFinite(pesoCss) ? clamp(pesoCss, 1, 1000) : 900;
    glyph.style.fontWeight = String(weight);
    // Sin observers (entornos viejos o de test) queda la version estatica.
    if (typeof ResizeObserver === 'undefined' || typeof IntersectionObserver === 'undefined') return undefined;
    const root = scrollParent(section);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let disposed = false, raf = 0, dirty = true, active = true, ready = false;
    const mountedAt = performance.now();
    let browserFrameSeen = false, stalled = false;
    let W = 1, H = 1, travel = 1, startScale = 1, endScale = 1;
    let center = { x: 0, y: 0 }, target = null;
    let lastProgress = -1;
    let candidates = [];
    let bounds = { x: 0, y: 0, width: 1, height: 1 };
    let fontDirty = true;
    // Freeze an available face for this mount. Late font swaps move the ink under the camera.
    // Pending/failed faces use the rest of the stack until the first one loads.
    glyph.style.fontFamily = family;
    const computedFamily = getComputedStyle(glyph).fontFamily;
    const families = computedFamily.match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g) ?? [];
    const cargada = (nombre) => {
      try { return document.fonts.check(`${weight} 100px ${nombre.trim()}`, text); }
      catch { return false; }
    };
    const available = families.filter(cargada);
    glyph.style.fontFamily = [...available, DEFAULT_FONT].join(',');
    // A pending requested face may also hold WebKit's render loop. Keep that mount static.
    const primera = families[0]?.trim();
    stalled = !primera || !cargada(primera);
    if (stalled && primera && document.fonts?.load) {
      // Al llegar la primera familia se rehace el montaje con movimiento.
      document.fonts.load(`${weight} 100px ${primera}`, text)
        .then(() => { if (!disposed && cargada(primera)) setFuente((n) => n + 1); })
        .catch(() => {});
    }

    const readInk = () => {
      if (!context) return false;
      const font = getComputedStyle(glyph);
      const scanFont = `${font.fontWeight} 300px ${font.fontFamily}`;
      context.font = `${font.fontWeight} 100px ${font.fontFamily}`;
      context.fontKerning = 'none';
      const metrics = context.measureText(text);
      const advances = Array.from({ length: text.length }, (_, i) => context.measureText(text.slice(0, i)).width);
      // SVG getBBox includes the font's line box in some engines. Frame visible ink instead.
      bounds = { x: -metrics.actualBoundingBoxLeft, y: -metrics.actualBoundingBoxAscent,
        width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent };
      if (!bounds.width || !bounds.height) return false;
      center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const requested = focusChar ? text.indexOf(focusChar.normalize('NFC')) : -1;
      let offset = 0;
      candidates = [];
      for (const char of Array.from(text)) {
        const found = interior(context, char, scanFont);
        if (found) candidates.push({ ...found, x: found.x + advances[offset], index: offset });
        offset += char.length;
      }
      target = candidates.find((candidate) => candidate.index === requested) ?? [...candidates].sort((a, b) => b.radius - a.radius || Math.abs(a.x - center.x) - Math.abs(b.x - center.x))[0] ?? null;
      return true;
    };

    const select = (next) => {
      target = next;
      endScale = target ? Math.max(startScale, Math.hypot(W, H) / (target.radius * 1.35)) : startScale;
      section.dataset.gpFocus = target ? Array.from(text.slice(target.index))[0] : '';
      section.dataset.gpFocusIndex = String(target?.index ?? -1);
    };

    const position = () => {
      const origin = root ? root.getBoundingClientRect().top + root.clientTop : 0;
      return clamp((origin - section.getBoundingClientRect().top) / travel);
    };

    const paint = (progress) => {
      const isStatic = motion.matches || !browserFrameSeen || stalled || !target;
      const p = isStatic ? 0 : progress;
      const t = clamp(p / 0.78);
      const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      const scale = Math.exp(Math.log(startScale) + Math.log(endScale / startScale) * eased);
      const blend = endScale === startScale ? 0 : (1 / scale - 1 / startScale) / (1 / endScale - 1 / startScale);
      const cx = center.x + ((target?.x ?? center.x) - center.x) * blend;
      const cy = center.y + ((target?.y ?? center.y) - center.y) * blend;
      const roll = -4 * smooth(0.06, 0.5, t) * (1 - smooth(0.62, 0.92, t));
      // Keep scale on the clip to avoid text paint limits. Text-local translation
      // follows page zoom in WebKit; translation on an HTML clip reference does not.
      const radians = roll * Math.PI / 180;
      const dx = W / 2 / scale, dy = (H * .46 + H * .04 * eased) / scale;
      clip.setAttribute('transform', `scale(${scale}) rotate(${roll})`);
      glyph.setAttribute('transform', `translate(${Math.cos(radians) * dx + Math.sin(radians) * dy - cx} ${-Math.sin(radians) * dx + Math.cos(radians) * dy - cy})`);
      // Drop the clip only after the camera has already filled the viewport with ink.
      field.style.clipPath = t >= 1 ? 'none' : `url(#${clipId})`;
      section.style.setProperty('--gp-caption', String(1 - smooth(0.01, 0.16, p)));
      section.style.setProperty('--gp-reveal', String(isStatic ? 1 : smooth(0.78, 0.9, p)));
      section.style.setProperty('--gp-caption-hit', p < 0.08 ? 'auto' : 'none');
      if (p !== lastProgress) { lastProgress = p; progressRef.current?.(p); }
    };

    const layout = () => {
      if (!section.clientWidth) return;
      W = pin.clientWidth;
      // A 100svh probe keeps browser chrome from continually changing the scroll distance.
      const smallViewport = section.querySelector('[data-gp-viewport]').offsetHeight;
      const viewportHeight = Math.max(1, Math.min(root?.clientHeight ?? smallViewport, smallViewport));
      H = motion.matches ? Math.min(viewportHeight * 0.75, 480) : viewportHeight;
      section.style.setProperty('--gp-height', `${H}px`);
      travel = H * length;
      art.setAttribute('viewBox', `0 0 ${W} ${H}`);
      if (fontDirty) { ready = readInk(); fontDirty = false; }
      if (!ready) return;
      const wordHeight = hasFront && H < 480 ? Math.min(H * .38, Math.max(24, H - 264)) : H * .38;
      startScale = Math.min(W * 0.84 / bounds.width, wordHeight / bounds.height);
      // The whole viewport fits inside measured ink, even with the small camera bank.
      select(target);
      section.dataset.gpReady = 'true';
      section.dataset.gpMotion = !motion.matches && browserFrameSeen && !stalled && target ? 'on' : 'off';
    };

    const frame = (time) => {
      raf = 0;
      if (disposed) return;
      if (time !== undefined && !browserFrameSeen) {
        browserFrameSeen = true; stalled ||= performance.now() - mountedAt > 2500; dirty = true;
      }
      if (dirty) { dirty = false; layout(); }
      if (ready) paint(position());
    };
    const schedule = () => { if (!raf && active) raf = requestAnimationFrame(frame); };
    const resize = () => { cancelAnimationFrame(raf); dirty = true; frame(); };
    const scroll = () => schedule();
    const observer = new ResizeObserver(resize);
    observer.observe(section);
    if (root) observer.observe(root);
    const visibility = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting;
      if (active) { dirty = true; schedule(); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { root, rootMargin: '100% 0px' });
    visibility.observe(section);
    (root ?? window).addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    motion.addEventListener('change', resize);
    frame();
    // WebKit can withhold frames, timers and scroll events behind an initial hung font.
    // Begin in reading flow. Enable motion only when the browser starts rendering promptly.
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibility.disconnect();
      (root ?? window).removeEventListener('scroll', scroll);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      motion.removeEventListener('change', resize);
    };
  }, [text, focusChar, fontFamily, fontWeight, length, clipId, hasFront, fuente]);

  return (
    <section ref={sectionRef} data-gp-root="" {...resto}>
      {/* JS reveals only measured geometry. Until then (no JS, prerender, unmeasured ink) the poster shows. */}
      <div data-gp-viewport="" aria-hidden="true" />
      <div data-gp-pin="">
        {/* `campo`: decoracion dentro de la tinta (se ve a traves de las letras). */}
        <div data-gp-field="" aria-hidden="true" inert>{campo}</div>
        <svg data-gp-art="" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <text data-gp-glyph="" x="0" y="0" fontSize="100">{text}</text>
            </clipPath>
          </defs>
        </svg>
        {hasFront && <div data-gp-front="">{front}</div>}
        <span data-gp-fallback="" aria-hidden="true">{text}</span>
      </div>
      <div data-gp-content="">{children}</div>
    </section>
  );
}
