import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TOP_KEYS, SECCION_IDS, MARCA_COLORES, MARCA_URLS, MARCA_BOOLS, FUENTES, TEXTO_KEYS, SUBMARCA_KEYS, FLYER_KEYS, QUOTE_KEYS,
  RADIOS, PLANTILLAS, PlantillaConfigSchema, leerConfigPlantilla, resolverPlantilla,
} from '../lib/plantillaConfig';
import { PLANTILLAS_EXCLUSIVAS } from '../lib/plantillaListas';
import { CatalogAttributesSchema } from '../lib/schemas';

// Las listas cerradas viven en JS y en SQL (0128). Si divergen, el panel acepta
// una config que la base rechaza (o al reves) y el guardado muere sin motivo visible.
const MIGRACION = resolve(__dirname, '../../platform/migrations/0128_plantilla_de_catalogo.sql');
const sql = readFileSync(MIGRACION, 'utf-8').replace(/--[^\n]*/g, '');

// El validador vigente es el de la ultima migracion que lo redefine (0146 amplio las listas).
const sqlValidador = readFileSync(resolve(__dirname, '../../platform/migrations/0146_plantilla_interruptores_de_marca.sql'), 'utf-8').replace(/--[^\n]*/g, '');

// La lista de nombres de plantilla vigente es la de la ultima migracion que redefine el check (0152).
const sqlPlantillas = readFileSync(resolve(__dirname, '../../platform/migrations/0152_plantilla_exclusiva_cochi.sql'), 'utf-8').replace(/--[^\n]*/g, '');

function arraySql(nombre) {
  const m = sqlValidador.match(new RegExp(String.raw`${nombre}\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]\s*;`));
  if (!m) throw new Error(`No se encontro ${nombre} en 0146`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

describe('plantillaConfig: SQL y JS coinciden', () => {
  const pares = {
    top_keys: TOP_KEYS, seccion_ids: SECCION_IDS, marca_colores: MARCA_COLORES, marca_urls: MARCA_URLS, marca_bools: MARCA_BOOLS,
    fuentes: FUENTES, texto_keys: TEXTO_KEYS, submarca_keys: SUBMARCA_KEYS, flyer_keys: FLYER_KEYS, quote_keys: QUOTE_KEYS,
  };
  for (const [nombre, js] of Object.entries(pares)) {
    it(`${nombre}`, () => expect(arraySql(nombre)).toEqual(js));
  }
  it('radios y plantillas', () => {
    expect(sql).toContain(`in ('recto','suave','pildora')`);
    expect(RADIOS).toEqual(['recto', 'suave', 'pildora']);
    // 0128 nacio con ('default','pop'); la lista vigente es la de 0152 (suma 'cochi').
    expect(sql).toContain(`catalog_template in ('default','pop')`);
    const lista = sqlPlantillas.match(/catalog_template in \(([^)]*)\)/)?.[1] ?? '';
    expect([...lista.matchAll(/'([^']+)'/g)].map(x => x[1])).toEqual(PLANTILLAS);
    expect(PLANTILLAS).toEqual(['default', 'pop', 'cochi']);
  });
  it('las plantillas exclusivas son una plantilla de la lista y la base las hace cumplir', () => {
    for (const [plantilla, slug] of Object.entries(PLANTILLAS_EXCLUSIVAS)) {
      expect(PLANTILLAS).toContain(plantilla);
      expect(sqlPlantillas).toContain(`new.catalog_template = '${plantilla}'`);
      expect(sqlPlantillas).toContain(`is distinct from '${slug}'`);
    }
  });
  it('claves de catalog_attributes de la portada', () => {
    for (const k of ['tag', 'featured', 'coming_soon', 'days']) {
      expect(sql).toContain(`'${k}'`);
      expect(CatalogAttributesSchema.shape).toHaveProperty(k);
    }
  });
  it('get_catalog conserva su firma y emite lo nuevo', () => {
    expect(sql).toMatch(/create or replace function public\.get_catalog\(p_tenant_slug text\)/);
    for (const k of ['catalog_template', 'catalog_template_config', 'currency', 'secondary_currency']) expect(sql).toContain(`'${k}'`);
  });
});

describe('PlantillaConfigSchema', () => {
  it('acepta una config completa y rechaza claves o valores fuera del contrato', () => {
    expect(PlantillaConfigSchema.safeParse({ marca: { primario: '#eb140c', fuente_titulo: 'Montserrat', radio: 'suave' }, intro: true }).success).toBe(true);
    expect(PlantillaConfigSchema.safeParse({ marca: { primario: 'rojo' } }).success).toBe(false);
    expect(PlantillaConfigSchema.safeParse({ marca: { fuente_titulo: 'Comic Sans' } }).success).toBe(false);
    expect(PlantillaConfigSchema.safeParse({ secciones: [{ id: 'nueva' }] }).success).toBe(false);
    expect(PlantillaConfigSchema.safeParse({ inventada: 1 }).success).toBe(false);
    expect(PlantillaConfigSchema.safeParse({ flyers: [{ imagen: 'javascript:alert(1)' }] }).success).toBe(false);
  });
  it('una config rota no tira: vuelve a defaults con el motivo', () => {
    expect(leerConfigPlantilla(null)).toEqual({ config: {}, error: null });
    const r = leerConfigPlantilla({ marca: { primario: 'x' } });
    expect(r.config).toEqual({});
    expect(r.error).toMatch(/marca\.primario/);
  });
  it('resolverPlantilla: todo lo desconocido es default', () => {
    for (const v of [undefined, null, '', 'default', 'otra', 42]) expect(resolverPlantilla(v)).toBe('default');
    expect(resolverPlantilla('pop')).toBe('pop');
  });
});
