import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { getLocalStatus, QA_TENANT_ID } from './lib.mjs';

const EMAIL = 'owner.qa-lite@local.test';

/* ────────────────────── LA CLAVE DEJA DE ROTAR ──────────────────────
 *
 * Antes se generaba una clave nueva en CADA corrida. Como esto corre en cada
 * arranque del dev server, la sesion abierta en el navegador quedaba muerta
 * sin aviso: el usuario existia, la clave era otra, y el error que se veia
 * era «Invalid login credentials». Con dos agentes trabajando —cada uno con
 * su worktree y su puerto— el problema se duplica: el que levanta ultimo le
 * invalida la sesion al otro.
 *
 * Ahora la clave se genera UNA vez y se guarda. En las corridas siguientes se
 * reusa, asi que reiniciar el server —o resetear la base entera— ya no echa a
 * nadie. Se puede pisar con `QA_LITE_PASS` y forzar una nueva con `--rotar`.
 *
 * EL ARCHIVO VIVE EN EL HOME, NO EN EL REPO. Cada worktree tiene su propio
 * `.qa-lite/`, asi que guardarla ahi habria dejado una clave por carpeta
 * contra una sola base: volveria la rotacion, disfrazada. En el home hay una,
 * y es la misma para todos los worktrees.
 *
 * Es una base LOCAL de pruebas que no existe fuera de esta maquina: lo que se
 * protege aca es el tiempo del que la usa, no un dato.
 */
export const ARCHIVO_CLAVE = join(homedir(), '.dico-qa-lite', 'owner-pass.txt');

const CLAVE_NUEVA = () => `Qa-${randomBytes(18).toString('base64url')}!`;

/**
 * De donde sale la clave, en orden: la variable de entorno, la guardada, una
 * nueva. Devuelve tambien si hay que persistirla, para que quien llama haga
 * el IO y esto se pueda probar sin tocar el disco.
 */
export function elegirClave({ env = {}, guardada = null, rotar = false } = {}) {
  const delEntorno = (env.QA_LITE_PASS || '').trim();
  if (delEntorno) return { clave: delEntorno, guardar: false, origen: 'entorno' };
  if (!rotar && guardada) return { clave: guardada, guardar: false, origen: 'guardada' };
  return { clave: CLAVE_NUEVA(), guardar: true, origen: 'nueva' };
}

function claveDeOwner({ rotar = false } = {}) {
  let guardada = null;
  try {
    if (existsSync(ARCHIVO_CLAVE)) guardada = readFileSync(ARCHIVO_CLAVE, 'utf8').trim() || null;
  } catch { /* sin permiso de lectura: se genera una nueva */ }

  const elegida = elegirClave({ env: process.env, guardada, rotar });
  if (elegida.guardar) {
    try {
      mkdirSync(dirname(ARCHIVO_CLAVE), { recursive: true });
      writeFileSync(ARCHIVO_CLAVE, `${elegida.clave}
`, 'utf8');
    } catch (e) {
      // No es fatal: la clave sirve igual en esta corrida, solo no sobrevive.
      console.warn(`No se pudo guardar la clave de QA (${e.message}); esta corrida usa una nueva.`);
    }
  }
  return elegida.clave;
}

async function findByEmail(admin, email) {
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`No se pudo listar Auth local: ${error.message}`);
    const hit = (data?.users || []).find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if ((data?.users || []).length < 100) return null;
  }
  return null;
}

export async function bootstrapUser(status = getLocalStatus(), { rotar = false } = {}) {
  const password = claveDeOwner({ rotar });
  const admin = createClient(status.apiUrl, status.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let user = await findByEmail(admin, EMAIL);
  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password, user_metadata: { full_name: 'Owner QA Lite' },
    });
    if (error) throw new Error(`No se pudo actualizar Auth local: ${error.message}`);
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Owner QA Lite' },
    });
    if (error) throw new Error(`No se pudo crear Auth local: ${error.message}`);
    user = data.user;
  }

  const { data: existing, error: existingError } = await admin
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', QA_TENANT_ID)
    .eq('user_id', user.id)
    .is('branch_id', null)
    .maybeSingle();
  if (existingError) throw new Error(`No se pudo leer membresia local: ${existingError.message}`);

  const membership = {
    tenant_id: QA_TENANT_ID,
    user_id: user.id,
    branch_id: null,
    role: 'owner',
    roles: ['owner'],
  };
  const memberResult = existing
    ? await admin.from('tenant_members').update(membership).eq('id', existing.id)
    : await admin.from('tenant_members').insert(membership);
  if (memberResult.error) throw new Error(`No se pudo vincular owner local: ${memberResult.error.message}`);

  const { error: profileError } = await admin.from('profiles').upsert({
    id: user.id,
    tenant_id: QA_TENANT_ID,
    full_name: 'Owner QA Lite',
    name: 'Owner QA Lite',
    email: EMAIL,
    updated_at: '2026-08-20T18:30:00.000Z',
  }, { onConflict: 'id' });
  if (profileError) throw new Error(`No se pudo crear profile local: ${profileError.message}`);

  const checks = {};
  for (const table of ['tenants', 'branches', 'settings', 'products', 'orders', 'payment_methods', 'cash_sessions', 'resources']) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Validacion local fallo en ${table}: ${error.message}`);
    checks[table] = count;
  }
  /* `>=` y no `===`: lo que esto detecta es un seed que NO SE APLICO, y para
     eso alcanza el minimo. La igualdad estricta ademas impedia cargar data de
     revision encima del fixture —`scripts/qa-lite/cargar-productos-demo.mjs`,
     que existe para poder mirar una pantalla con el volumen de un negocio
     real— sin tocar el seed determinista.
     OJO: los gates de pixel (visual-parity, phase9, dico-*) SI dependen del
     fixture exacto. Antes de correrlos hay que volver al seed limpio con
     `npm run qa:lite:setup` o `cargar-productos-demo.mjs --limpiar`. */
  if (checks.tenants !== 1 || checks.products < 4 || checks.orders < 3) {
    throw new Error(`Seed local incompleto: ${JSON.stringify(checks)}`);
  }

  return { email: EMAIL, password, counts: checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrapUser(getLocalStatus(), { rotar: process.argv.includes('--rotar') })
    .then(({ email, password, counts }) => {
      console.log(`QA local listo para ${email}. Conteos: ${JSON.stringify(counts)}`);
      console.log(`Clave: ${password}  (guardada en ${ARCHIVO_CLAVE})`);
    })
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
