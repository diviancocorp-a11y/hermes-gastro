// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validarInitData, iguales, ultimos10, nombreDelSecreto,
} from '../../platform/functions/tg-vincular/validar.ts';
import { firmaDeWebhook } from '../../platform/functions/tg-webhook/firma.ts';

// Firma initData como lo hace Telegram (docs de Mini Apps): es la prueba de que
// validarInitData acepta lo legitimo y rechaza todo lo demas.
function firmar(campos, token) {
  const dcs = Object.entries(campos)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secreta = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secreta).update(dcs).digest('hex');
  return new URLSearchParams({ ...campos, hash }).toString();
}

const TOKEN = '123456:ABC-token-de-prueba';
const AHORA = 1_800_000_000;
const USER = JSON.stringify({ id: 4242, first_name: 'Ana', username: 'ana', allows_write_to_pm: true });
const base = { auth_date: String(AHORA - 60), query_id: 'AAH', user: USER };

describe('validarInitData', () => {
  it('acepta un initData firmado por Telegram y devuelve el usuario', async () => {
    const r = await validarInitData(firmar(base, TOKEN), TOKEN, AHORA);
    expect(r.ok).toBe(true);
    expect(r.user.id).toBe(4242);
    expect(r.user.allows_write_to_pm).toBe(true);
  });

  it('rechaza si se cambia un solo campo despues de firmar', async () => {
    const firmado = new URLSearchParams(firmar(base, TOKEN));
    firmado.set('user', JSON.stringify({ id: 9999, first_name: 'Intruso' }));
    const r = await validarInitData(firmado.toString(), TOKEN, AHORA);
    expect(r).toEqual({ ok: false, motivo: 'firma_invalida' });
  });

  it('rechaza si lo firmo otro bot (otro token)', async () => {
    const r = await validarInitData(firmar(base, 'otro:token'), TOKEN, AHORA);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('firma_invalida');
  });

  it('rechaza un initData viejo aunque la firma sea buena', async () => {
    const viejo = firmar({ ...base, auth_date: String(AHORA - 90_000) }, TOKEN);
    const r = await validarInitData(viejo, TOKEN, AHORA);
    expect(r).toEqual({ ok: false, motivo: 'vencido' });
  });

  it('rechaza una fecha del futuro', async () => {
    const futuro = firmar({ ...base, auth_date: String(AHORA + 3600) }, TOKEN);
    const r = await validarInitData(futuro, TOKEN, AHORA);
    expect(r.motivo).toBe('vencido');
  });

  it('rechaza lo vacio, sin hash y sin usuario', async () => {
    expect((await validarInitData('', TOKEN, AHORA)).motivo).toBe('faltan_datos');
    expect((await validarInitData('auth_date=1&user=x', TOKEN, AHORA)).motivo).toBe('sin_hash');
    const sinUser = firmar({ auth_date: String(AHORA - 5) }, TOKEN);
    expect((await validarInitData(sinUser, TOKEN, AHORA)).motivo).toBe('sin_usuario');
  });
});

describe('utilidades', () => {
  it('iguales compara sin importar donde difieren', () => {
    expect(iguales('abc', 'abc')).toBe(true);
    expect(iguales('abc', 'abd')).toBe(false);
    expect(iguales('abc', 'abcd')).toBe(false);
  });

  it('ultimos10 unifica las formas de escribir un telefono argentino', () => {
    const a = ultimos10('+54 9 351 555-1234');
    expect(a).toBe('3515551234');
    expect(ultimos10('0351 15 555-1234')).not.toBeNull();
    expect(ultimos10('3515551234')).toBe(a);
    expect(ultimos10('123')).toBeNull();
    expect(ultimos10(null)).toBeNull();
  });

  it('el nombre del secreto sale del slug, sin guiones y en mayusculas', () => {
    expect(nombreDelSecreto('crazy-miga')).toBe('TELEGRAM_BOT_TOKEN_CRAZYMIGA');
    expect(nombreDelSecreto('la-nona-pato')).toBe('TELEGRAM_BOT_TOKEN_LANONAPATO');
  });
});

describe('las copias de validar.ts', () => {
  // Una edge function se despliega sola y no ve la carpeta de otra, asi que
  // cada una lleva su copia. Si alguien arregla una y olvida las otras, la
  // comprobacion de firma queda distinta segun la function.
  it('son identicas en las tres functions', () => {
    const leer = (f) => readFileSync(resolve(__dirname, `../../platform/functions/${f}/validar.ts`), 'utf-8');
    expect(leer('tg-notificar')).toBe(leer('tg-vincular'));
    expect(leer('tg-webhook')).toBe(leer('tg-vincular'));
  });
});

describe('firmaDeWebhook', () => {
  it('es determinista, depende del token y solo usa caracteres que Telegram acepta', async () => {
    const a = await firmaDeWebhook(TOKEN);
    expect(a).toBe(await firmaDeWebhook(TOKEN));
    expect(a).not.toBe(await firmaDeWebhook('otro:token'));
    expect(a).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
    // La misma formula que usa el script que registra el webhook.
    const esperado = createHmac('sha256', TOKEN).update('dico-tg-webhook').digest('hex');
    expect(a).toBe(esperado);
  });
});
