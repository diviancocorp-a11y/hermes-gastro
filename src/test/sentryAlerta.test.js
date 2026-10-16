// sentry-alerta: que solo pase lo firmado por Sentry y que el aviso diga a que
// negocio le paso.
import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  firmaValida, leerAlerta, armarMensaje, negocioDeUrl, resumenParaCerebro,
} from '../../platform/functions/sentry-alerta/validar.ts';

const SECRETO = 'secreto-de-prueba';
const firmar = (cuerpo, s = SECRETO) => createHmac('sha256', s).update(cuerpo).digest('hex');

describe('firmaValida', () => {
  const cuerpo = '{"action":"triggered"}';
  it('acepta la firma de Sentry', async () => {
    expect(await firmaValida(SECRETO, cuerpo, firmar(cuerpo))).toBe(true);
  });
  it('rechaza otra clave, otro cuerpo o sin firma', async () => {
    expect(await firmaValida(SECRETO, cuerpo, firmar(cuerpo, 'otra'))).toBe(false);
    expect(await firmaValida(SECRETO, cuerpo + ' ', firmar(cuerpo))).toBe(false);
    expect(await firmaValida(SECRETO, cuerpo, null)).toBe(false);
    expect(await firmaValida('', cuerpo, firmar(cuerpo, ''))).toBe(false);
  });
});

describe('negocioDeUrl', () => {
  it('sale del subdominio', () => {
    expect(negocioDeUrl('https://crazy-miga.divianco.app/checkout?x=1')).toBe('crazy-miga');
  });
  it('la raiz, www u otro dominio no son negocio', () => {
    expect(negocioDeUrl('https://divianco.app/')).toBe(null);
    expect(negocioDeUrl('https://www.divianco.app/')).toBe(null);
    expect(negocioDeUrl('https://hermes-platform.vercel.app/')).toBe(null);
    expect(negocioDeUrl('no es url')).toBe(null);
  });
});

describe('leerAlerta', () => {
  const eventAlert = {
    action: 'triggered',
    data: {
      triggered_rule: 'Error nuevo',
      event: {
        title: 'TypeError: e is not a function',
        culprit: 'Settings',
        level: 'error',
        web_url: 'https://grupo-divianco.sentry.io/issues/1/events/abc/',
        release: 'dico@67e8f73a',
        request: { url: 'https://la-nona-pato.divianco.app/admin' },
        tags: [['screen', '/admin'], ['tenant', 'edificio']],
      },
    },
  };

  it('regla de alerta: titulo, negocio, pantalla y link', () => {
    expect(leerAlerta('event_alert', eventAlert)).toMatchObject({
      titulo: 'TypeError: e is not a function',
      negocio: 'la-nona-pato',
      pantalla: '/admin',
      release: 'dico@67e8f73a',
      link: 'https://grupo-divianco.sentry.io/issues/1/events/abc/',
    });
  });

  it('issue creado tambien avisa', () => {
    const a = leerAlerta('issue', { action: 'created', data: { issue: { title: 'X', web_url: 'u' } } });
    expect(a).toMatchObject({ titulo: 'X', link: 'u' });
  });

  it('lo demas se ignora (instalacion, issue resuelto)', () => {
    expect(leerAlerta('installation', { action: 'created', data: {} })).toBe(null);
    expect(leerAlerta('issue', { action: 'resolved', data: { issue: {} } })).toBe(null);
  });

  it('el mensaje escapa HTML y nombra al negocio', () => {
    // \x3c en vez de "<": check-file-integrity toma "<b>" en un .js como JSX.
    const a = { ...leerAlerta('event_alert', eventAlert), titulo: 'Error \x3cscript>' };
    const m = armarMensaje(a, 'Afecta al panel.');
    expect(m).toContain('\x3cb>la-nona-pato\x3c/b>');
    expect(m).toContain('Error &lt;script&gt;');
    expect(m).toContain('🧠 Afecta al panel.');
    expect(m).toContain('\x3ca href="https://grupo-divianco.sentry.io/issues/1/events/abc/">Ver en Sentry\x3c/a>');
  });

  it('al cerebro solo le llega el error', () => {
    const r = resumenParaCerebro(leerAlerta('event_alert', eventAlert));
    expect(r).toBe('Error: TypeError: e is not a function\nDonde: Settings\nNegocio: la-nona-pato\nPantalla: /admin');
  });
});
