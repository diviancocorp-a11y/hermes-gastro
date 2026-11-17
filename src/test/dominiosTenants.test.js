// Alta automatica del subdominio de cada tenant en Vercel (17/nov: mia-estudio
// estuvo caido porque se habia cargado "miaestudio").
import { describe, it, expect, vi } from 'vitest';
import { asegurarDominios, faltantes, dominioDe } from '../../scripts/dominios-tenants.mjs';

const resp = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

describe('faltantes', () => {
  it('compara contra los dominios del proyecto, sin duplicados ni mayusculas', () => {
    expect(faltantes(['cochi', 'mia-estudio', 'Cochi', ''], ['cochi.divianco.app', 'miaestudio.divianco.app']))
      .toEqual(['mia-estudio.divianco.app']);
  });
  it('dominioDe', () => expect(dominioDe(' Monare ')).toBe('monare.divianco.app'));
});

describe('asegurarDominios', () => {
  it('sin token no llama a Vercel', async () => {
    const f = vi.fn();
    expect(await asegurarDominios(['cochi'], { env: {}, fetchImpl: f })).toMatchObject({ sinToken: true });
    expect(f).not.toHaveBeenCalled();
  });
  it('agrega solo los que faltan y reporta los errores', async () => {
    const f = vi.fn(async (url, o = {}) => {
      if (!o.method) return resp(200, { domains: [{ name: 'cochi.divianco.app' }] });
      const { name } = JSON.parse(o.body);
      return name.startsWith('nuevo') ? resp(200, { name }) : resp(409, { error: 'x' });
    });
    const r = await asegurarDominios(['cochi', 'nuevo', 'roto'], { env: { VERCEL_TOKEN: 't' }, fetchImpl: f });
    expect(r.faltaban).toEqual(['nuevo.divianco.app', 'roto.divianco.app']);
    expect(r.agregados).toEqual(['nuevo.divianco.app']);
    expect(r.errores).toHaveLength(1);
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
  });
  it('--solo-mirar no agrega nada', async () => {
    const f = vi.fn(async () => resp(200, { domains: [] }));
    const r = await asegurarDominios(['cochi'], { env: { VERCEL_TOKEN: 't' }, fetchImpl: f, soloMirar: true });
    expect(r.faltaban).toEqual(['cochi.divianco.app']);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
