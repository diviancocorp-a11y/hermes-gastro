import { describe, it, expect } from 'vitest';
import { COCHI_SETTINGS } from './fixtures/cochi-plantilla';
import {
  borradorAConfig, validarBorrador, avisosDeContraste, configsIguales, mensajeDeServidor,
} from '../lib/plantillaEditor';
import { CAMPOS_EDITABLES, SELECT_COLS, validateSettings } from '../services/platformSettings';

const cochi = COCHI_SETTINGS.catalog_template_config;

describe('editor de marca: regresion Cochi', () => {
  it('guardar la config actual de Cochi la deja identica', () => {
    const { ok, config, errores } = validarBorrador(structuredClone(cochi));
    expect(errores).toEqual({});
    expect(ok).toBe(true);
    expect(config).toEqual(cochi);
    expect(borradorAConfig(cochi)).toEqual(cochi);
  });
  it('ida y vuelta por JSON no cambia nada (jsonb no ordena claves)', () => {
    const orden = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
    const v = validarBorrador(JSON.parse(JSON.stringify(cochi)));
    expect(orden(v.config)).toBe(orden(cochi));
  });
  it('Cochi: rojo sobre crema como texto da 3,96:1 y el editor lo avisa (el catalogo ya lo corrige)', () => {
    const a = avisosDeContraste(cochi.marca, 'ambar');
    expect(a).toHaveLength(1);
    expect(a[0].campo).toBe('marca.primario');
  });
});

describe('editor de marca: validacion', () => {
  it('saca los campos vacios y conserva listas vacias', () => {
    const c = borradorAConfig({ marca: { primario: '', radio: 'suave' }, textos: { hero_titulo: '  ' }, anuncios: [], flyers: [{}] });
    expect(c).toEqual({ marca: { radio: 'suave' }, anuncios: [], flyers: [] });
  });
  it('marca el campo con el error, en español', () => {
    const v = validarBorrador({ marca: { primario: 'rojo' }, textos: { hero_titulo: 'x'.repeat(401) } });
    expect(v.ok).toBe(false);
    expect(v.errores['marca.primario']).toMatch(/#RRGGBB/);
    expect(v.errores['textos.hero_titulo']).toMatch(/demasiado largo/i);
  });
  it('rechaza una imagen que no es https ni ruta', () => {
    const v = validarBorrador({ marca: { logo_header: 'javascript:alert(1)' } });
    expect(v.errores['marca.logo_header']).toMatch(/https/);
  });
  it('avisa si no llega a AA', () => {
    const a = avisosDeContraste({ fondo: '#ffffff', texto: '#bbbbbb', primario: '#f5f5f5' }, 'ambar');
    expect(a.map(x => x.campo)).toEqual(['marca.texto', 'marca.primario']);
  });
  it('configsIguales ignora vacios', () => {
    expect(configsIguales({ marca: { radio: 'suave', fondo: '' } }, { marca: { radio: 'suave' } })).toBe(true);
  });
  it('traduce el rechazo del servidor', () => {
    expect(mensajeDeServidor('violates check constraint "settings_catalog_template_config_check"')).toMatch(/servidor/);
    expect(mensajeDeServidor('solo_duenio: x')).toMatch(/dueño/);
  });
});

describe('guardado de plantilla', () => {
  it('el service puede escribir y leer las dos columnas', () => {
    for (const c of ['catalog_template', 'catalog_template_config']) {
      expect(CAMPOS_EDITABLES).toContain(c);
      expect(SELECT_COLS).toContain(c);
    }
    expect(validateSettings({ catalog_template: 'otra' })).toHaveLength(1);
    expect(validateSettings({ catalog_template: 'pop' })).toEqual([]);
  });
});
