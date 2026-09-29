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
//   4. Toda funcion SECURITY DEFINER que anon/authenticated pueden ejecutar
//      esta en DEFINER_APROBADAS, y las que se aprobaron porque validan
//      adentro siguen teniendo la validacion en el cuerpo.
//
// Acotada quiere decir que cada rama del OR llega a uno de ACOTADORES:
// el negocio del usuario, su rol en ese negocio, su propia fila, o el staff
// de Divianco. Un AND esta acotado si alguna de sus partes lo esta (AND solo
// achica). Las policies RESTRICTIVAS no se miran: tambien solo achican.
//
// ── QUE NO VE ──
// No entra a subconsultas: `exists (select ... where o.user_id = auth.uid())`
// cuenta como acotada por lo que tiene adentro, sin mirar si hay un OR mas
// abajo. De una funcion SECURITY DEFINER sabe que la validacion ESTA en el
// cuerpo, no que este bien usada: eso lo sigue diciendo quien la revisa.
//
// ── USO ──
//   npm run check:rls                                   # contra la base
//   node scripts/check-rls.mjs --snapshot t.json [--funciones f.json]
//
// Con --snapshot se juzga un JSON con la salida de `select public.rls_snapshot()`
// y, si se pasa, --funciones con la de `select public.function_snapshot()`.
// Sirve para correrlo sin service role, por ejemplo desde una sesion con el
// MCP de Supabase.
//
// Necesita PLATFORM_SUPABASE_URL + PLATFORM_SUPABASE_SERVICE_ROLE_KEY (o las
// SUPABASE_* genericas), public.rls_snapshot() (0077) y function_snapshot()
// con permisos (0078). SIN credenciales o SIN los RPC: saltea y devuelve 0,
// mismo criterio que check-functions-drift. El que corre siempre es el de CI
// (morning-health).

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

/* ══════════════════ Funciones SECURITY DEFINER ══════════════════ */

/**
 * Las SECURITY DEFINER que el front puede llamar, y por que esta bien.
 *
 *   se_cuida  valida adentro que el usuario sea del negocio (o staff de
 *             Divianco). El guard exige que la validacion siga en el cuerpo.
 *   abierta   la puede llamar cualquiera a proposito y no expone datos de un
 *             negocio que el negocio no publique.
 *
 * Una funcion nueva que no esta aca hace fallar el guard. Las salidas son dos:
 * revocarle el execute (`revoke execute on function ... from anon,
 * authenticated`) si no la llama el front, o sumarla aca con el motivo. El
 * motivo es para quien la revise despues: que se pueda leer y discutir.
 */
export const DEFINER_APROBADAS = {
  // ── validan pertenencia al negocio ──
  bajar_pedido_a_cocina: { tipo: 'se_cuida', porque: 'raise si p_tenant_id no es del usuario' },
  cerrar_ticket_de_cocina: { tipo: 'se_cuida', porque: 'raise si p_tenant_id no es del usuario' },
  marcar_comanda_impresa: { tipo: 'se_cuida', porque: 'raise si p_tenant_id no es del usuario' },
  marcar_plato: { tipo: 'se_cuida', porque: 'raise si p_tenant_id no es del usuario' },
  guardar_conteo_de_deposito: { tipo: 'se_cuida', porque: 'raise si p_tenant_id no es del usuario' },
  mover_stock_de_insumo: { tipo: 'se_cuida', porque: 'raise si p_tenant_id no es del usuario' },
  register_stock_movement: { tipo: 'se_cuida', porque: 'raise si p_tenant_id no es del usuario' },
  count_push_subscriptions: { tipo: 'se_cuida', porque: 'raise si el slug no es de un negocio del usuario' },
  crear_sectores_tipicos: { tipo: 'se_cuida', porque: 'pertenencia y rol owner/manager' },
  complete_order: { tipo: 'se_cuida', porque: 'el pedido tiene que ser de un negocio del usuario, con rol de caja' },
  comandas_abiertas: { tipo: 'se_cuida', porque: 'filtra por current_user_tenants: a otro le devuelve vacio' },
  comandas_por_imprimir: { tipo: 'se_cuida', porque: 'filtra por current_user_tenants: a otro le devuelve vacio' },
  consumo_diario_de_insumos: { tipo: 'se_cuida', porque: 'filtra por current_user_tenants: a otro le devuelve vacio' },
  signup_tenant: { tipo: 'se_cuida', porque: 'exige sesion y crea el negocio de ESE usuario' },
  upsert_push_subscription: { tipo: 'se_cuida', porque: 'cualquiera se suscribe como cliente; como admin solo si es miembro' },
  // ── caja, salon y facturacion (0067, 0069, 0070; aplicadas el 27/sep) ──
  force_close_cash_session: { tipo: 'se_cuida', porque: 'solo el owner del negocio de esa sesion de caja' },
  open_table_visit: { tipo: 'se_cuida', porque: 'rol de salon o caja en p_tenant_id' },
  queue_fiscal_document: { tipo: 'se_cuida', porque: 'p_tenant_id del usuario y rol owner/manager/cashier' },
  register_payment_evidence: { tipo: 'se_cuida', porque: 'quien presento la rendicion, o caja/encargado de ese negocio' },
  report_cash_exception: { tipo: 'se_cuida', porque: 'raise si p_tenant_id no es del usuario' },
  resolve_cash_exception: { tipo: 'se_cuida', porque: 'rol owner/manager/cashier en el negocio de la incidencia' },
  review_staff_cash_settlement: { tipo: 'se_cuida', porque: 'rol owner/manager/cashier en el negocio de la rendicion' },
  review_table_order: { tipo: 'se_cuida', porque: 'el pedido tiene que ser de un negocio del usuario' },
  submit_staff_cash_settlement: { tipo: 'se_cuida', porque: 'el propio mozo, o caja/encargado de p_tenant_id' },
  update_service_request: { tipo: 'se_cuida', porque: 'el pedido de servicio tiene que ser de un negocio del usuario' },
  verify_payment_evidence: { tipo: 'se_cuida', porque: 'rol owner/manager/cashier en el negocio del comprobante' },
  // ── solo el dueno de Divianco ──
  cambiar_puesto: { tipo: 'se_cuida', porque: 'raise si no es el dueno de Divianco' },
  purgar_consola_log: { tipo: 'se_cuida', porque: 'raise si no es el dueno de Divianco' },
  quitar_staff: { tipo: 'se_cuida', porque: 'raise si no es el dueno de Divianco' },
  sumar_staff: { tipo: 'se_cuida', porque: 'raise si no es el dueno de Divianco' },
  // ── publicas a proposito ──
  get_catalog: { tipo: 'abierta', porque: 'el catalogo publico: lo que el negocio publica' },
  get_tenant_brand: { tipo: 'abierta', porque: 'nombre y logo del negocio, para la pantalla de login' },
  get_tenant_by_host: { tipo: 'abierta', porque: 'resuelve el dominio propio a un slug' },
  get_info_page: { tipo: 'abierta', porque: 'solo paginas marcadas visibles' },
  resolve_qr: { tipo: 'abierta', porque: 'solo QR activos; devuelve a donde redirige' },
  slug_available: { tipo: 'abierta', porque: 'el alta pregunta si un slug esta libre' },
  tenant_puede_operar: { tipo: 'abierta', porque: 'devuelve un booleano: si el negocio esta suspendido' },
  submit_service_review: { tipo: 'abierta', porque: 'el order_id es un uuid que solo tiene quien recibio el pedido' },
  get_tip_target: { tipo: 'abierta', porque: 'el order_id es un uuid que solo tiene quien recibio el pedido' },
  get_order_tracker: { tipo: 'abierta', porque: 'el order_id es un uuid que solo tiene quien hizo el pedido; primer nombre, sin contacto' },
  delete_push_subscription: { tipo: 'abierta', porque: 'el endpoint es el secreto: solo lo conoce el navegador suscripto' },
  legajo_completo: { tipo: 'abierta', porque: 'devuelve un booleano sobre la fila que le pasan' },
};

/** Lo que cuenta como "valida adentro". Se busca sin comentarios. */
export const GUARDAS = [
  /\bprivate\.current_user_tenants\(\)/i,
  /\bprivate\.tiene_rol\(/i,
  /\bprivate\.es_(?:owner|staff)_divianco\(\)/i,
  /\bauth\.uid\(\)/i,
];

function sinComentarios(sql) {
  return String(sql || '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Saca la lista de funciones de la salida de function_snapshot(): el mapa
 * pelado (RPC), `[{ function_snapshot: {...} }]` (SQL por MCP) o
 * `{ function_snapshot: {...} }`. Null si no tiene la forma, o si le faltan
 * los permisos (la base no tiene la 0078): sin ellos no se puede juzgar nada
 * y callarse seria dar verde.
 */
export function desenvolverFunciones(crudo) {
  const mapa = crudo?.[0]?.function_snapshot ?? crudo?.function_snapshot ?? crudo;
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return null;
  const lista = Object.values(mapa);
  const bienFormada = (f) => f
    && typeof f.name === 'string'
    && typeof f.body === 'string'
    && typeof f.secdef === 'boolean'
    && typeof f.anon_exec === 'boolean'
    && typeof f.auth_exec === 'boolean';
  return lista.every(bienFormada) ? lista : null;
}

/**
 * Juzga las SECURITY DEFINER que el front puede llamar. Devuelve los
 * problemas (vacio es verde) y las aprobadas que ya no aparecen, para podar
 * la lista. Funcion pura: la usa el test sin base.
 */
export function revisarDefiner(funciones, aprobadas = DEFINER_APROBADAS) {
  const problemas = [];
  const vistas = new Set();

  for (const f of funciones || []) {
    if (!f.secdef || !(f.anon_exec || f.auth_exec)) continue;
    vistas.add(f.name);
    const firma = `${f.name}(${f.args || ''})`;
    const quien = f.anon_exec ? 'anon' : 'authenticated';
    const ok = aprobadas[f.name];

    if (!ok) {
      problemas.push({
        objeto: firma,
        que: `SECURITY DEFINER que ${quien} puede ejecutar y nadie aprobo`,
        porque: 'saltea RLS: revocale el execute o sumala a DEFINER_APROBADAS con el motivo',
      });
      continue;
    }

    if (ok.tipo === 'se_cuida' && !GUARDAS.some((re) => re.test(sinComentarios(f.body)))) {
      problemas.push({
        objeto: firma,
        que: 'se aprobo porque valida adentro, y ya no valida',
        porque: `no llama a current_user_tenants, tiene_rol, es_*_divianco ni auth.uid (${ok.porque})`,
      });
    }
  }

  const sobran = Object.keys(aprobadas).filter((n) => !vistas.has(n));
  return { problemas, sobran };
}

/* ══════════════════ Traer los datos ══════════════════ */

function leerArchivo(archivo, desenvolverCon, nombreRpc) {
  try {
    const datos = desenvolverCon(JSON.parse(readFileSync(archivo, 'utf8')));
    if (!datos) return { error: `${archivo} no tiene la forma de ${nombreRpc}()` };
    return { datos };
  } catch (e) {
    return { error: `no se pudo leer ${archivo} (${e.message})` };
  }
}

async function llamarRpc(nombre, migracion, desenvolverCon) {
  const url = (process.env.PLATFORM_SUPABASE_URL || process.env.SUPABASE_URL || '')
    .replace(/\/+$/, '');
  const key = process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { skip: 'sin credenciales' };

  let res;
  try {
    res = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
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
    return { skip: `la base no tiene public.${nombre}() — aplicale platform/migrations/${migracion}` };
  }
  if (!res.ok) return { skip: `HTTP ${res.status}` };
  const datos = desenvolverCon(await res.json().catch(() => null));
  if (!datos) {
    return { error: `${nombre}() devolvio algo que no tiene la forma esperada (puede faltar ${migracion})` };
  }
  return { datos };
}

function argumento(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1] || '';
}

async function traerTodo() {
  const archivoTablas = argumento('--snapshot');
  const archivoFunciones = argumento('--funciones');

  if (archivoTablas === '' || archivoFunciones === '') {
    return { error: '--snapshot y --funciones necesitan la ruta de un archivo' };
  }

  if (archivoTablas !== undefined) {
    const tablas = leerArchivo(archivoTablas, desenvolver, 'rls_snapshot');
    const funciones = archivoFunciones !== undefined
      ? leerArchivo(archivoFunciones, desenvolverFunciones, 'function_snapshot')
      : { skip: 'sin --funciones' };
    return { tablas, funciones };
  }

  const [tablas, funciones] = await Promise.all([
    llamarRpc('rls_snapshot', '0077_rls_snapshot_rpc.sql', desenvolver),
    llamarRpc('function_snapshot', '0078_function_snapshot_con_permisos.sql', desenvolverFunciones),
  ]);
  return { tablas, funciones };
}

/* ══════════════════ Main ══════════════════ */

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const mal = (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`  ${m}`);

function reportar(problemas) {
  for (const p of problemas) {
    mal(`${p.objeto}: ${p.que}`);
    info(p.porque);
  }
}

async function main() {
  const { error, tablas, funciones } = await traerTodo();
  if (error) {
    mal(error);
    return 1;
  }

  let rojos = 0;
  let sinVerificar = 0;

  if (tablas.error) {
    mal(tablas.error);
    sinVerificar++;
  } else if (tablas.skip) {
    console.log(`· RLS: salteado (${tablas.skip})`);
  } else {
    const problemas = revisar(tablas.datos);
    const conTenant = tablas.datos.filter((o) => o.tenant_id).length;
    reportar(problemas);
    rojos += problemas.length;
    if (!problemas.length) ok(`RLS: ${tablas.datos.length} objetos de public, ${conTenant} con tenant_id, ninguno abierto`);
  }

  if (funciones.error) {
    mal(funciones.error);
    sinVerificar++;
  } else if (funciones.skip) {
    console.log(`· funciones: salteado (${funciones.skip})`);
  } else {
    const { problemas, sobran } = revisarDefiner(funciones.datos);
    const llamables = funciones.datos.filter((f) => f.secdef && (f.anon_exec || f.auth_exec)).length;
    reportar(problemas);
    rojos += problemas.length;
    if (!problemas.length) ok(`funciones: ${llamables} SECURITY DEFINER llamables desde el front, todas aprobadas`);
    // No falla: una aprobada de mas no abre nada. Pero la lista se pudre si
    // nadie la poda, y una lista podrida se deja de leer.
    if (sobran.length) info(`⚠ en DEFINER_APROBADAS y ya no llamables: ${sobran.join(', ')} — sacalas`);
  }

  if (rojos) {
    console.log('');
    mal(`${rojos} problema(s) de aislamiento entre negocios`);
    info('Ninguno de estos falla: la app anda y los datos quedan a la vista.');
  }
  // Datos que no se pudieron juzgar tambien son rojo: callarse seria un verde.
  if (sinVerificar && !rojos) {
    console.log('');
    mal('no se pudo verificar el aislamiento: ver arriba');
  }
  return rojos || sinVerificar ? 1 : 0;
}

if (ES_MAIN) {
  // process.exitCode y NO process.exit(): ver check-functions-drift.mjs
  // (assertion de libuv en Windows despues de un fetch).
  const { cargarEnvDeArchivo } = await import('../platform/scripts/_env.mjs');
  cargarEnvDeArchivo();
  process.exitCode = await main();
}
