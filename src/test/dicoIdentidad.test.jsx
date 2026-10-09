/**
 * Dico tiene DOS versiones y nada mas.
 *
 *   la marca   el disco 2D, oro con aro azul y dos ovalos negros. Siete
 *              estados en `public/brand/dico/`, derivados de sus masters.
 *   el pet     el personaje 3D, un solo atlas de once filas.
 *
 * Llegaron a convivir CUATRO cuerpos: la marca, el cuerpo Core sin cara con la
 * expresion en tinta SVG, un pack de ocho renders con ojos de dibujo y nariz, y
 * siete escenas heredadas con galera y bigote. Ninguno de los tres ultimos
 * reproducia la marca, y los tres estaban vivos al mismo tiempo. El 25/9/2026
 * se resolvio dejando dos.
 *
 * POR QUE ESTE TEST Y NO CONFIAR EN QUE NO VUELVAN
 * Un cuerpo nuevo no rompe nada: entra como un import mas y convive. Lo que
 * sigue es un contrato POSITIVO —estas son las dos identidades— y uno negativo
 * que camina el GRAFO DE IMPORTS real desde `src/main.jsx`, el mismo punto de
 * entrada que usa `index.html`. Productivo es lo que el bundle puede alcanzar;
 * los tests y la documentacion quedan afuera solos, sin nombrarlos, porque
 * nadie los importa desde la app.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_STATES } from '../components/dico/vocabulario';
import { DICO_PET_PUBLIC_PATH, DICO_PET_ATLAS } from '../../platform/brand/dico-pet-assets.mjs';

const RAIZ = resolve(__dirname, '..', '..');
const ENTRADA = 'src/main.jsx';   // el mismo de index.html

const norm = p => p.replace(/\\/g, '/');
const rel = p => norm(p).slice(norm(RAIZ).length + 1);

/**
 * Lo que se dio de baja el 25/9/2026. Se nombran para que el dia que alguien
 * los reponga el contrato lo diga, en vez de descubrirlo por un quinto Dico
 * en pantalla.
 */
const DADOS_DE_BAJA = [
  'src/components/dico/DicoCara.jsx',
  'src/components/dico/CaraDeTinta.jsx',
  'src/components/dico/DicoEscena.jsx',
  'src/components/dico/DicoCoreEscena.jsx',
  'src/components/dico/poses',
  'platform/brand/dico-3d-masters',
  'platform/brand/dico-3d-assets.mjs',
  'public/brand/dico/physical',
  'scripts/dico-3d-derivar.mjs',
];

/* ───────────────────────── El grafo de imports ───────────────────────────── */

const ALIAS = [
  { prefijo: '@dico/core/', destino: 'src/' },
  { prefijo: '@business', destino: 'clients/edificio/business.js', exacto: true },
];

const EXTENSIONES = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];

function resolverEspecificador(especificador, desde) {
  for (const a of ALIAS) {
    if (a.exacto && especificador === a.prefijo) return join(RAIZ, a.destino);
    if (!a.exacto && especificador.startsWith(a.prefijo)) {
      return join(RAIZ, a.destino, especificador.slice(a.prefijo.length));
    }
  }
  // Bare specifier: node_modules. No es superficie nuestra.
  if (!especificador.startsWith('.') && !especificador.startsWith('/')) return null;
  const base = especificador.startsWith('/')
    ? join(RAIZ, especificador.slice(1))
    : resolve(dirname(desde), especificador);
  for (const ext of EXTENSIONES) {
    const intento = base + ext;
    if (existsSync(intento) && statSync(intento).isFile()) return intento;
  }
  return null;
}

/**
 * Expande `{a,b}` y `*` de un glob a una expresion regular.
 *
 * El escapado va PRIMERO y la expansion despues. Al reves, los parentesis y la
 * barra que genera la propia expansion se escapan tambien, el regex no matchea
 * nunca nada y cualquier contrato que pregunte "este glob alcanza un asset
 * viejo?" responde que no por vacio.
 */
function globARegex(patron) {
  const escapado = patron.replace(/[.+^$()|[\]\\]/g, m => `\\${m}`);
  return new RegExp(`^${escapado
    .replace(/\{([^}]*)\}/g, (_, o) => `(${o.split(',').join('|')})`)
    // Una sola pasada: usar un centinela intermedio para `**` ya metio
    // NULL bytes en este archivo una vez, que es el bug #3 del CLAUDE.md.
    .replace(/\*\*|\*/g, m => (m === '**' ? '.*' : '[^/]*'))}$`);
}

/** Todo lo que el bundle puede alcanzar desde `src/main.jsx`. */
function grafoProductivo() {
  const vistos = new Set();
  const globs = [];
  const pendientes = [join(RAIZ, ENTRADA)];

  while (pendientes.length) {
    const archivo = pendientes.pop();
    const clave = rel(archivo);
    if (vistos.has(clave)) continue;
    if (!existsSync(archivo) || !statSync(archivo).isFile()) continue;
    vistos.add(clave);

    // Los binarios son hojas: se registran, no se parsean.
    if (!/\.(jsx?|tsx?|css|mjs)$/.test(archivo)) continue;
    const texto = readFileSync(archivo, 'utf8');

    const especificadores = [];
    for (const m of texto.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g)) especificadores.push(m[1]);
    for (const m of texto.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) especificadores.push(m[1]);
    for (const m of texto.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) especificadores.push(m[1]);
    for (const m of texto.matchAll(/@import\s+["']([^"']+)["']/g)) especificadores.push(m[1]);
    for (const m of texto.matchAll(/url\(\s*['"]?(\.[^'")]+)['"]?\s*\)/g)) especificadores.push(m[1]);

    for (const e of especificadores) {
      const destino = resolverEspecificador(e.split('?')[0], archivo);
      if (destino) pendientes.push(destino);
    }

    // import.meta.glob: se expande contra el disco, igual que hace Vite.
    for (const m of texto.matchAll(/import\.meta\.glob\(\s*['"]([^'"]+)['"]/g)) {
      const patron = m[1];
      globs.push({ archivo: clave, patron });
      const carpeta = join(dirname(archivo), dirname(patron));
      if (!existsSync(carpeta)) continue;
      const regex = globARegex(patron.replace(/^\.\//, ''));
      for (const nombre of readdirSync(carpeta)) {
        const candidato = norm(join(dirname(patron), nombre)).replace(/^\.\//, '');
        if (regex.test(candidato)) pendientes.push(join(carpeta, nombre));
      }
    }
  }

  return { alcanzables: vistos, globs };
}

const PRODUCTIVO = grafoProductivo();

/* ──────────────────────────────── Contratos ──────────────────────────────── */

describe('el grafo productivo conoce dos Dicos', () => {
  it('parte de un grafo real y no de una lista de exclusiones', () => {
    // Si el walker se rompiera y devolviera casi nada, todos los contratos de
    // abajo pasarian por vacio. Este es el canario.
    expect(PRODUCTIVO.alcanzables.size).toBeGreaterThan(100);
    expect(PRODUCTIVO.alcanzables).toContain('src/components/dico/DicoPhysical.jsx');
    expect(PRODUCTIVO.alcanzables).toContain('src/components/dico/DicoNative.jsx');
    expect(PRODUCTIVO.alcanzables).toContain('src/components/dico/DicoFloatingPhysical.jsx');
  });

  it('el pet entra por su manifiesto, que es la unica fuente de la geometria', () => {
    // El componente no repite el tamanio de celda: lo lee del manifiesto que
    // el derivador tambien usa. Dos copias del mismo numero es como el recorte
    // termina corrido medio cuadro.
    expect(PRODUCTIVO.alcanzables).toContain('platform/brand/dico-pet-assets.mjs');
  });

  it('no alcanza ninguno de los cuerpos dados de baja', () => {
    for (const ruta of DADOS_DE_BAJA) {
      expect(PRODUCTIVO.alcanzables, ruta).not.toContain(ruta);
    }
  });

  it('ningun glob productivo puede arrastrar un cuerpo nuevo sin que se note', () => {
    for (const { archivo, patron } of PRODUCTIVO.globs) {
      const nombre = patron.split('/').pop();
      // El comodin puede vivir en la EXTENSION —`.{png,webp,avif}` protege de
      // un cambio de formato— pero nunca en el nombre: un `poses/*.webp`
      // arrastraria al bundle cualquier render que alguien deje ahi.
      expect(nombre.split('.')[0], `${archivo}: ${patron}`).not.toContain('*');
    }
  });
});

describe('los cuerpos dados de baja no estan en el repo', () => {
  it('ninguno quedo en disco', () => {
    // El contrato del lote anterior era mas debil: los archivos viejos vivian
    // en el repo y solo se prohibia alcanzarlos. Duro hasta que alguien los
    // volvio a importar. Ahora no estan.
    for (const ruta of DADOS_DE_BAJA) {
      expect(existsSync(join(RAIZ, ruta)), `${ruta} volvio`).toBe(false);
    }
  });
});

describe('el pet: un atlas, no ocho renders', () => {
  it('el derivado existe y es el unico asset 3D publicado', () => {
    const carpeta = join(RAIZ, 'public/brand/dico/pet');
    expect(readdirSync(carpeta)).toEqual(['dico-pet-atlas.webp']);
    expect(DICO_PET_PUBLIC_PATH).toBe('/brand/dico/pet/dico-pet-atlas.webp');
  });

  it('el master no cambio: el script --check pasa', () => {
    // Comprueba el sha256 del master y que el WebP decodifique pixel a pixel
    // igual. Un atlas reexportado "igual pero mejor" corre las celdas y Dico
    // empieza a temblar sin que falle nada.
    const r = spawnSync(process.execPath, ['scripts/dico-pet-derivar.mjs', '--check'],
      { cwd: RAIZ, encoding: 'utf8' });
    expect(r.status, `salida:\n${r.stdout || ''}\n${r.stderr || ''}`).toBe(0);
  });

  it('el master declara el mismo hash que el pack certifico', () => {
    const validacion = JSON.parse(
      readFileSync(join(RAIZ, 'platform/brand/dico-pet-masters/validacion.json'), 'utf8'));
    expect(DICO_PET_ATLAS.sha256).toBe(validacion.sha256);
    expect(DICO_PET_ATLAS.ancho).toBe(validacion.width);
    expect(DICO_PET_ATLAS.alto).toBe(validacion.height);
    expect(DICO_PET_ATLAS.columnas).toBe(validacion.columns);
    expect(DICO_PET_ATLAS.filas).toBe(validacion.rows);
  });
});

describe('la marca: los siete estados publicos', () => {
  /**
   * Vite copia `public/` tal cual: estos archivos se referencian por URL y NO
   * pasan por el grafo de imports, asi que el gate de arriba no los ve.
   * Necesitan su propio contrato, y necesita ser POSITIVO: uno que solo diga
   * "no hay legacy" pasa igual con la carpeta vacia.
   */
  const PUBLICO = 'public/brand/dico';
  const OFICIALES = [
    'dico-2d-neutral.png', 'dico-2d-curious.png', 'dico-2d-happy.png',
    'dico-2d-celebrate.png', 'dico-2d-alert.png', 'dico-2d-concerned.png',
    'dico-2d-question.png',
  ];

  it('estan exactamente los siete assets oficiales, ni uno mas ni uno menos', () => {
    const enDisco = readdirSync(join(RAIZ, PUBLICO))
      .filter((n) => n.toLowerCase().endsWith('.png')).sort();
    expect(enDisco).toEqual([...OFICIALES].sort());
  });

  it('los siete cubren exactamente los siete nativeState del vocabulario', () => {
    // Si maniana se agrega un estado al vocabulario y nadie exporta su asset,
    // esto lo dice antes de que la sidebar muestre un hueco.
    const estados = OFICIALES.map((f) => f.replace('dico-2d-', '').replace('.png', '')).sort();
    expect(estados).toEqual([...NATIVE_STATES].sort());
  });

  it('no hay renders de las versiones dadas de baja en la carpeta publica', () => {
    for (const f of readdirSync(join(RAIZ, PUBLICO))) {
      expect(f, `${f}: render de escena legacy`).not.toMatch(/^escena-/);
      expect(f, `${f}: cuerpo fuente, no va al runtime`).not.toMatch(/^moneda/);
      expect(f, `${f}: el pack 3D viejo`).not.toMatch(/^dico-3d-/);
    }
  });

  it('cada asset publico es RGBA de verdad', () => {
    // Byte 25 del PNG es el color type del IHDR. 6 = RGBA. Un export sin canal
    // alfa entraria como 2 (RGB) y la moneda vendria con fondo.
    for (const f of OFICIALES) {
      const buf = readFileSync(join(RAIZ, PUBLICO, f));
      expect(buf.readUInt8(25), `${f} no es RGBA`).toBe(6);
    }
  });

  it('los derivados coinciden con su master: el script --check pasa', () => {
    const r = spawnSync(process.execPath, ['scripts/dico-2d-derivar.mjs', '--check'],
      { cwd: RAIZ, encoding: 'utf8' });
    expect(r.status, `salida:\n${r.stdout || ''}\n${r.stderr || ''}`).toBe(0);
  });
});
