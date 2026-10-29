import { describe, expect, it } from 'vitest';
import { PREGUNTAS_DICO, TEMAS_DICO, buscarPreguntas } from '../lib/preguntasPlataforma';

describe('busqueda local de respuestas preparadas', () => {
  it('conserva las doce respuestas y un tema valido para cada una', () => {
    expect(PREGUNTAS_DICO).toHaveLength(12);
    expect(new Set(PREGUNTAS_DICO.map(p => p.id)).size).toBe(12);
    expect(PREGUNTAS_DICO.every(p => TEMAS_DICO.some(t => t.id === p.tema))).toBe(true);
  });
  it('encuentra precios sin depender de tildes, mayusculas o signos', () => {
    expect(buscarPreguntas('¿CUÁNTO CUESTA?')[0].id).toBe('precio');
    expect(buscarPreguntas('precio anual')[0].respuesta).toContain('$14.999');
  });
  it('relaciona los terminos habituales con las preguntas existentes', () => {
    expect(buscarPreguntas('importar excel')[0].id).toBe('importar');
    expect(buscarPreguntas('offline')[0].id).toBe('internet');
    expect(buscarPreguntas('permisos')[0].id).toBe('acceso');
  });
  it('no inventa respuestas para consultas vacias o sin coincidencias', () => {
    expect(buscarPreguntas('')).toEqual([]);
    expect(buscarPreguntas('¿Cómo es Dico?')).toEqual([]);
    expect(buscarPreguntas('astronomia satelites')).toEqual([]);
  });
  it('conserva los limites del producto en sus respuestas', () => {
    expect(buscarPreguntas('internet')[0].respuesta).toContain('no tiene modo offline');
    expect(PREGUNTAS_DICO.find(p => p.id === 'rubro').respuesta).toContain('siguen en desarrollo');
  });
});
