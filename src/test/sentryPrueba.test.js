// probar_alerta: el error de prueba sale con el DSN del build y crea un issue
// nuevo cada vez (la regla de Sentry avisa solo por issue nuevo).
import { describe, it, expect } from 'vitest';
import { armarPrueba, dsnDelCodigo } from '../../scripts/sentry-prueba.mjs';

const DSN = 'https://f552d967abb846cfc2fff7fb7d43e372@o4511476584742912.ingest.us.sentry.io/4511476631207936';

describe('dsnDelCodigo', () => {
  it('saca el DSN del chunk minificado', () => {
    expect(dsnDelCodigo(`var s=\`${DSN}\`,c=\`production\``)).toBe(DSN);
  });
  it('sin DSN da null', () => {
    expect(dsnDelCodigo('var s=``')).toBe(null);
    expect(dsnDelCodigo(undefined)).toBe(null);
  });
});

describe('armarPrueba', () => {
  it('apunta al store del proyecto con la key del DSN', () => {
    const p = armarPrueba(DSN, new Date('2026-10-17T10:00:00Z'));
    expect(p.url).toBe('https://o4511476584742912.ingest.us.sentry.io/api/4511476631207936/store/');
    expect(p.headers['X-Sentry-Auth']).toContain('sentry_key=f552d967abb846cfc2fff7fb7d43e372');
    expect(p.body.tags.prueba).toBe('alerta');
    expect(p.body.request.url).toBe('https://prueba.divianco.app/prueba');
  });
  it('cada corrida es un issue nuevo', () => {
    const a = armarPrueba(DSN, new Date('2026-10-17T10:00:00Z'));
    const b = armarPrueba(DSN, new Date('2026-10-17T10:05:00Z'));
    expect(a.body.fingerprint).not.toEqual(b.body.fingerprint);
  });
});
