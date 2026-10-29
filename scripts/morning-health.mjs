#!/usr/bin/env node
// scripts/morning-health.mjs
// ─────────────────────────────────────────────────────────
// Health check de DICO (el edificio) — envia a Telegram.
// Corre via GitHub Actions en tres turnos (TURNO): manana L-S 7am AR, tarde
// 15h y noche 21h todos los dias. O a mano:
//   TURNO=tarde SMOKE_TENANTS=la-nona-pato,cochi node scripts/morning-health.mjs
//
// Reescrito 17/ago/2026. La version anterior chequeaba los 3 tenants LEGACY
// (proyectos Supabase pausados a proposito): daba rojo todas las mananas, y un
// reporte que siempre esta en rojo se deja de leer — el opuesto de un health
// check. Ahora mira lo que esta VIVO:
//
//   1. Landing divianco.app
//   2. Por tenant: catalogo por subdominio (HTTP) + RPC get_catalog (valida
//      DB + RLS + que haya productos). El ping ademas cuenta como actividad:
//      ayuda a que el free tier no auto-pause el proyecto.
//   3. Edge function submit-order viva (OPTIONS al gateway)
//   4. Drift de schema del edificio (schema-sync --check) — con service role
//      en secrets; sin ella se saltea. Un snapshot viejo no falla: deja de
//      proteger en silencio (la familia de bug del Zod, 4 veces).
//   4c. Migraciones aplicadas sin archivo en el repo (check-migraciones-sin-
//       archivo) — misma service role; sin ella se saltea.
//   4b. RLS: ninguna tabla con tenant_id abierta entre negocios, ni una
//      SECURITY DEFINER llamable sin aprobar (check-rls) — misma service
//      role; sin ella se saltea.
//   5. Sentry: issues nuevos en 24h — con SENTRY_AUTH_TOKEN; sin token se
//      saltea. Con PROBAR_ALERTA=true (input probar_alerta, a mano) manda un
//      error de prueba que tiene que llegar por GerenteDico (sentry-prueba.mjs).
//
// Criterio del mensaje: lo roto va PRIMERO y el verde es corto. Secrets que
// espera el workflow: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, y opcionales
// PLATFORM_SUPABASE_URL / PLATFORM_SUPABASE_SERVICE_ROLE_KEY (drift) y
// SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT (errores) y DICO_BRAIN
// (explica los problemas). Los negocios salen de la BASE (tenants-vivos.mjs);
// la variable SMOKE_TENANTS queda de respaldo si no hay service role.
// ─────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tenantsAMirar } from './tenants-vivos.mjs';
import { armarPrueba, dsnDelCodigo } from './sentry-prueba.mjs';
import {
  nombresDelDrift, nombresSinArchivo, buscarEnPrs, traerPrsAbiertos, listarConPr,
} from './pendientes-en-pr.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// El edificio. La anon key es sb_publishable_ (publica por diseno, viaja en
// el bundle del cliente): hardcodearla aca no expone nada.
const PLATFORM_URL = 'https://wwwzdgprsooyjgkuyoav.supabase.co';
const PLATFORM_ANON = 'sb_publishable_8gMlo42jYdK8epcD-Zr9TQ_eKmY2nW-';

const LANDING = 'https://divianco.app';

// Los negocios salen de la base (tenants-vivos.mjs): un cliente nuevo entra
// solo el dia que se activa. Antes salian de SMOKE_TENANTS, y el 16/oct esa
// lista todavia tenia mala-miga (borrado) y no tenia crazy-miga.

// trim: al pegar un secret suele colarse un salto de linea al final (paso con
// TELEGRAM_CHAT_ID el 16/oct), y Telegram no reconoce el chat.
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const TG_CHAT = process.env.TELEGRAM_CHAT_ID?.trim();

// Tres reportes por dia (20/oct). La manana mira Sentry de 24h para cubrir la
// noche; tarde y noche, 8h, asi un mismo error no se repite en los tres. TURNO
// lo pone el workflow segun el cron que disparo.
const TURNOS = {
  manana: { emoji: '🌅', nombre: 'mañana', ventana: '24h' },
  tarde: { emoji: '🌤️', nombre: 'tarde', ventana: '8h' },
  noche: { emoji: '🌙', nombre: 'noche', ventana: '8h' },
};
const TURNO = TURNOS[process.env.TURNO?.trim()] || TURNOS.manana;

if (!TG_TOKEN || !TG_CHAT) {
  console.error('❌ Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID');
  process.exitCode = 1;
} else {
  await main();
}

async function main() {
  const problemas = [];
  const detalles = [];

  /* ── 1. Landing ──────────────────────────────────────── */
  const landing = await httpCheck(LANDING);
  if (landing !== '✓') problemas.push(`Landing divianco.app: ${landing}`);

  /* ── 2. Tenants: subdominio + catalogo por RPC ───────── */
  const lista = await tenantsAMirar();
  const TENANTS = lista.activos;
  if (lista.aviso) detalles.push(`negocios: ${lista.aviso}`);
  // Sin lista no hay "todo en verde": un reporte que no mira ningun negocio no
  // puede decir que andan.
  if (TENANTS.length === 0) {
    // La barra escapa el guion bajo: en el Markdown de Telegram uno suelto
    // abre una cursiva que nunca se cierra y el mensaje entero se rechaza.
    problemas.push('Ningun negocio para mirar: la base no dio ninguno activo y SMOKE\\_TENANTS esta vacia');
  }
  const tenants = await Promise.all(TENANTS.map(async (slug) => {
    const [front, rpc] = await Promise.all([
      httpCheck(`https://${slug}.divianco.app`),
      checkCatalogRpc(slug),
    ]);
    return { slug, front, rpc };
  }));
  for (const t of tenants) {
    const ok = t.front === '✓' && t.rpc.startsWith('✓');
    if (!ok) problemas.push(`*${t.slug}* — front: ${t.front} · catalogo: ${t.rpc}`);
    detalles.push(`${ok ? '🟢' : '🔴'} ${t.slug} · ${t.rpc}`);
  }
  for (const slug of lista.enCarga) detalles.push(`🟡 ${slug} · en carga (sin activar)`);

  /* ── 3. submit-order viva ────────────────────────────── */
  const fn = await checkSubmitOrder();
  if (fn !== '✓') problemas.push(`submit-order: ${fn}`);

  /* ── 4. Drift de schema (opcional, exige service role) ─ */
  const drift = checkSchemaDrift();
  if (drift.rojo) problemas.push(`Snapshot del edificio DESACTUALIZADO — correr npm run schema:sync`);
  detalles.push(`schema: ${drift.texto}`);

  /* ── 5. Drift de funciones (opcional, exige service role) ─
     El de schema mira COLUMNAS; este mira el CUERPO y la firma de todas las
     funciones de public. Es el unico que habria visto que `signup_tenant` desplegada no
     la producia ninguna migracion del repo (29/ago). */
  const fnDrift = checkFunctionsDrift();

  /* ── 5b. RLS (opcional, exige service role) ────────────
     El unico que mira el aislamiento entre negocios. Una tabla abierta no
     falla: la app anda y los datos de todos quedan a la vista. */
  /* ── 5c. Migraciones sin archivo (opcional, exige service role) ─
     Lo aplicado al edificio que el repo no tiene: el 16/oct aparecio
     alta_de_duenio_con_roles (14/oct) y el repo decia que corria la version
     rota de provision_owner. */
  const sinArchivo = checkMigracionesSinArchivo();

  // Con nombres y, si el archivo ya esta en un PR abierto, su numero: el
  // 29/oct el aviso decia solo "DRIFT" y era la 0113 esperando en el PR 54.
  const faltan = {
    funciones: fnDrift.rojo ? nombresDelDrift(fnDrift.salida) : [],
    migraciones: sinArchivo.rojo ? nombresSinArchivo(sinArchivo.salida) : [],
  };
  const enPr = faltan.funciones.length || faltan.migraciones.length
    ? buscarEnPrs(faltan, await traerPrsAbiertos())
    : new Map();
  if (fnDrift.rojo) {
    const cuales = faltan.funciones.length ? `: ${listarConPr(faltan.funciones, enPr)}` : '';
    problemas.push(`Funciones DRIFTEADAS vs migraciones${cuales} — node scripts/check-functions-drift.mjs --verbose`);
  }
  detalles.push(`funciones: ${fnDrift.texto}`);
  if (sinArchivo.rojo) {
    const cuales = faltan.migraciones.length ? `: ${listarConPr(faltan.migraciones, enPr)}` : '';
    problemas.push(`Migraciones APLICADAS sin archivo en el repo${cuales} — node scripts/check-migraciones-sin-archivo.mjs`);
  }
  detalles.push(`migraciones: ${sinArchivo.texto}`);

  const rls = checkRls();
  if (rls.rojo) problemas.push(`RLS ABIERTO entre negocios — npm run check:rls`);
  detalles.push(`rls: ${rls.texto}`);

  /* ── 6. Sentry (opcional) ────────────────────────────── */
  // Primero, que el build publicado tenga Sentry adentro. Sin el DSN la app
  // no reporta nada y "sin errores en 24h" sale verde igual: paso del 27/sep
  // al 16/oct sin que nadie se enterara.
  const enBuild = await checkSentryEnBuild();
  if (enBuild.rojo) problemas.push(`Sentry: ${enBuild.texto}`);
  const sentry = await checkSentry();
  if (sentry.rojo) problemas.push(`Sentry: ${sentry.texto}`);
  // Sin Sentry en el build, "sin errores" no dice nada: no llega nada.
  else detalles.push(`sentry: ${enBuild.rojo ? 'sin datos (no esta en el build)' : sentry.texto}`);
  // Las pruebas viejas se cierran en cada corrida, haya prueba nueva o no:
  // si quedan abiertas se acumulan en Sentry.
  const pruebasViejas = await cerrarPruebasViejas();
  if (pruebasViejas) detalles.push(`pruebas de alerta: ${pruebasViejas}`);
  const pruebaAlerta = process.env.PROBAR_ALERTA === 'true' ? await probarAlerta(enBuild.dsn) : null;

  /* ── Mensaje: lo roto primero, el verde corto ────────── */
  const date = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const lines = [`${TURNO.emoji} *Dico — salud del edificio · ${TURNO.nombre}*`, `_${date}_`, ''];

  if (problemas.length === 0) {
    lines.push(`✅ Todo en verde (${TENANTS.length} tenants, función, schema).`);
    lines.push('');
    lines.push(...detalles.map(d => `  ${d}`));
  } else {
    lines.push(`⚠️ *${problemas.length} problema${problemas.length > 1 ? 's' : ''}:*`);
    lines.push(...problemas.map(p => `• ${p}`));
    lines.push('');
    lines.push(...detalles.map(d => `  ${d}`));
  }

  /* ── Cerebro (opcional): que significa lo roto y que hacer ── */
  if (problemas.length) {
    const cerebro = await explicarConCerebro(problemas);
    if (cerebro) lines.push('', '🧠 *Que significa*', cerebro);
  } else if (process.env.PROBAR_CEREBRO === 'true') {
    // Corrida manual con probar_cerebro: un dia en verde no llama al cerebro,
    // asi que sin esto no hay como saber si la key anda hasta que algo se rompa.
    const cerebro = await explicarConCerebro([
      'Sentry: 1 issue(s) en 24h — TypeError: e is not a function (Settings, crazy-miga)',
    ]);
    lines.push('', '🧪 *Prueba del cerebro* (problema de ejemplo, no real)', cerebro || '(sin DICO\\_BRAIN cargada)');
  }
  if (pruebaAlerta) lines.push('', '🧪 *Prueba de alerta*', pruebaAlerta);

  const msg = lines.join('\n');
  console.log(msg);
  const enviado = await sendTelegram(msg);
  if (enviado) console.log('\n✓ Enviado a Telegram');
}

/* ─────────────────────── Checks ─────────────────────── */

async function httpCheck(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000) });
    return r.ok ? '✓' : `HTTP ${r.status}`;
  } catch (e) {
    return `error: ${e.name}`;
  }
}

/** get_catalog valida DB despierta + RPC + que el tenant tenga productos. */
async function checkCatalogRpc(slug) {
  try {
    const r = await fetch(`${PLATFORM_URL}/rest/v1/rpc/get_catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: PLATFORM_ANON,
        Authorization: `Bearer ${PLATFORM_ANON}`,
      },
      body: JSON.stringify({ p_tenant_slug: slug }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return `HTTP ${r.status}`;
    const data = await r.json();
    const n = Array.isArray(data?.products) ? data.products.length : 0;
    // 0 productos en un negocio real no es "anda": es un catalogo vacio que
    // el cliente ve como local cerrado.
    return n > 0 ? `✓ ${n} productos` : 'catalogo VACIO';
  } catch (e) {
    return `error: ${e.name}`;
  }
}

/** OPTIONS responde el handler CORS de la funcion: viva sin crear pedidos. */
async function checkSubmitOrder() {
  try {
    const r = await fetch(`${PLATFORM_URL}/functions/v1/submit-order`, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(10000),
    });
    return r.ok ? '✓' : `HTTP ${r.status}`;
  } catch (e) {
    return `error: ${e.name}`;
  }
}

/**
 * Reusa schema-sync --check --target=platform, que resuelve solo sus
 * credenciales (.env.scripts local, secrets en CI) y se saltea limpio sin
 * ellas — por eso aca no hay guard de env: se corre siempre y se lee el
 * resultado.
 */
function checkSchemaDrift() {
  const r = spawnSync(process.execPath, [join(HERE, 'schema-sync.mjs'), '--check', '--target=platform'], {
    encoding: 'utf-8', timeout: 60000,
  });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  if (/salteado/.test(salida)) return { rojo: false, texto: 'sin credenciales — salteado' };
  if (r.status === 0) return { rojo: false, texto: '✓ al dia' };
  return { rojo: true, texto: 'DESACTUALIZADO' };
}

/**
 * El cuerpo y las firmas de todas las funciones de public,
 * vs lo que dicen las migraciones.
 *
 * Distinto de checkSchemaDrift: ese compara COLUMNAS y este el CODIGO. Una
 * funcion que drifteo no falla —hace algo distinto de lo que dice el repo— y
 * ningun otro guard lo ve.
 */
function checkFunctionsDrift() {
  const r = spawnSync(process.execPath, [join(HERE, 'check-functions-drift.mjs')], {
    encoding: 'utf-8', timeout: 60000,
  });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  if (/salteado/.test(salida)) return { rojo: false, texto: 'sin credenciales — salteado' };
  if (r.status === 0) return { rojo: false, texto: '✓ coinciden' };
  return { rojo: true, texto: 'DRIFT', salida };
}

/** Historial de migraciones del edificio vs archivos de platform/migrations. */
function checkMigracionesSinArchivo() {
  const r = spawnSync(process.execPath, [join(HERE, 'check-migraciones-sin-archivo.mjs')], {
    encoding: 'utf-8', timeout: 60000,
  });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0) return { rojo: true, texto: 'SIN ARCHIVO', salida };
  if (/salteado/.test(salida)) return { rojo: false, texto: 'sin credenciales — salteado' };
  return { rojo: false, texto: '✓ todas con archivo' };
}

/** Tablas, policies, vistas y SECURITY DEFINER contra la regla de check-rls.mjs. */
function checkRls() {
  const r = spawnSync(process.execPath, [join(HERE, 'check-rls.mjs')], {
    encoding: 'utf-8', timeout: 60000,
  });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  // El exit code PRIMERO: son dos chequeos (tablas y funciones) y uno puede
  // saltear mientras el otro da rojo. Mirando antes "salteado", ese rojo
  // salia verde en el reporte.
  if (r.status !== 0) return { rojo: true, texto: 'ABIERTO' };
  if (/salteado/.test(salida)) return { rojo: false, texto: 'sin credenciales — salteado' };
  return { rojo: false, texto: '✓ cerrado' };
}

/**
 * El JS que se sirve en produccion tiene el DSN de Sentry? Se busca el host de
 * ingesta en el bundle principal de la landing. Vite saca el codigo de Sentry
 * entero cuando VITE_SENTRY_DSN no esta al compilar, asi que no aparece ni la
 * palabra.
 */
async function checkSentryEnBuild() {
  try {
    const html = await (await fetch(LANDING, { signal: AbortSignal.timeout(10000) })).text();
    // El DSN no queda en index-*.js sino en el chunk de observability, que la
    // landing precarga: se miran todos los .js que nombra el HTML.
    const chunks = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
    if (!chunks.length) return { rojo: true, texto: 'no encontre el bundle principal en la landing' };
    for (const js of chunks) {
      const codigo = await (await fetch(LANDING + js, { signal: AbortSignal.timeout(15000) })).text();
      const dsn = dsnDelCodigo(codigo);
      if (dsn) return { rojo: false, texto: '✓ en el build', dsn };
    }
    return { rojo: true, texto: 'NO esta en el build publicado: falta VITE\\_SENTRY\\_DSN en Vercel (hermes-platform). Los errores de la app no llegan a ningun lado.' };
  } catch (e) {
    return { rojo: true, texto: `no pude revisar el build (${e.name})` };
  }
}

/** Issues sin resolver vistos en la ventana del turno. Sin token se saltea. */
async function checkSentry() {
  // trim: al pegar un secret suele colarse un salto de linea al final, y con
  // eso la URL ya no encuentra ni la org ni el proyecto (404).
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  if (!token || !org || !project) return { rojo: false, texto: 'sin token — salteado' };

  const ruta = `/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/`
    // lastSeen en la query: statsPeriod solo arma las estadisticas, no filtra.
    // Sin esto el reporte decia "en 24h" de un error de hace dos dias (28/sep).
    // !prueba:alerta: los errores de probar_alerta no son de la app.
    + `?query=${encodeURIComponent(`is:unresolved lastSeen:-${TURNO.ventana} !prueba:alerta`)}&statsPeriod=24h&limit=5`;
  try {
    const r = await sentryApi(token, ruta);
    if (r.status === 404) {
      return { rojo: true, texto: 'org o proyecto no encontrados: SENTRY\\_ORG y SENTRY\\_PROJECT van con el nombre corto de la URL' };
    }
    if (r.status === 401 || r.status === 403) {
      return { rojo: true, texto: `token sin permiso (HTTP ${r.status}): necesita event:read y project:read` };
    }
    if (!r.ok) return { rojo: true, texto: `API HTTP ${r.status}` };
    const issues = await r.json();
    if (!Array.isArray(issues) || issues.length === 0) return { rojo: false, texto: `✓ sin errores en ${TURNO.ventana}` };
    const top = issues.slice(0, 3).map(i => i.title?.slice(0, 60) || i.culprit || '?');
    return { rojo: true, texto: `${issues.length} issue(s) en ${TURNO.ventana} — ${top.join(' · ')}` };
  } catch (e) {
    return { rojo: true, texto: `error: ${e.name}` };
  }
}

/**
 * Pide a la API de Sentry. Una org de la region europea vive en de.sentry.io:
 * sentry.io le contesta 404 aunque org y proyecto esten bien escritos.
 */
async function sentryApi(token, ruta, init = {}) {
  let r;
  for (const base of ['https://sentry.io', 'https://de.sentry.io']) {
    r = await fetch(base + ruta, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (r.status !== 404) break;
  }
  return r;
}

/**
 * Resuelve los issues de probar_alerta que quedaron abiertos. Necesita
 * event:write en SENTRY_AUTH_TOKEN; sin el permiso lo dice y sigue.
 * Devuelve null cuando no hay nada que contar.
 */
async function cerrarPruebasViejas() {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  if (!token || !org || !project) return null;
  const base = `/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/`;
  try {
    const r = await sentryApi(token, `${base}?query=${encodeURIComponent('is:unresolved prueba:alerta')}&limit=25`);
    if (!r.ok) return null;
    const ids = (await r.json()).map((i) => i.id).filter(Boolean);
    if (!ids.length) return null;
    const put = await sentryApi(token, `${base}?${ids.map((id) => `id=${encodeURIComponent(id)}`).join('&')}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    if (put.status === 401 || put.status === 403) {
      return `${ids.length} abierta(s), el token no puede cerrarlas (le falta event:write)`;
    }
    if (!put.ok) return `${ids.length} abierta(s), Sentry no las cerro (HTTP ${put.status})`;
    return `✓ ${ids.length} cerrada(s)`;
  } catch (e) {
    return `no pude cerrarlas (${e.name})`;
  }
}

/**
 * probar_alerta: manda un error de prueba con el DSN del build publicado. La
 * llegada a Telegram no se puede ver desde aca: el mensaje dice que esperar.
 */
async function probarAlerta(dsn) {
  if (!dsn) return '✗ no se mando: el build publicado no tiene el DSN de Sentry.';
  const { url, headers, body } = armarPrueba(dsn);
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!r.ok) return `✗ Sentry rechazo el error de prueba (HTTP ${r.status}).`;
    return 'Sentry recibio un error de prueba. En 1 o 2 minutos tiene que llegar aparte '
      + 'un "🚨 Error nuevo en Dico · prueba". Si no llega, fallo la regla de Sentry, '
      + 'la function sentry-alerta o sus secrets en Supabase.';
  } catch (e) {
    return `✗ no pude mandar el error de prueba (${e.name}).`;
  }
}

/* ─────────────────────── Cerebro ────────────────────── */

/**
 * DICO_BRAIN es la API key de OpenAI (secret de GitHub, la cargo Ricky el
 * 16/oct). Solo se llama si hay problemas: un dia en verde no gasta nada. Si
 * falla, el reporte sale igual, sin la explicacion.
 *
 * Lo que viaja a OpenAI: los renglones de "problemas" (titulos de issues de
 * Sentry, slugs, nombres de checks). No viajan datos de clientes ni pedidos.
 */
async function explicarConCerebro(problemas) {
  const key = process.env.DICO_BRAIN?.trim();
  if (!key) return null;
  const model = process.env.DICO_BRAIN_MODEL?.trim() || 'gpt-4o-mini';
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: 'Sos el gerente tecnico de Dico, una plataforma de catalogos y pedidos para negocios '
              + '(cada negocio vive en <slug>.divianco.app). Le explicas al dueno, que no es programador, '
              + `el reporte de la ${TURNO.nombre}. En espanol argentino,`
              + ' maximo 5 renglones cortos, sin Markdown: '
              + 'que se rompio, a que negocio o cliente afecta, que tan urgente es (hoy / esta semana / '
              + 'puede esperar) y que hacer. No inventes datos que no esten en el reporte.',
          },
          { role: 'user', content: problemas.join('\n') },
        ],
      }),
    });
    if (!r.ok) {
      console.error('DICO_BRAIN: OpenAI respondio', r.status, (await r.text()).slice(0, 200));
      return `(el cerebro no respondio: HTTP ${r.status})`;
    }
    const data = await r.json();
    // Un _ o * suelto rompe el Markdown de Telegram y el mensaje entero se
    // rechaza: se escapan (borrarlos dejaba VITE_SENTRY_DSN como VITESENTRYDSN).
    return String(data.choices?.[0]?.message?.content || '').replace(/[_*`[]/g, '\\$&').trim() || null;
  } catch (e) {
    return `(el cerebro no respondio: ${e.name})`;
  }
}

/* ─────────────────────── Telegram ───────────────────── */

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  const enviar = (conMarkdown) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT,
      text,
      ...(conMarkdown ? { parse_mode: 'Markdown' } : {}),
      disable_web_page_preview: true,
    }),
  });
  let r = await enviar(true);
  // Un texto que no controlamos (el titulo de un issue de Sentry, un slug) con
  // un `_` o un `*` sin cerrar rompe el Markdown y Telegram rechaza el mensaje
  // ENTERO: el reporte no llegaba (27/sep). Se reintenta en texto plano, que
  // se ve peor pero llega.
  if (r.status === 400) {
    console.error('Telegram rechazo el Markdown; reintento en texto plano:', await r.text());
    r = await enviar(false);
  }
  if (!r.ok) {
    const body = await r.text();
    console.error('Telegram API error:', r.status, body);
    process.exitCode = 1;
    return false;
  }
  return true;
}
