// src/lib/instalarApp.js
// Instalar el panel como app (PWA) en la compu, Android o iPhone.
//
// Chrome y Edge (escritorio y Android) avisan que se puede instalar con el
// evento `beforeinstallprompt`, que se dispara UNA vez y temprano, muchas
// veces antes de que React monte el panel. Por eso se escucha al importar
// este modulo (main.jsx lo importa primero) y se guarda para usarlo cuando
// el usuario toca "Instalar app". Safari (iPhone y Mac) y Firefox no tienen
// ese evento: ahi solo se puede explicar el camino a mano.

let aviso = null;
let instalada = false;
const oyentes = new Set();

function avisar() {
  for (const fn of oyentes) {
    try { fn(); } catch { /* un oyente roto no frena a los demas */ }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Solo en el panel: ahi la instalacion se ofrece desde el menu y la barra
    // propia de Chrome sobra. En el catalogo no hay boton, asi que se deja
    // la barra de Chrome para que los clientes puedan instalar la tienda.
    if (!esRutaDelPanel()) return;
    e.preventDefault();
    aviso = e;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    aviso = null;
    instalada = true;
    avisar();
  });
}

function esRutaDelPanel() {
  const p = window.location?.pathname || '';
  return p === '/admin' || p.startsWith('/admin/');
}

export function urlDelManifestDelPanel(slug) {
  return slug ? `/api/manifest?app=panel&slug=${encodeURIComponent(slug)}` : '/api/manifest?app=panel';
}

/**
 * Apunta el <link rel=manifest> al del panel lo antes posible (main.jsx, antes
 * del render). index.html trae el del catalogo; si Chrome evalua la
 * instalacion con ese, el aviso que guarda instalaria la tienda en "/".
 * Si el href cambia, el aviso previo queda viejo y se descarta: hasta que
 * Chrome avise de nuevo, el boton muestra la guia.
 */
export function apuntarManifestDelPanel(slug) {
  if (typeof document === 'undefined') return;
  const href = urlDelManifestDelPanel(slug);
  const links = [...document.head.querySelectorAll('link[rel="manifest"]')];
  if (links.length === 1 && links[0].getAttribute('href') === href) return;
  links.forEach((n) => n.remove());
  const el = document.createElement('link');
  el.setAttribute('rel', 'manifest');
  el.setAttribute('href', href);
  document.head.appendChild(el);
  if (aviso) { aviso = null; avisar(); }
}

/** true si la pagina ya corre como app instalada (sin barra del browser). */
export function corriendoInstalada() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch { /* matchMedia raro: se sigue */ }
  return window.navigator?.standalone === true;
}

/**
 * Plataforma para elegir las instrucciones. El iPad con iPadOS se presenta
 * como Mac: se lo distingue por la pantalla tactil.
 */
export function plataformaActual(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const ua = nav.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (nav.maxTouchPoints || 0) > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'escritorio';
}

/**
 * Lo que la UI necesita saber para decidir que mostrar.
 * - instalada: ya corre como app (no hay nada que ofrecer).
 * - puedePedir: hay aviso guardado; el boton dispara el dialogo del sistema.
 * - plataforma: 'ios' | 'android' | 'escritorio', para las instrucciones.
 */
export function estadoDeInstalacion() {
  return {
    instalada: instalada || corriendoInstalada(),
    puedePedir: !!aviso,
    plataforma: plataformaActual(),
  };
}

/** Se llama cada vez que cambia el estado. Devuelve la funcion para soltarlo. */
export function suscribirInstalacion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/**
 * Abre el dialogo de instalacion del sistema. El aviso sirve una sola vez:
 * despues de usarlo se descarta, aunque el usuario cancele.
 * @returns {Promise<'accepted'|'dismissed'|'no-disponible'>}
 */
export async function pedirInstalacion() {
  const e = aviso;
  if (!e) return 'no-disponible';
  aviso = null;
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'dismissed';
  } finally {
    avisar();
  }
}

/** Reemplaza el <link>/<meta> indicado y devuelve como dejarlo como estaba. */
function pisar(selector, crear, atributo, valor) {
  const previos = [...document.head.querySelectorAll(selector)];
  const guardados = previos.map((n) => n.getAttribute(atributo));
  previos.forEach((n) => n.remove());
  const nuevo = crear();
  nuevo.setAttribute(atributo, valor);
  document.head.appendChild(nuevo);
  return () => {
    nuevo.remove();
    previos.forEach((n, i) => {
      if (guardados[i] != null) n.setAttribute(atributo, guardados[i]);
      document.head.appendChild(n);
    });
  };
}

function link(rel) {
  return () => { const el = document.createElement('link'); el.setAttribute('rel', rel); return el; };
}

function meta(name) {
  return () => { const el = document.createElement('meta'); el.setAttribute('name', name); return el; };
}

/**
 * Apunta el <head> a la app del PANEL del negocio: manifest con
 * start_url /admin (el de index.html es el del catalogo) e icono y nombre
 * para el "Agregar a inicio" de iPhone, que no lee el icono del manifest.
 * @param {string} slug
 * @param {{ name?: string, logo_url?: string, favicon_url?: string }} [brand]
 * @returns {() => void} deshace los cambios (al desmontar el panel)
 */
export function aplicarCabezaDelPanel(slug, brand) {
  if (typeof document === 'undefined' || !slug) return () => {};
  const hrefManifest = urlDelManifestDelPanel(slug);
  const yaApuntado = document.head.querySelector('link[rel="manifest"]')?.getAttribute('href') === hrefManifest;
  if (!yaApuntado && aviso) { aviso = null; avisar(); }
  const deshacer = [
    pisar('link[rel="manifest"]', link('manifest'), 'href', hrefManifest),
    pisar('meta[name="mobile-web-app-capable"]', meta('mobile-web-app-capable'), 'content', 'yes'),
    pisar('meta[name="apple-mobile-web-app-capable"]', meta('apple-mobile-web-app-capable'), 'content', 'yes'),
  ];
  if (brand?.name) {
    deshacer.push(pisar('meta[name="apple-mobile-web-app-title"]',
      meta('apple-mobile-web-app-title'), 'content', brand.name));
  }
  // iPhone no lee el icono del manifest: usa apple-touch-icon y lo recorta
  // a cuadrado. Mismo criterio que api/manifest.js: solo una imagen cuadrada
  // de 180px o mas (Crazy Miga tiene un logo vertical y La Nona Pato un
  // favicon de 64px). Se mide en el browser porque aca no hay cabeceras.
  let vivo = true;
  const candidatos = [...new Set([brand?.logo_url, brand?.favicon_url].filter(Boolean))];
  primeraCuadrada(candidatos).then((icono) => {
    if (vivo && icono) deshacer.push(pisar('link[rel="apple-touch-icon"]', link('apple-touch-icon'), 'href', icono));
  });
  return () => { vivo = false; deshacer.reverse().forEach((fn) => fn()); };
}

const LADO_MINIMO_IOS = 180;

function medirEnElBrowser(src) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** La primera imagen cuadrada y suficientemente grande, o null. */
export async function primeraCuadrada(urls, medir = medirEnElBrowser) {
  for (const u of urls) {
    const m = await medir(u);
    if (m && m.w === m.h && m.w >= LADO_MINIMO_IOS) return u;
  }
  return null;
}

/** Solo para tests: vuelve el modulo al estado inicial. */
export function __reiniciarInstalacion() {
  aviso = null;
  instalada = false;
  oyentes.clear();
}
