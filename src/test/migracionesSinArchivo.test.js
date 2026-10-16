// check-migraciones-sin-archivo: que lo aplicado al edificio tenga su archivo.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { normalizar, sinArchivo } from '../../scripts/check-migraciones-sin-archivo.mjs';

const h = (...nombres) => nombres.map((name) => ({ name }));

describe('normalizar', () => {
  it('saca el numero y el .sql', () => {
    expect(normalizar('0040_idempotencia.sql')).toBe('idempotencia');
    expect(normalizar('0036b_push_rpcs_por_slug')).toBe('push_rpcs_por_slug');
    expect(normalizar('idempotencia')).toBe('idempotencia');
  });
});

describe('sinArchivo', () => {
  it('con o sin numero en el historial, matchea el archivo', () => {
    expect(sinArchivo(h('idempotencia', '0041_otra'), ['0040_idempotencia.sql', '0041_otra.sql'], []))
      .toEqual({ nuevas: [], resueltas: [] });
  });

  it('una aplicada sin archivo es nueva (alta_de_duenio_con_roles, 16/oct)', () => {
    expect(sinArchivo(h('alta_de_duenio_con_roles'), ['0008_profiles_and_provision_owner.sql'], []).nuevas)
      .toEqual(['alta_de_duenio_con_roles']);
  });

  it('las de la lista no fallan', () => {
    expect(sinArchivo(h('vieja'), [], ['vieja'])).toEqual({ nuevas: [], resueltas: [] });
  });

  it('una de la lista que ya tiene archivo queda para podar', () => {
    expect(sinArchivo(h('vieja'), ['0099_vieja.sql'], ['vieja']).resueltas).toEqual(['vieja']);
  });

  it('un archivo sin fila en el historial no es problema (aplicado desde el panel)', () => {
    expect(sinArchivo(h(), ['0062_drop_sumar_staff.sql'], [])).toEqual({ nuevas: [], resueltas: [] });
  });
});

it('la lista no tiene nombres que ya matchean un archivo del repo', () => {
  const { conocidas } = JSON.parse(readFileSync('scripts/migraciones-sin-archivo.json', 'utf8'));
  const repo = new Set(readdirSync('platform/migrations').filter((f) => f.endsWith('.sql')).map(normalizar));
  expect(conocidas.filter((n) => repo.has(normalizar(n)))).toEqual([]);
});
