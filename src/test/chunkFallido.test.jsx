import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// HERMES-GASTRO-S (19/oct, Monare en /ADMIN): un chunk del panel no cargo y
// el panel se rompio con "Cannot read properties of undefined (reading
// 'default')" en vez de recuperarse.
//
// Causa: useAppUpdate escuchaba vite:preloadError y le hacia preventDefault.
// Con el evento cancelado, el helper de Vite NO relanza el error: el import
// resuelve undefined, React lee .default de undefined, y el .catch de
// lazyReload (el que recarga) nunca corre.
//
// Lo que se afirma: con el hook montado, un import que falla rechaza, y
// lazyReload lo convierte en UNA recarga.

vi.mock('../lib/hardReload', () => ({ hardReload: vi.fn() }));
const { hardReload } = await import('../lib/hardReload');
const { cargarConRescate } = await import('../lib/lazyReload');

// Copia del helper de preload de Vite 8 (node_modules/vite, __vitePreload):
// el import solo rechaza si nadie cancelo vite:preloadError.
function comoVite(baseModule) {
  const handlePreloadError = (err) => {
    const e = new Event('vite:preloadError', { cancelable: true });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) throw err;
  };
  return Promise.resolve().then(() => baseModule().catch(handlePreloadError));
}

const chunkRoto = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));

beforeEach(() => {
  vi.stubEnv('PROD', true);
  globalThis.fetch = vi.fn(async () => ({ ok: false }));
  sessionStorage.clear();
  hardReload.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('chunk que no carga', () => {
  it('con useAppUpdate montado, el import rechaza en vez de resolver undefined', async () => {
    const { default: useAppUpdate } = await import('../hooks/useAppUpdate');
    const { unmount } = renderHook(() => useAppUpdate());
    await expect(comoVite(chunkRoto)).rejects.toThrow('dynamically imported module');
    unmount();
  });

  it('lazyReload recarga una vez y no vuelve a renderizar', async () => {
    const pendiente = cargarConRescate(() => comoVite(chunkRoto));
    const gano = await Promise.race([pendiente.then(() => 'resolvio', () => 'rechazo'), new Promise((r) => setTimeout(() => r('colgada'), 20))]);
    expect(gano).toBe('colgada');
    expect(hardReload).toHaveBeenCalledTimes(1);
  });

  it('si ya recargo hace menos de 60s, deja subir el error al ErrorBoundary', async () => {
    sessionStorage.setItem('hg_chunk_reload', String(Date.now()));
    await expect(cargarConRescate(() => comoVite(chunkRoto))).rejects.toThrow('dynamically imported module');
    expect(hardReload).not.toHaveBeenCalled();
  });
});
