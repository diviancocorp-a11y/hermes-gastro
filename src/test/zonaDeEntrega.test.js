import { describe, it, expect } from 'vitest';
import { evaluarZona, normalizarLugar, urlsBusquedaDireccion } from '../modules/origenDelEnvio';

const ZONA = {
  partidos: ['Vicente López', 'San Isidro', 'San Fernando', 'Tigre', 'Pilar'],
  notice: 'Entregamos de General Paz a Pilar.',
};

// Formas reales que devolvio Nominatim (8/oct/2026): el partido viene en claves
// distintas segun la zona, y la Capital trae state + ISO propios.
const SAN_ISIDRO = {
  road: 'Avenida del Libertador', town: 'Martínez',
  county: 'Partido de San Isidro', state: 'Buenos Aires', 'ISO3166-2-lvl4': 'AR-B', country_code: 'ar',
};
const PILAR = {
  house_number: '500', road: 'Tucumán', quarter: 'Villa Morra', town: 'Pilar',
  state_district: 'Partido del Pilar', state: 'Buenos Aires', 'ISO3166-2-lvl4': 'AR-B', country_code: 'ar',
};
const CABA = {
  road: 'Avenida Rivadavia', suburb: 'Caballito', city: 'Buenos Aires',
  state_district: 'Comuna 6', state: 'Ciudad Autónoma de Buenos Aires', 'ISO3166-2-lvl4': 'AR-C',
};

describe('normalizarLugar', () => {
  it('unifica las formas de escribir un partido', () => {
    expect(normalizarLugar('Partido del Pilar')).toBe('pilar');
    expect(normalizarLugar('Partido de San Isidro')).toBe('san isidro');
    expect(normalizarLugar('Vicente López')).toBe('vicente lopez');
    expect(normalizarLugar('  PILAR ')).toBe('pilar');
    expect(normalizarLugar(null)).toBe('');
  });
});

describe('evaluarZona', () => {
  it('San Isidro (partido en county) y Pilar (en state_district) estan dentro', () => {
    expect(evaluarZona(SAN_ISIDRO, ZONA).estado).toBe('dentro');
    expect(evaluarZona(PILAR, ZONA).estado).toBe('dentro');
  });

  it('la Ciudad de Buenos Aires esta fuera: General Paz es el limite', () => {
    const r = evaluarZona(CABA, ZONA);
    expect(r.estado).toBe('fuera');
    expect(r.lugar).toBe('Ciudad de Buenos Aires');
  });

  it('un partido que se conoce y no esta en la lista queda fuera', () => {
    const lomas = { county: 'Partido de Lomas de Zamora', state: 'Buenos Aires' };
    const r = evaluarZona(lomas, ZONA);
    expect(r.estado).toBe('fuera');
    expect(r.lugar).toBe('Partido de Lomas de Zamora');
  });

  it('otra provincia queda fuera aunque el nombre coincida', () => {
    const catamarca = { county: 'San Fernando del Valle de Catamarca', state: 'Catamarca' };
    expect(evaluarZona(catamarca, ZONA).estado).toBe('fuera');
  });

  it('"tigre" no se confunde con otra palabra que lo contenga', () => {
    expect(evaluarZona({ county: 'Partido de Tigres', state: 'Buenos Aires' }, ZONA).estado).toBe('fuera');
    expect(evaluarZona({ county: 'Partido de Tigre', state: 'Buenos Aires' }, ZONA).estado).toBe('dentro');
  });

  it('sin partido, usa la localidad', () => {
    expect(evaluarZona({ town: 'Pilar', state: 'Buenos Aires' }, ZONA).estado).toBe('dentro');
  });

  it('si Nominatim no da un partido reconocible NO bloquea: queda desconocida', () => {
    const r = evaluarZona({ road: 'Calle Falsa', suburb: 'Un barrio', state: 'Buenos Aires' }, ZONA);
    expect(r.estado).toBe('desconocida');
    expect(evaluarZona({ state: 'Buenos Aires' }, ZONA).estado).toBe('desconocida');
  });

  it('sin regla o sin direccion no valida nada', () => {
    expect(evaluarZona(SAN_ISIDRO, null).estado).toBe('sin_regla');
    expect(evaluarZona(SAN_ISIDRO, { partidos: [] }).estado).toBe('sin_regla');
    expect(evaluarZona(null, ZONA).estado).toBe('sin_regla');
  });
});

describe('la busqueda pide el desglose de la direccion', () => {
  it('addressdetails=1 en las dos consultas', () => {
    const urls = urlsBusquedaDireccion('Libertador 16000', { origen: { lat: -34.44, lng: -58.55 }, country: 'AR' });
    expect(urls).toHaveLength(2);
    for (const u of urls) expect(u).toContain('addressdetails=1');
  });
});
