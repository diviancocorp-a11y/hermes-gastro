// Carga el handler REAL de platform/functions/submit-order/index.ts con un
// supabase falso. Lo comparten las pruebas de submit-order: index.ts importa
// jsr: y esm.sh (Node no los resuelve) y modulos hermanos .ts, asi que se
// transpila con oxc y se le inyectan el cliente falso y la logica pura real.
import { readFileSync } from 'node:fs';
import { transformWithOxc } from 'vite';
import * as opciones from '../../../platform/functions/submit-order/opciones.ts';

/** estado.tablas[tabla] = lo que devuelve el select; estado.inserts / updates = lo escrito. */
export function crearEstado() {
  return { tablas: {}, inserts: [], rpcs: [] };
}

function crearCliente(estado) {
  return {
    rpc: async (nombre, args) => { estado.rpcs.push({ nombre, args }); return { data: true }; },
    functions: { invoke: async () => ({}) },
    from(tabla) {
      const q = { _insert: null };
      const fin = () => {
        if (q._insert) {
          estado.inserts.push({ tabla, filas: q._insert });
          return { data: tabla === 'orders' ? { id: 'ord-1' } : null, error: null };
        }
        const d = estado.tablas[tabla];
        return { data: d ?? null, error: null };
      };
      const api = new Proxy(q, {
        get(_, prop) {
          if (prop === 'then') return (res) => res(fin());
          if (prop === 'insert') return (v) => { q._insert = v; return api; };
          if (prop === 'single' || prop === 'maybeSingle') return async () => fin();
          return () => api;
        },
      });
      return api;
    },
  };
}

// montos.ts puede no existir todavia (commits anteriores de la fase): ruta en variable para que vite no la resuelva de antemano.
const RUTA_MONTOS = '../../../platform/functions/submit-order/montos.ts';

export async function cargarHandler(estado) {
  const montos = await import(/* @vite-ignore */ RUTA_MONTOS).catch(() => ({}));
  let handler;
  globalThis.Deno = { env: { get: () => 'x' }, serve: (h) => { handler = h; } };
  const fuente = readFileSync('platform/functions/submit-order/index.ts', 'utf8')
    .split('\n').map((l) => {
      if (l.startsWith('import "jsr:')) return '';
      if (l.startsWith('import { createClient }')) return 'const { createClient } = globalThis.__fake;';
      if (l.includes('from "./opciones.ts"')) {
        return 'const { ahoraEnZona, aplicarSugerencias, resolverOpciones, textoParaCocina } = globalThis.__fake.opciones;';
      }
      if (l.includes('from "./montos.ts"')) {
        return 'const { ' + Object.keys(montos).join(', ') + ' } = globalThis.__fake.montos;';
      }
      return l;
    }).join('\n');
  const js = (await transformWithOxc(fuente, 'submit-order.ts')).code;
  globalThis.__fake = { createClient: () => crearCliente(estado), opciones, montos };
  new Function(js)();
  return handler;
}
