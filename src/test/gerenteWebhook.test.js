// @vitest-environment node
// gerente-webhook: la firma que valida la function es la que registra el
// script, y los resumenes que ve el modelo no mienten ni filtran datos.
import { describe, it, expect } from 'vitest';
import { firmaDelGerente, iguales } from '../../platform/functions/gerente-webhook/firma.ts';
import { firmaDelGerente as firmaDelScript } from '../../platform/scripts/gerente-webhook.mjs';
import { firmaDeWebhook } from '../../platform/functions/tg-webhook/firma.ts';
import {
  cortar, diasValidos, HERRAMIENTAS, resumirPedidos, slugValido,
} from '../../platform/functions/gerente-webhook/herramientas.ts';

const TOKEN = '123456:ABC-token-de-prueba';

describe('firma del webhook', () => {
  it('la function y el script de registro calculan lo mismo', async () => {
    expect(await firmaDelGerente(TOKEN)).toBe(firmaDelScript(TOKEN));
  });

  it('no es la misma que la de tg-webhook', async () => {
    expect(await firmaDelGerente(TOKEN)).not.toBe(await firmaDeWebhook(TOKEN));
  });

  it('solo usa caracteres que Telegram acepta en secret_token', async () => {
    expect(await firmaDelGerente(TOKEN)).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
  });

  it('iguales compara exacto', () => {
    expect(iguales('abc', 'abc')).toBe(true);
    expect(iguales('abc', 'abd')).toBe(false);
    expect(iguales('abc', 'abcd')).toBe(false);
  });
});

describe('argumentos que manda el modelo', () => {
  it('slug: solo minusculas, numeros y guiones', () => {
    expect(slugValido(' Crazy-Miga ')).toBe('crazy-miga');
    expect(slugValido("x' or 1=1")).toBeNull();
    expect(slugValido('')).toBeNull();
  });

  it('dias: de 1 a 31, 7 si no viene', () => {
    expect(diasValidos(undefined)).toBe(7);
    expect(diasValidos(0)).toBe(7);
    expect(diasValidos(3)).toBe(3);
    expect(diasValidos(400)).toBe(31);
  });
});

describe('resumirPedidos', () => {
  const filas = [
    { status: 'completed', channel: 'catalog', total: '9000.00', created_at: '2026-10-10T12:00:00Z' },
    { status: 'cancelled', channel: 'catalog', total: '18000', created_at: '2026-10-12T12:00:00Z' },
    { status: 'pending', channel: 'telegram', total: 33000, created_at: '2026-10-11T12:00:00Z' },
  ];

  it('los cancelados no suman a lo facturado', () => {
    const r = resumirPedidos(filas, 7);
    expect(r.pedidos).toBe(3);
    expect(r.facturado_sin_cancelados).toBe(42000);
    expect(r.por_estado).toEqual({ completed: 1, cancelled: 1, pending: 1 });
    expect(r.por_canal).toEqual({ catalog: 2, telegram: 1 });
    expect(r.ultimo_pedido).toBe('2026-10-12T12:00:00Z');
  });

  it('sin pedidos', () => {
    expect(resumirPedidos([], 7)).toMatchObject({ pedidos: 0, facturado_sin_cancelados: 0, ultimo_pedido: null });
  });
});

describe('herramientas', () => {
  it('ninguna escribe: los nombres son todos de consulta', () => {
    expect(HERRAMIENTAS.map((h) => h.function.name).sort()).toEqual(['negocios', 'pedidos', 'productos']);
  });

  it('cortar respeta el limite de Telegram', () => {
    expect(cortar('hola')).toBe('hola');
    expect(cortar('x'.repeat(5000)).length).toBe(4000);
  });
});
