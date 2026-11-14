import { describe, it, expect } from 'vitest';
import {
  numeroPositivo, parseDolarApi, parseBcv, variacionRazonable, diaEnZona, tasaVigente,
} from '../../platform/functions/exchange-rate-sync/fuentes.ts';

// Respuesta real de ve.dolarapi.com/v1/dolares/oficial, 13/nov/2026.
const DOLARAPI = {
  moneda: 'USD', fuente: 'oficial', nombre: 'Dólar', compra: null, venta: null,
  promedio: 911.6243, fechaActualizacion: '2026-11-13T00:00:00-04:00',
};
// Forma del bloque de la home de bcv.org.ve (fixture: el sitio no se pudo leer
// desde aca por su cadena de certificados).
const t = (n, attrs, c) => `<${n}${attrs}>${c}</${n}>`;
const BCV = t('div', ' id="dolar"', t('div', '', t('strong', '', ' 911,62430000 ')));

describe('parsers', () => {
  it('dolarapi', () => {
    expect(parseDolarApi(DOLARAPI)).toEqual({ rate: 911.6243, fecha: '2026-11-13', source: 'dolarapi' });
    expect(parseDolarApi({ promedio: null })).toBeNull();
    expect(parseDolarApi({ promedio: -3 })).toBeNull();
    expect(parseDolarApi(null)).toBeNull();
  });
  it('bcv', () => {
    expect(parseBcv(BCV)?.rate).toBe(911.6243);
    expect(parseBcv('nada')).toBeNull();
  });
  it('numeroPositivo', () => {
    expect(numeroPositivo('1.234,56')).toBe(1234.56);
    expect(numeroPositivo('0')).toBeNull();
    expect(numeroPositivo('abc')).toBeNull();
  });
});

describe('validacion', () => {
  it('variacion contra la ultima', () => {
    expect(variacionRazonable(950, 911)).toBe(true);
    expect(variacionRazonable(9110, 911)).toBe(false);
    expect(variacionRazonable(911, null)).toBe(true);
    expect(variacionRazonable(0, 911)).toBe(false);
  });
  it('dia en zona de Caracas', () => {
    expect(diaEnZona(new Date('2026-11-14T01:00:00Z'), 'America/Caracas')).toBe('2026-11-13');
  });
  it('cae a la fuente de respaldo si la primaria falla o da basura', async () => {
    const f = [
      { nombre: 'a', leer: async () => { throw new Error('HTTP 500'); } },
      { nombre: 'b', leer: async () => ({ rate: 911.6, fecha: null, source: 'bcv' }) },
    ];
    const r = await tasaVigente(900, f);
    expect(r.tasa?.source).toBe('bcv');
    expect(r.errores[0]).toContain('HTTP 500');
    const f2 = [{ nombre: 'a', leer: async () => ({ rate: 5, fecha: null, source: 'a' }) }];
    expect((await tasaVigente(900, f2)).tasa).toBeNull();
  });
});
