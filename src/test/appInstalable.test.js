// La app instalable por negocio: el manifest del panel (api/manifest.js) y
// el modulo que guarda el aviso de instalacion (src/lib/instalarApp.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { medidasDeImagen } from '../../api/manifest.js';
import {
  __reiniciarInstalacion,
  aplicarCabezaDelPanel,
  apuntarManifestDelPanel,
  estadoDeInstalacion,
  pedirInstalacion,
  plataformaActual,
  primeraCuadrada,
  suscribirInstalacion,
} from '../lib/instalarApp.js';

function png(w, h) {
  const b = new Uint8Array(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return b;
}

function jpeg(w, h) {
  // SOI + APP0 corto + SOF0 con alto y ancho
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0, 0, 0, 0,
  ]);
}

const LOGO = 'https://x.supabase.co/storage/v1/object/public/tenant-images/a/logo.png';
const FAVICON = 'https://x.supabase.co/storage/v1/object/public/tenant-images/a/favicon.png';

function respuesta() {
  const res = { headers: {}, body: null, code: 0 };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.code = c; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}

async function pedir(url, { host = 'la-nona-pato.divianco.app', brand, imagenes = {} } = {}) {
  global.fetch = vi.fn(async (u) => {
    if (String(u).includes('/rpc/get_tenant_brand')) {
      return { ok: !!brand, json: async () => brand };
    }
    const img = imagenes[u];
    if (!img) return { ok: false };
    return { ok: true, arrayBuffer: async () => img.buffer };
  });
  const res = respuesta();
  await handler({ url, headers: { host } }, res);
  return { res, manifest: JSON.parse(res.body) };
}

describe('medidasDeImagen', () => {
  it('lee PNG y JPEG desde la cabecera', () => {
    expect(medidasDeImagen(png(1024, 1024))).toEqual({ w: 1024, h: 1024, type: 'image/png' });
    expect(medidasDeImagen(jpeg(704, 1524))).toEqual({ w: 704, h: 1524, type: 'image/jpeg' });
  });

  it('devuelve null si no reconoce el formato', () => {
    expect(medidasDeImagen(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('api/manifest', () => {
  const brand = { name: 'La Nona Pato', logo_color: '#A83715', logo_letter: 'N', logo_url: LOGO, favicon_url: FAVICON };

  it('el panel abre en /admin y tiene id propio, separado del catalogo', async () => {
    const { manifest } = await pedir('/api/manifest?app=panel&slug=la-nona-pato', { brand });
    expect(manifest).toMatchObject({ id: '/admin', start_url: '/admin', scope: '/admin', name: 'La Nona Pato · Panel' });
    const { manifest: catalogo } = await pedir('/api/manifest?slug=la-nona-pato', { brand });
    expect(catalogo).toMatchObject({ id: '/', start_url: '/', name: 'La Nona Pato' });
  });

  it('usa el logo cuadrado con su tamanio real antes que la letra', async () => {
    const { manifest } = await pedir('/api/manifest?app=panel&slug=la-nona-pato', {
      brand, imagenes: { [LOGO]: png(1024, 1024), [FAVICON]: png(64, 64) },
    });
    expect(manifest.icons[0]).toEqual({ src: LOGO, sizes: '1024x1024', type: 'image/png', purpose: 'any' });
    // El favicon de 64px no alcanza el minimo: no se declara.
    expect(manifest.icons.some((i) => i.src === FAVICON)).toBe(false);
    expect(manifest.icons.at(-1).src.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('un logo que no es cuadrado no se usa: queda la inicial', async () => {
    const { manifest } = await pedir('/api/manifest?app=panel&slug=crazy-miga', {
      brand: { ...brand, logo_url: LOGO, favicon_url: null }, imagenes: { [LOGO]: jpeg(704, 1524) },
    });
    expect(manifest.icons.every((i) => i.src.startsWith('data:'))).toBe(true);
  });

  it('pide solo la cabecera de la imagen', async () => {
    await pedir('/api/manifest?app=panel&slug=la-nona-pato', { brand, imagenes: { [LOGO]: png(512, 512) } });
    const pedidoLogo = global.fetch.mock.calls.find(([u]) => u === LOGO);
    expect(pedidoLogo[1].headers.Range).toMatch(/^bytes=0-\d+$/);
  });

  it('si la marca no responde, devuelve el manifest de Dico y no un error', async () => {
    const { res, manifest } = await pedir('/api/manifest?app=panel&slug=no-existe', { brand: null });
    expect(res.code).toBe(200);
    expect(manifest.name).toBe('Dico · Panel');
  });
});

describe('instalarApp', () => {
  beforeEach(() => __reiniciarInstalacion());
  afterEach(() => { document.head.innerHTML = ''; });

  it('reconoce iPhone, iPad como Mac tactil, Android y escritorio', () => {
    expect(plataformaActual({ userAgent: 'Mozilla (iPhone; CPU iPhone OS 17_0)' })).toBe('ios');
    expect(plataformaActual({ userAgent: 'Mozilla (Macintosh; Intel Mac OS X)', maxTouchPoints: 5 })).toBe('ios');
    expect(plataformaActual({ userAgent: 'Mozilla (Linux; Android 14)' })).toBe('android');
    expect(plataformaActual({ userAgent: 'Mozilla (Windows NT 10.0)' })).toBe('escritorio');
  });

  function avisoDeChrome() {
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = vi.fn(async () => {});
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    return ev;
  }

  it('en el panel guarda el aviso de Chrome y lo usa una sola vez', async () => {
    window.history.replaceState(null, '', '/admin');
    const cambios = vi.fn();
    suscribirInstalacion(cambios);
    expect(estadoDeInstalacion().puedePedir).toBe(false);

    const ev = avisoDeChrome();
    window.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(estadoDeInstalacion().puedePedir).toBe(true);
    expect(await pedirInstalacion()).toBe('accepted');
    expect(ev.prompt).toHaveBeenCalledTimes(1);
    expect(estadoDeInstalacion().puedePedir).toBe(false);
    expect(await pedirInstalacion()).toBe('no-disponible');
    expect(cambios).toHaveBeenCalled();
  });

  it('en el catalogo no toca el aviso: queda la barra de Chrome para los clientes', () => {
    window.history.replaceState(null, '', '/');
    const ev = avisoDeChrome();
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(estadoDeInstalacion().puedePedir).toBe(false);
  });

  it('si el manifest cambia despues del aviso, el aviso viejo se descarta', () => {
    window.history.replaceState(null, '', '/admin');
    document.head.innerHTML = '<link rel="manifest" href="/manifest.json">';
    window.dispatchEvent(avisoDeChrome());
    expect(estadoDeInstalacion().puedePedir).toBe(true);

    apuntarManifestDelPanel('la-nona-pato');
    expect(document.head.querySelector('link[rel="manifest"]').getAttribute('href'))
      .toBe('/api/manifest?app=panel&slug=la-nona-pato');
    expect(estadoDeInstalacion().puedePedir).toBe(false);

    // El aviso que llega con el manifest correcto se conserva al montar el panel.
    window.dispatchEvent(avisoDeChrome());
    aplicarCabezaDelPanel('la-nona-pato', { name: 'La Nona Pato' });
    expect(estadoDeInstalacion().puedePedir).toBe(true);
  });

  it('el icono de iPhone es la primera imagen cuadrada de 180px o mas', async () => {
    const medidas = { logo: { w: 704, h: 1524 }, chico: { w: 64, h: 64 }, bueno: { w: 512, h: 512 } };
    const medir = async (u) => medidas[u] || null;
    expect(await primeraCuadrada(['logo', 'chico', 'bueno'], medir)).toBe('bueno');
    expect(await primeraCuadrada(['logo', 'chico'], medir)).toBeNull();
  });

  it('marca instalada al recibir appinstalled', () => {
    window.dispatchEvent(new Event('appinstalled'));
    expect(estadoDeInstalacion().instalada).toBe(true);
  });

  it('el panel apunta al manifest del panel y al logo, y lo deshace al salir', () => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/apple-touch-icon.png">';
    const deshacer = aplicarCabezaDelPanel('la-nona-pato', { name: 'La Nona Pato', logo_url: LOGO });

    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="manifest"]').getAttribute('href'))
      .toBe('/api/manifest?app=panel&slug=la-nona-pato');
    expect(document.head.querySelector('meta[name="apple-mobile-web-app-title"]').getAttribute('content')).toBe('La Nona Pato');

    deshacer();
    expect(document.head.querySelector('link[rel="manifest"]').getAttribute('href')).toBe('/manifest.json');
    expect(document.head.querySelector('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/apple-touch-icon.png');
    expect(document.head.querySelector('meta[name="apple-mobile-web-app-title"]')).toBeNull();
  });
});
