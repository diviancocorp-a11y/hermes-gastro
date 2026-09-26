// src/test/archivarHandoff.test.js
//
// Prueba scripts/archivar-handoff.mjs con textos en memoria. Lo que importa es
// que mover secciones no pierda ni reordene nada: el HANDOFF es la unica
// memoria entre sesiones y un archivado que se come una seccion no avisa.

import { describe, it, expect } from 'vitest';
import { partir, archivar, verificar, ENCABEZADO_ARCHIVO } from '../../scripts/archivar-handoff.mjs';

const seccion = (fecha, cuerpo = 'algo paso') => `## ${fecha}\n\n${cuerpo}\n\n---\n\n`;
const handoff = (n) => '# HANDOFF\n\n> leer la primera\n\n---\n\n'
  + Array.from({ length: n }, (_, i) => seccion(`${n - i}/sep`)).join('').replace(/\n*$/, '\n');

describe('partir', () => {
  it('separa encabezado y secciones sin perder bytes', () => {
    const t = handoff(3);
    const { encabezado, secciones } = partir(t);
    expect(secciones.map((s) => s.split('\n')[0])).toEqual(['## 3/sep', '## 2/sep', '## 1/sep']);
    expect(encabezado + secciones.join('')).toBe(t);
  });

  it('un ## dentro de un bloque de codigo no corta la seccion', () => {
    const t = '# H\n\n## 1/sep\n\n```md\n## esto es un ejemplo\n```\n';
    expect(partir(t).secciones).toHaveLength(1);
  });
});

describe('archivar', () => {
  it('con pocas secciones no hace nada', () => {
    expect(archivar(handoff(3), null, 5)).toBeNull();
  });

  it('deja las primeras y crea el archivo con las demas, en el mismo orden', () => {
    const t = handoff(7);
    const r = archivar(t, null, 5);
    expect(r.quedan).toBe(5);
    expect(r.salen).toBe(2);
    expect(partir(r.nuevoHandoff).secciones.map((s) => s.split('\n')[0]))
      .toEqual(['## 7/sep', '## 6/sep', '## 5/sep', '## 4/sep', '## 3/sep']);
    expect(r.nuevoArchivo.startsWith(ENCABEZADO_ARCHIVO)).toBe(true);
    expect(partir(r.nuevoArchivo).secciones.map((s) => s.split('\n')[0])).toEqual(['## 2/sep', '## 1/sep']);
    expect(r.nuevoHandoff.endsWith('---\n')).toBe(true);
    expect(() => verificar(t, null, r)).not.toThrow();
  });

  it('en un archivo que ya existe, lo nuevo entra arriba de lo que habia', () => {
    const primera = archivar(handoff(7), null, 5);
    const siguiente = primera.nuevoHandoff.replace('---\n\n## 7/sep', `---\n\n${seccion('9/sep')}${seccion('8/sep')}## 7/sep`);
    const r = archivar(siguiente, primera.nuevoArchivo, 5);
    expect(partir(r.nuevoArchivo).secciones.map((s) => s.split('\n')[0]))
      .toEqual(['## 4/sep', '## 3/sep', '## 2/sep', '## 1/sep']);
    expect(() => verificar(siguiente, primera.nuevoArchivo, r)).not.toThrow();
  });

  it('verificar frena si una seccion se perdio en el camino', () => {
    const t = handoff(7);
    const r = archivar(t, null, 5);
    const roto = { ...r, nuevoArchivo: r.nuevoArchivo.replace(/## 1\/sep[\s\S]*$/, '') };
    expect(() => verificar(t, null, roto)).toThrow(/no se escribio nada/);
  });

  it('verificar frena si el contenido de una seccion cambio', () => {
    const t = handoff(7);
    const r = archivar(t, null, 5);
    const roto = { ...r, nuevoArchivo: r.nuevoArchivo.replace('algo paso', 'algo pas') };
    expect(() => verificar(t, null, roto)).toThrow(/cambio al moverla/);
  });
});
