// src/lib/telegram.js
// Integracion con Telegram Mini Apps (etapa 2).
//
// El catalogo ya es una web completa, asi que como mini app funciona sin
// tocar nada. Lo que esto agrega es lo que hace que se sienta parte del chat:
// abrir expandida, pintar la barra con el color del negocio y usar el boton
// Atras nativo.
//
// El SDK de Telegram (telegram.org/js/telegram-web-app.js) se carga SOLO si la
// pagina se abrio desde Telegram. Cargarlo siempre meteria un script de un
// tercero en la pagina de todos los negocios por nada.
//
// IMPORTANTE: nada de lo que viene de `initDataUnsafe` es confiable. Sirve para
// pintar, no para identificar a nadie. La identidad se valida en el servidor
// con el HMAC de `initData` (etapa 3).

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
const FLAG = 'dico_tg';
const SENIAL = /tgWebAppData|tgWebAppPlatform|tgWebAppVersion/;

/**
 * Telegram abre la mini app con `#tgWebAppData=...` en el hash. El hash se
 * pierde apenas el router navega, asi que la primera vez se anota en
 * sessionStorage y el resto de la sesion lo lee de ahi.
 */
export function venimosDeTelegram() {
  if (typeof window === 'undefined') return false;
  const enHash = SENIAL.test(window.location.hash || '');
  try {
    if (enHash) sessionStorage.setItem(FLAG, '1');
    return enHash || sessionStorage.getItem(FLAG) === '1';
  } catch {
    return enHash;
  }
}

/** Carga el SDK una sola vez. Resuelve con `window.Telegram.WebApp` o null. */
export function cargarSdk({ timeoutMs = 4000 } = {}) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);

  return new Promise((resolve) => {
    let listo = false;
    const fin = (v) => { if (!listo) { listo = true; resolve(v); } };

    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => fin(window.Telegram?.WebApp || null);
    s.onerror = () => fin(null);
    document.head.appendChild(s);

    // Un SDK que no llega no puede dejar la app esperando.
    setTimeout(() => fin(window.Telegram?.WebApp || null), timeoutMs);
  });
}

/**
 * `rgb(243, 163, 158)` o `rgba(...)` -> `#f3a39e`. Devuelve null si es
 * transparente o no se entiende: Telegram rechaza colores que no sean #rrggbb.
 */
export function rgbAHex(css) {
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(String(css || '').trim());
  if (!m) return null;
  const alfa = m[4] === undefined ? 1 : Number(m[4]);
  if (!(alfa > 0)) return null;
  const hex = [m[1], m[2], m[3]].map((n) => {
    const v = Math.max(0, Math.min(255, Number(n)));
    return v.toString(16).padStart(2, '0');
  });
  return `#${hex.join('')}`;
}

/** El color de fondo que el negocio esta pintando ahora (sale del tema). */
export function colorDeFondo() {
  if (typeof document === 'undefined') return null;
  return rgbAHex(getComputedStyle(document.body).backgroundColor)
    || rgbAHex(getComputedStyle(document.documentElement).backgroundColor);
}

/**
 * Cada llamada va en su try: las versiones viejas de Telegram no traen todos
 * los metodos y una que falte no puede tirar abajo la pagina.
 */
function intentar(fn) {
  try { fn(); } catch { /* version de Telegram sin ese metodo */ }
}

/** Pinta barra y fondo con el color del negocio. */
export function aplicarColores(tg, hex = colorDeFondo()) {
  if (!tg || !hex) return;
  intentar(() => tg.setHeaderColor(hex));
  intentar(() => tg.setBackgroundColor(hex));
  intentar(() => tg.setBottomBarColor(hex));
}

/** Abre expandida y evita que el scroll hacia abajo cierre la mini app. */
export function iniciarMiniApp(tg) {
  if (!tg) return;
  intentar(() => tg.ready());
  intentar(() => tg.expand());
  intentar(() => tg.disableVerticalSwipes());
  aplicarColores(tg);
}

/**
 * Boton Atras nativo. `visible` lo decide quien llama; el click vuelve un paso
 * en el history, que es lo que ya consume useAndroidBack para cerrar capas.
 * Devuelve una funcion que desengancha el handler.
 */
export function enlazarAtras(tg, { visible, onBack }) {
  const b = tg?.BackButton;
  if (!b) return () => {};
  intentar(() => (visible ? b.show() : b.hide()));
  if (!visible) return () => {};
  intentar(() => b.onClick(onBack));
  return () => intentar(() => b.offClick(onBack));
}
