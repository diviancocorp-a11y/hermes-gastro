#!/usr/bin/env node
// scripts/check-rls.mjs
//
// Verifica contra la base que ningun negocio pueda leer datos de otro.
//
// ── POR QUE EXISTE ──
// El aislamiento del edificio es RLS por `tenant_id`, y hasta aca ningun guard
// lo miraba. Los errores que lo rompen no fallan, funcionan:
//
//   - una tabla nueva sin `enable row level security`
//   - una policy `using (true)` para que el catalogo la lea sin login
//   - una policy `auth.uid() is not null`: cualquiera logueado ve todo
//   - una vista sin `security_invoker`, que lee con los permisos del dueno
//
// En los cuatro casos la app anda y cualquiera con la anon key lee los datos
// de todos los negocios. Nadie se entera hasta que lo encuentra otro.
//
// ── LA REGLA ──
//   1. Toda tabla de `public` tiene RLS activado.
//   2. En una tabla con `tenant_id`, toda policy PERMISIVA que aplique a
//      anon/authenticated tiene su `using` y su `with check` ACOTADOS.
//   3. Toda vista que anon/authenticated pueden leer es `security_invoker`.
//      Una materializada no puede tener RLS: si la pueden leer, falla.
//
// Acotada quiere decir que cada rama del OR llega a uno de ACOTADORES:
// el negocio del usuario, su rol en ese negocio, su propia fila, o el staff
// de Divianco. Un AND esta acotado si alguna de sus partes lo esta (AND solo
// achica). Las policies RESTRICTIVAS no se miran: tambien solo achican.
//
// ── QUE NO VE ──
// Las funciones SECURITY DEFINER (get_catalog, submit-order...) saltean RLS
// a proposito y se cuidan solas: este guard no las puede juzgar. Tampoco entra
// a subconsultas: `exists (select ... where o.user_id = auth.uid())` cuenta
// como acotada por lo que tiene adentro, sin mirar si hay un OR mas abajo.
//
// ── USO ──
//   npm run check:rls                          # contra la base
//   node scripts/check-rls.mjs --snapshot x.json   # contra un archivo
//
// Con --snapshot se juzga un JSON con la salida de `select public.rls_snapshot()`.
// Sirve para correrlo sin service role, por ejemplo desde una sesion con el
// MCP de Supabase.
//
// Necesita PLATFORM_SUPABASE_URL + PLATFORM_SUPABASE_SERVICE_ROLE_KEY (o las
// SUPABASE_* genericas) y que la base tenga public.rls_snapshot() — 0076.
// SIN credenciales o SIN el RPC: saltea y devuelve 0, mismo criterio que
// check-functions-drift. El que corre siempre es el de CI (morning-health).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Se importa desde src/test/rlsCheck.test.js para probar la regla sin base.
const ES_MAIN = process.argv[1]
  && fileURLToPath(import.meta.url) === process.argv[1];

// Los roles que usa el front. `public` en una policy incluye a los dos.
// Una policy solo para service_role no importa: service_role saltea RLS.
const ROLES_DEL_FRONT = new Set(['public', 'anon', 'authenticated']);

/**
 * Lo que acota una expresion. Se compara contra el texto que devuelve
 * pg_policies, que Postgres reescribe siempre igual: por eso se puede pedir
 * la forma exacta y no "que aparezca la palabra".
 */
export const ACOTADORES = [
  // el negocio del usuario (el patron de CLAUDE.md)
  /\btenant_id\s+IN\s*\(\s*SELECT\s+private\.current_user_tenants\(\)/i,
  // su rol dentro de ESE negocio
  /\bprivate\.tiene_rol\(\s*tenant_id\s*,/i,
  // su propia fila: `user_id = auth.uid()`, tambien con `(select auth.uid())`.
  // `auth.uid() is not null` NO entra: eso es "cualquiera logueado".
  /[\w.]+\s*=\s*(?:\(\s*SELECT\s+)?auth\.uid\(\)/i,
  /auth\.uid\(\)(?:\s+AS\s+\w+\s*\))?\s*=\s*[\w.]+/i,
  // staff de Divianco: ve todos los negocios a proposito (la consola)
  /\bprivate\.es_(?:owner|staff)_divianco\(\)/i,
];

/** true si el primer parentesis cierra justo al final: `(a) OR (b)` no. */
function envueltaEntera(s) {
  let prof = 0;
  let enTexto = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") enTexto = !enTexto;
    if (enTexto) continue;
    if (ch === '(') prof++;
    if (ch === ')') {
      prof--;
      if (prof === 0 && i < s.length - 1) return false;
    }
  }
  return true;
}

function sinParentesisExternos(expr) {
  let s = expr.trim();
  while (s.startsWith('(') && s.endsWith(')') && envueltaEntera(s)) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Parte `expr` por `op` (AND u OR) solo en el nivel de afuera. */
export function partirEnNivelCero(expr, op) {
  const partes = [];
  const sep = ` ${op} `;
  let prof = 0;
  let enTexto = false;
  let desde = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "'") enTexto = !enTexto;
    if (enTexto) continue;
    if (ch === '(') prof++;
    else if (ch === ')') prof--;
    else if (prof === 0 && expr.slice(i, i + sep.length).toUpperCase() === sep) {
      partes.push(expr.slice(desde, i));
      desde = i + sep.length;
      i += sep.length - 1;
    }
  }
  partes.push(expr.slice(desde));
  return partes.map((p) => p.trim()).filter(Boolean);
}

/**
 * Si la expresion de una policy deja ver solo lo que corresponde.
 *   OR  -> TODAS las ramas acotadas (una abierta abre todo)
 *   AND -> ALGUNA parte acotada (AND solo achica)
 *   NOT -> nunca: `not tiene_rol(...)` es lo contrario de acotar
 */
export function acotada(expr) {
  const s = sinParentesisExternos(String(expr || ''));
  if (!s) return false;

  const ramas = partirEnNivelCero(s, 'OR');
  if (ramas.length > 1) return ramas.every(acotada);

  const partes = partirEnNivelCero(s, 'AND');
  if (partes.length > 1) return partes.some(acotada);

  if (/^NOT\b/i.test(s)) return false;
  return ACOTADORES.some((re) => re.test(s));
}

function aplicaAlFront(policy) {
  const roles = Array.isArray(policy.roles) ? policy.roles : [];
  return roles.some((r) => ROLES_DEL_FRONT.has(r));
}

/**
 * Juzga la salida de public.rls_snapshot(). Devuelve la lista de problemas;
 * vacia es verde. Funcion pura: la usa el test sin base.
 */
export function revisar(snapshot) {
  const problemas = [];
  const objetos = Array.isArray(snapshot) ? snapshot : [];

  for (const o of objetos) {
    const esTabla = o.kind === 'r' || o.kind === 'p';
    const legible = o.anon_select || o.authenticated_select;

    if (esTabla && !o.rls) {
      problemas.push({
        objeto: o.name,
        que: 'tabla sin RLS',
        porque: 'con la anon key se lee y se escribe entera',
      });
      continue;
    }

    if (o.kind === 'v' && legible && !o.security_invoker) {
      problemas.push({
        objeto: o.name,
        que: 'vista sin security_invoker',
        porque: 'lee con los permisos de su dueno y saltea el RLS de las tablas de abajo',
      });
    }

    if (o.kind === 'm' && legible) {
      problemas.push({
        objeto: o.name,
        que: 'vista materializada legible por el front',
        porque: 'no puede tener RLS: hay que revocarle el select a anon/authenticated',
      });
    }

    if (!esTabla || !o.tenant_id) continue;

    for (const p of o.policies || []) {
      if (String(p.permissive).toUpperCase() !== 'PERMISSIVE') continue;
      if (!aplicaAlFront(p)) continue;

      for (const [clausula, expr] of [['using', p.using], ['with check', p.check]]) {
        // null no es abierta: sin `with check`, Postgres reusa el `using`,
        // y un INSERT no tiene `using`.
        if (expr == null) continue;
        if (!acotada(expr)) {
          problemas.push({
            objeto: `${o.name}.${p.name}`,
            que: `policy ${p.cmd} con ${clausula} abierto`,
            porque: `\`${expr}\` no se limita al negocio del usuario`,
          });
        }
      }
    }
  }
  return problemas;
}

/**
 * Saca el array de objetos de lo que venga: el array pelado (RPC), la fila
 * `[{ rls_snapshot: [...] }]` (SQL por MCP) o `{ rls_snapshot: [...] }`.
 * Devuelve null si no tiene la forma de rls_snapshot().
 *
 * Tiene que fallar CERRADO. La primera version miraba primero si era array,
 * y la fila del SQL tambien lo es: juzgaba un objeto sin campos, no
 * encontraba nada y daba verde. Un guard que da verde con basura es peor que
 * no tener guard.
 */
export function desenvolver(crudo) {
  const snap = Array.isArray(crudo?.[0]?.rls_snapshot) ? crudo[0].rls_snapshot
    : Array.isArray(crudo?.rls_snapshot) ? crudo.rls_snapshot
      : crudo;
  if (!Array.isArray(snap)) return null;
  const bienFormado = (o) => o
    && typeof o.name === 'string'
    && ['r', 'p', 'v', 'm'].includes(o.kind)
    && typeof o.rls === 'boolean'
    && Array.isArray(o.policies);
  return snap.every(bienFormado) ? snap : null;
}

async function traerSnapshot() {
  const i = process.argv.indexOf('--snapshot');
  if (i !== -1) {
    const archivo = process.argv[i + 1];
    if (!archivo) return { error: '--snapshot necesita la ruta de un archivo' };
    try {
      const snap = desenvolver(JSON.parse(readFileSync(archivo, 'utf8')));
      if (!snap) return { error: `${archivo} no tiene la forma de rls_snapshot()` };
      return { snapshot: snap };
    } catch (e) {
      return { error: `no se pudo leer ${archivo} (${e.message})` };
    }
  }

  const url = (process.env.PLATFORM_SUPABASE_URL || process.env.SUPABASE_URL || '')
    .replace(/\/+$/, '');
  const key = process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { skip: 'sin credenciales' };

  let res;
  try {
    res = await fetch(`${url}/rest/v1/rpc/rls_snapshot`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch (e) {
    return { skip: `no se pudo conectar (${e.message})` };
  }

  if (res.status === 404) {
    return {
      skip: 'la base no tiene public.rls_snapshot() — aplicale '
        + 'platform/migrations/0076_rls_snapshot_rpc.sql',
    };
  }
  if (!res.ok) return { skip: `HTTP ${res.status}` };
  const snap = desenvolver(await res.json().catch(() => null));
  if (!snap) return { error: 'rls_snapshot() devolvio algo que no tiene la forma esperada' };
  return { snapshot: snap };
}

async function main() {
  const { skip, error, snapshot } = await traerSnapshot();

  if (error) {
    console.log(`\x1b[31m✗\x1b[0m ${error}`);
    return 1;
  }
  if (skip) {
    console.log(`· RLS: salteado (${skip})`);
    return 0;
  }

  const problemas = revisar(snapshot);
  const conTenant = snapshot.filter((o) => o.tenant_id).length;

  if (problemas.length) {
    for (const p of problemas) {
      console.log(`\x1b[31m✗\x1b[0m ${p.objeto}: ${p.que}`);
      console.log(`  ${p.porque}`);
    }
    console.log('');
    console.log(`\x1b[31m✗\x1b[0m ${problemas.length} problema(s) de aislamiento entre negocios`);
    console.log('  Ninguno de estos falla: la app anda y los datos quedan a la vista.');
    return 1;
  }

  console.log(`\x1b[32m✓\x1b[0m RLS: ${snapshot.length} objetos de public, ${conTenant} con tenant_id, ninguno abierto`);
  return 0;
}

if (ES_MAIN) {
  // process.exitCode y NO process.exit(): ver check-functions-drift.mjs
  // (assertion de libuv en Windows despues de un fetch).
  const { cargarEnvDeArchivo } = await import('../platform/scripts/_env.mjs');
  cargarEnvDeArchivo();
  process.exitCode = await main();
}
