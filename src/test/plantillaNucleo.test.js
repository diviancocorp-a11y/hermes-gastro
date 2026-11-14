import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marcaATokens, contraste, mezclar, textoSobre, urlFuentes, TEMAS_BASE } from '../catalog-pro/plantillas/marcaATokens';
import { seccionesVisibles, flyerVigente, flyersVigentes, disponibilidadDePortada, hoyEnZona, diaEnZona } from '../catalog-pro/plantillas/seccionesVisibles';

// Paleta de Cochi (styles.css del sitio original): rojo, crema, papel, tinta.
const COCHI = { primario: '#eb140c', fondo: '#f5f0dc', texto: '#211e1a', acento2: '#e6e0bf', fuente_titulo: 'Montserrat', fuente_texto: 'Montserrat', radio: 'suave' };

describe('contraste', () => {
  it('conoce los extremos', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5);
  });
  it('mezclar respeta el peso', () => {
    expect(mezclar('#000000', '#ffffff', 100)).toBe('#000000');
    expect(mezclar('#000000', '#ffffff', 0)).toBe('#ffffff');
  });
});

describe('marcaATokens', () => {
  it('sin marca solo emite los dos tokens de contraste: el tema manda', () => {
    expect(Object.keys(marcaATokens({}, 'noche')).sort()).toEqual(['--ac-text', '--on-ac']);
    expect(Object.keys(marcaATokens(undefined)).sort()).toEqual(['--ac-text', '--on-ac']);
  });
  it('los temas base coinciden con tokens.css', () => {
    const css = readFileSync(resolve(__dirname, '../catalog-pro/tokens.css'), 'utf-8');
    for (const [tema, v] of Object.entries(TEMAS_BASE)) {
      const bloque = css.slice(css.indexOf(`[data-cp-theme="${tema}"] .cp-root`));
      const tomar = (k) => bloque.match(new RegExp(`--${k}:\\s*(#[0-9A-Fa-f]{6})`))[1].toLowerCase();
      expect([tomar('ac'), tomar('bg'), tomar('tx')]).toEqual([v.ac, v.bg, v.tx].map(x => x.toLowerCase()));
    }
  });
  for (const tema of Object.keys(TEMAS_BASE)) {
    it(`tema ${tema} sin marca: texto sobre el primario y primario como texto llegan a 4.5:1`, () => {
      const base = TEMAS_BASE[tema];
      const t = marcaATokens({}, tema);
      expect(contraste(t['--on-ac'], base.ac)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(t['--ac-text'], base.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('paleta de Cochi: todo par texto/fondo que emite cumple 4.5:1 (3:1 el terciario)', () => {
    const t = marcaATokens(COCHI);
    expect(t['--ac']).toBe('#eb140c');
    expect(t['--bg']).toBe('#f5f0dc');
    expect(contraste(t['--on-ac'], t['--ac'])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(t['--tx'], t['--bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(t['--t2'], t['--bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(t['--t3'], t['--bg'])).toBeGreaterThanOrEqual(3);
    expect(contraste(t['--ac-text'], t['--bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(t['--pop-on-acento'], t['--pop-acento'])).toBeGreaterThanOrEqual(4.5);
    expect(t['--font-heading']).toContain("'Montserrat'");
    expect(t['--r']).toBe('14px');
  });
  it('un primario flojo sobre su fondo cae al color de texto, no al primario', () => {
    const t = marcaATokens({ primario: '#f5c518', fondo: '#ffffff', texto: '#111111' });
    expect(t['--ac-text']).toBe('#111111');
    expect(t['--on-ac']).toBe('#111111');
  });
  it('fuera de la lista cerrada de fuentes no emite nada', () => {
    expect(marcaATokens({ fuente_titulo: 'Comic Sans' })['--font-heading']).toBeUndefined();
  });
  it('urlFuentes pide solo las usadas, sin repetir', () => {
    expect(urlFuentes({ fuente_titulo: 'Lora', fuente_texto: 'Lora' })).toBe('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700;800&display=swap');
    expect(urlFuentes({})).toBeNull();
  });
  it('textoSobre elige el de mayor contraste', () => {
    expect(textoSobre('#000000')).toBe('#ffffff');
    expect(textoSobre('#ffffff')).toBe('#111111');
  });
});

describe('seccionesVisibles', () => {
  const todo = { favoritos: 3, submarcaProductos: 3 };
  const cfg = {
    cinta: ['A'], testimonios: [{ texto: 'x' }], textos: { banda_titulo: 'B', historia_titulo: 'H' },
    submarca: { nombre: 'Dulce' }, flyers: [{ titulo: 'f', activo: true }],
  };
  it('por defecto, todas en el orden del contrato', () => {
    expect(seccionesVisibles(cfg, todo)).toEqual(['hero', 'cinta', 'favoritos', 'flyers', 'menu', 'submarca', 'banda', 'testimonios', 'historia']);
  });
  it('el orden de la config manda y on:false saca', () => {
    const r = seccionesVisibles({ ...cfg, secciones: [{ id: 'menu' }, { id: 'hero', on: false }, { id: 'flyers' }, { id: 'menu' }] }, todo);
    expect(r).toEqual(['menu', 'flyers']);
  });
  it('el menu no se apaga ni se puede olvidar', () => {
    expect(seccionesVisibles({ secciones: [{ id: 'menu', on: false }, { id: 'hero' }] }, {})).toEqual(['hero', 'menu']);
  });
  it('una seccion sin datos se oculta sola', () => {
    expect(seccionesVisibles({}, {})).toEqual(['hero', 'menu']);
    expect(seccionesVisibles({ ...cfg, testimonios: [] }, { favoritos: 0, submarcaProductos: 0 })).not.toContain('testimonios');
  });
  it('flyers vencidos o programados no cuentan, con la fecha del negocio', () => {
    const ahora = new Date('2026-11-15T02:00:00Z'); // 14/nov 22:00 en Caracas (UTC-4), 15/nov en UTC
    expect(hoyEnZona('America/Caracas', ahora)).toBe('2026-11-14');
    const f = [{ hasta: '2026-11-14' }, { desde: '2026-11-15' }, { desde: '2026-11-01', hasta: '2026-11-30' }, { activo: false }];
    expect(f.map(x => flyerVigente(x, '2026-11-14'))).toEqual([true, false, true, false]);
    expect(flyersVigentes({ flyers: f }, 'America/Caracas', ahora)).toHaveLength(2);
  });
});

describe('disponibilidadDePortada', () => {
  const domingo = new Date('2026-11-15T16:00:00Z');
  const lunes = new Date('2026-11-16T16:00:00Z');
  it('proximamente no se puede pedir', () => {
    expect(disponibilidadDePortada({ coming_soon: true })).toMatchObject({ puede: false, tipo: 'soon' });
  });
  it('dias de la semana en la zona del negocio', () => {
    expect(diaEnZona('America/Caracas', domingo)).toBe(0);
    expect(disponibilidadDePortada({ days: [0] }, 'America/Caracas', domingo).puede).toBe(true);
    expect(disponibilidadDePortada({ days: [0] }, 'America/Caracas', lunes)).toMatchObject({ puede: false, tipo: 'day', etiqueta: 'SOLO DOMINGO' });
  });
  it('sin atributos se ofrece siempre', () => {
    expect(disponibilidadDePortada({}).puede).toBe(true);
    expect(disponibilidadDePortada(undefined).puede).toBe(true);
  });
});
