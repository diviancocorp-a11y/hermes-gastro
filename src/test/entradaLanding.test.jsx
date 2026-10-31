import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import _EntradaLanding from '../components/landing/EntradaLanding';

const html = readFileSync('index.html', 'utf8');
const arranque = html.match(/<script data-dico-entrada-script>([\s\S]*?)<\/script>/)[1];
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
let decode;
beforeEach(() => {
  vi.useFakeTimers(); sessionStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  document.body.innerHTML = '<div id="dico-entrada" data-inicio="0"></div><div id="root"><figure class="pl-tiempo-escena"><img src="/brand/landing/parallax/cielo.webp" alt="" /></figure></div>';
  document.getElementById('dico-entrada').dataset.inicio = String(Date.now());
  Object.defineProperty(document.querySelector('img'), 'complete', { value: true });
  decode = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document.querySelector('img'), 'decode', { value: decode });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
});
afterEach(() => {
  cleanup(); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else delete document.fonts;
});

it('espera el hero y las fuentes, abre y libera la pagina', async () => {
  await act(async () => render(<_EntradaLanding />));
  const root = document.getElementById('root');
  expect(root.inert).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(1800));
  expect(document.getElementById('dico-entrada')).not.toHaveClass('de-salida');
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(document.getElementById('dico-entrada')).toHaveClass('de-salida');
  expect(decode).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(480));
  expect(document.getElementById('dico-entrada')).toBeNull();
  expect(root.inert).not.toBe(true);
  expect(sessionStorage.getItem('dico:entrada-v1')).toBe('1');
});

it('no bloquea indefinidamente si una fuente o imagen no termina', async () => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise(() => {}) } });
  await act(async () => render(<_EntradaLanding />));
  await act(async () => vi.advanceTimersByTimeAsync(6500));
  expect(document.getElementById('dico-entrada')).toHaveClass('de-salida');
  await act(async () => vi.advanceTimersByTimeAsync(480));
  expect(document.getElementById('dico-entrada')).toBeNull();
  expect(document.getElementById('root').inert).not.toBe(true);
});

it('el arranque solo cubre la home y omite anclas, sesiones vistas y movimiento reducido', () => {
  const iniciar = new Function('window', 'document', 'sessionStorage', arranque);
  const probar = (hostname, pathname, hash = '', reducido = false) => {
    const el = document.getElementById('dico-entrada'); el.hidden = true;
    iniciar({ location: { hostname, pathname, hash }, matchMedia: () => ({ matches: reducido }) }, document, sessionStorage);
    return !el.hidden;
  };
  expect(probar('divianco.app', '/')).toBe(true);
  expect(probar('crazy-miga.divianco.app', '/')).toBe(false);
  expect(probar('divianco.app', '/admin')).toBe(false);
  expect(probar('divianco.app', '/registro')).toBe(false);
  expect(probar('preview.vercel.app', '/landing')).toBe(true);
  expect(probar('divianco.app', '/', '#comparar-planes')).toBe(false);
  expect(probar('divianco.app', '/', '', true)).toBe(false);
  sessionStorage.setItem('dico:entrada-v1', '1');
  expect(probar('divianco.app', '/')).toBe(false);
});
