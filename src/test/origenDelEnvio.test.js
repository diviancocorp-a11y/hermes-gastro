import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  coordenadaValida, origenDelEnvio, cotizarEnvio, urlsBusquedaDireccion, estimarEnvio,
} from '../modules/origenDelEnvio';

// Dos negocios del edificio en ciudades distintas. Antes los dos cotizaban
// contra el mismo punto del build.
const CORDOBA = { store_lat: -31.4201, store_lng: -64.1888, country: 'AR' };
const MONTEVIDEO = { store_lat: -34.9011, store_lng: -56.1645, country: 'UY' };
// Un cliente a ~1,5 km del centro de Cordoba.
const CLIENTE_CORDOBA = { lat: -31.4100, lng: -64.1780 };

const PRICING = [
  { max_km: 3, cost: 700 },
  { max_km: null, cost: 9000 },
];

describe('origenDelEnvio', () => {
  it('usa la sucursal del tenant cuando get_catalog la trae', () => {
    expect(origenDelEnvio(CORDOBA)).toEqual({ lat: -31.4201, lng: -64.1888 });
  });

  it('acepta lat/lng como string (numeric de Postgres serializado)', () => {
    expect(origenDelEnvio({ store_lat: '-31.4201', store_lng: '-64.1888' }))
      .toEqual({ lat: -31.4201, lng: -64.1888 });
  });

  it('sin ubicacion cargada no hay origen: no se inventa uno', () => {
    // El 27/sep se sacaron las ubicaciones del build; la base rechaza el pedido
    // sin ubicacion (0083), asi que el cliente tampoco cotiza contra un punto ajeno.
    for (const s of [null, {}, { store_lat: null, store_lng: null }, { store_lat: -31.4 }]) {
      expect(origenDelEnvio(s)).toBeNull();
    }
  });

  it('no toma 0,0 ni valores fuera de rango como un local', () => {
    expect(coordenadaValida(0, 0)).toBe(false);
    expect(coordenadaValida(-91, 10)).toBe(false);
    expect(coordenadaValida(10, 181)).toBe(false);
    expect(coordenadaValida('', '')).toBe(false);
    expect(origenDelEnvio({ store_lat: 0, store_lng: 0 })).toBeNull();
  });
});

describe('cotizarEnvio con un origen por tenant', () => {
  it('el mismo cliente cuesta distinto segun desde donde sale el envio', () => {
    const desdeCordoba = cotizarEnvio(origenDelEnvio(CORDOBA), CLIENTE_CORDOBA, PRICING);
    const desdeMontevideo = cotizarEnvio(origenDelEnvio(MONTEVIDEO), CLIENTE_CORDOBA, PRICING);
    expect(desdeCordoba.km).toBeLessThan(3);
    expect(desdeCordoba.cost).toBe(700);
    expect(desdeMontevideo.km).toBeGreaterThan(400);
    expect(desdeMontevideo.cost).toBe(9000);
  });

  it('redondea a un decimal y acepta el destino como string (Nominatim)', () => {
    const { km } = cotizarEnvio(origenDelEnvio(CORDOBA), { lat: '-31.4100', lng: '-64.1780' });
    expect(Number.isInteger(km * 10)).toBe(true);
  });

  it('sin pricing del tenant usa los escalones default', () => {
    expect(cotizarEnvio(origenDelEnvio(CORDOBA), CLIENTE_CORDOBA).cost).toBe(500);
  });
});

describe('urlsBusquedaDireccion', () => {
  it('no le pega ninguna ciudad fija a la direccion', () => {
    for (const url of urlsBusquedaDireccion('San Martin 1234', { origen: origenDelEnvio(CORDOBA), country: 'AR' })) {
      expect(decodeURIComponent(url)).not.toMatch(/Buenos Aires/);
      expect(url).toContain(`q=${encodeURIComponent('San Martin 1234')}`);
    }
  });

  it('busca primero alrededor del local y despues en todo el pais', () => {
    const [cerca, pais] = urlsBusquedaDireccion('San Martin 1234', { origen: origenDelEnvio(CORDOBA), country: 'AR' });
    expect(cerca).toContain('countrycodes=ar');
    expect(cerca).toContain('bounded=1');
    const caja = new URL(cerca).searchParams.get('viewbox').split(',').map(Number);
    const [oeste, norte, este, sur] = caja;
    expect(oeste).toBeLessThan(-64.1888);
    expect(este).toBeGreaterThan(-64.1888);
    expect(norte).toBeGreaterThan(-31.4201);
    expect(sur).toBeLessThan(-31.4201);
    expect(pais).toContain('countrycodes=ar');
    expect(pais).not.toContain('viewbox');
  });

  it('acota al pais del negocio, y a Argentina si no se sabe', () => {
    expect(urlsBusquedaDireccion('18 de Julio 1000', { country: 'UY' })[0]).toContain('countrycodes=uy');
    expect(urlsBusquedaDireccion('Corrientes 1000', {})[0]).toContain('countrycodes=ar');
  });
});

describe('estimarEnvio', () => {
  const respuesta = (data) => Promise.resolve({ json: () => Promise.resolve(data) });

  it('cotiza contra el origen del tenant con lo que devuelve Nominatim', async () => {
    const fetchImpl = vi.fn(() => respuesta([{ lat: '-31.4100', lon: '-64.1780' }]));
    const r = await estimarEnvio('Colon 500', { origen: origenDelEnvio(CORDOBA), country: 'AR', pricing: PRICING, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(r.cost).toBe(700);
    expect(r.km).toBeLessThan(3);
  });

  it('si no hay nada cerca del local, busca en todo el pais', async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => respuesta([]))
      .mockImplementationOnce(() => respuesta([{ lat: '-32.9468', lon: '-60.6393' }]));
    const r = await estimarEnvio('Cordoba 1000, Rosario', { origen: origenDelEnvio(CORDOBA), country: 'AR', pricing: PRICING, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).not.toContain('viewbox');
    expect(r.cost).toBe(9000);
  });

  it('devuelve null si Nominatim no la encuentra', async () => {
    const fetchImpl = vi.fn(() => respuesta([]));
    expect(await estimarEnvio('asdfgh', { origen: origenDelEnvio(CORDOBA), fetchImpl })).toBeNull();
  });
});

describe('get_catalog devuelve el origen', () => {
  // Guarda de contrato: si una migracion posterior reescribe get_catalog y se
  // olvida estas claves, el checkout vuelve en silencio al punto del build.
  it('la ultima migracion que define get_catalog emite store_lat, store_lng y country', () => {
    const dir = 'platform/migrations';
    const ultima = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
      .filter(f => /create or replace function public\.get_catalog\b/i.test(readFileSync(`${dir}/${f}`, 'utf-8')))
      .pop();
    const sql = readFileSync(`${dir}/${ultima}`, 'utf-8');
    expect(sql).toMatch(/'store_lat'/);
    expect(sql).toMatch(/'store_lng'/);
    expect(sql).toMatch(/'country'/);
  });
});
