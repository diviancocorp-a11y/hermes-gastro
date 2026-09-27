import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Los headers de seguridad viven en vercel.json y no los ve ningun otro gate:
// el build no los lee y vite preview no los aplica. Este test es lo unico que
// nota si alguien los borra.
//
// El caso que mas importa es la CSP: permite los dos scripts inline de
// index.html por su hash. Si se toca una coma de esos scripts el hash cambia,
// el navegador los bloquea en cuanto la CSP pase de Report-Only a enforce, y
// el tema se pinta tarde en TODOS los negocios. El test compara los hashes
// contra el archivo real, asi que el aviso llega en el commit y no en prod.

const RAIZ = resolve(__dirname, '../..');
const vercel = JSON.parse(readFileSync(resolve(RAIZ, 'vercel.json'), 'utf-8'));
const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf-8');

function headersGlobales() {
  const regla = vercel.headers.find((h) => h.source === '/(.*)');
  if (!regla) throw new Error('vercel.json no tiene la regla de headers "/(.*)"');
  return Object.fromEntries(regla.headers.map((h) => [h.key, h.value]));
}

const sha = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

function hashesDeScriptsInline() {
  // Los que ejecutan: sin src y sin ser JSON-LD, que es un bloque de datos y
  // la CSP no lo mira.
  const re = /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g;
  const bloques = [...html.matchAll(re)].map((m) => sha(m[1]));
  // Los atributos on*="" (el onload de la carga de fuentes) tambien son
  // scripts inline; la CSP los habilita con 'unsafe-hashes' + su hash.
  const handlers = [...html.matchAll(/\son[a-z]+="([^"]*)"/g)].map((m) => sha(m[1]));
  return [...bloques, ...handlers];
}

describe('headers de seguridad (vercel.json)', () => {
  const h = headersGlobales();

  it('estan los basicos', () => {
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(h['Referrer-Policy']).toBeTruthy();
    expect(h['Permissions-Policy']).toContain('microphone=()');
  });

  it('la CSP que se aplica no deja embeber ni inyectar plugins', () => {
    const csp = h['Content-Security-Policy'];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it('la CSP permite exactamente los scripts inline de index.html', () => {
    const csp = h['Content-Security-Policy-Report-Only'];
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
    const enCsp = scriptSrc.split(/\s+/).filter((t) => t.startsWith("'sha256-"));
    const enHtml = hashesDeScriptsInline();

    expect(enHtml.length).toBeGreaterThan(0);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    // Si falla: recalcular con el mismo regex de arriba y pegar los hashes
    // nuevos en vercel.json. No agregar 'unsafe-inline' para salir del paso.
    expect([...enCsp].sort()).toEqual([...enHtml].sort());
  });
});
