// src/services/entradaUnica.js
// Un solo inicio de sesion para todos los negocios (divianco.app/entrar).
//
// PROBLEMA QUE RESUELVE: la sesion de Supabase vive en el localStorage de UN
// origen. Entrar en divianco.app y saltar a <slug>.divianco.app dejaba a la
// persona sin sesion, y el admin del negocio le pedia el login de nuevo.
//
// COMO: el negocio no se adivina del host sino del USUARIO. Con la sesion
// abierta se leen sus negocios (la policy `tenants_select` ya devuelve solo
// aquellos de los que es miembro) y se decide:
//   - uno        -> directo a su /admin
//   - varios     -> la pantalla le pregunta a cual
//   - ninguno    -> el caso de siempre: signup_tenant() es idempotente y crea
//                   el negocio de quien confirmo el mail y nunca llego a
//                   /bienvenido, o marca al staff de Divianco
//
// TRASPASO: la sesion viaja en el hash de la URL (el hash no se manda al
// servidor ni sale en el Referer). El receptor lo saca de la barra ANTES de
// hacer cualquier otra cosa.
//
// NUNCA se llama a `supabase.auth.signOut()` del lado de salida, ni siquiera
// con `scope: 'local'`: eso hace POST /logout y REVOCA la sesion en el
// servidor, y la que viaja en el hash llegaria muerta (paso en produccion el
// 3/nov/2026: todos volvian a /entrar). Para que el mismo refresh token no
// quede vivo en dos origenes se borra la sesion del localStorage de este
// origen, sin avisarle al servidor.

import { supabase } from '../lib/supabase';
import { isPlatformRoot, isConsolaHost, CONSOLA_HOST, PLATFORM_ROOTS } from '../lib/tenantHost';
import { destinoTrasLogin } from './signup';
import { soyStaffDivianco } from './platformPlanes';

/** Nombre del parametro del hash. No se llama como los de Supabase a
 *  proposito: el cliente procesa solo `access_token=`, y no tiene que tocarlo. */
export const CLAVE_TRASPASO = 'dico-sesion';

/** Forma valida de un slug. Es lo que impide armar una URL a otro host: el
 *  slug sale de la base, pero se vuelve a validar donde se usa. */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const slugValido = (s) => SLUG.test(String(s || ''));

/** Los negocios de la persona logueada, ordenados por nombre. */
export async function negociosDelUsuario() {
  const { data, error } = await supabase
    .from('tenants')
    .select('slug, name')
    .order('name', { ascending: true });
  if (error) return { ok: false, error: 'No pudimos traer tus negocios. Probá de nuevo.' };
  const negocios = (data || []).filter((n) => slugValido(n.slug));
  return { ok: true, negocios };
}

/**
 * A donde va la persona que acaba de entrar.
 * @returns {Promise<
 *   { ok: false, error: string } |
 *   { ok: true, tipo: 'negocio', negocio: { slug: string, name: string } } |
 *   { ok: true, tipo: 'elegir', negocios: Array<{ slug: string, name: string }>, consola?: true } |
 *   { ok: true, tipo: 'staff' }
 * >}
 */
export async function resolverDestino() {
  const r = await negociosDelUsuario();
  if (!r.ok) return r;

  // Staff de Divianco que ademas es dueño de negocios: la consola es una
  // puerta mas. Se pregunta siempre, tenga uno o varios, porque con uno solo
  // se lo mandaria directo al negocio y la consola quedaria inalcanzable.
  // (Sin negocios no hace falta: lo resuelve destinoTrasLogin mas abajo.)
  if (r.negocios.length > 0 && (await soyStaffDivianco())) {
    return { ok: true, tipo: 'elegir', negocios: r.negocios, consola: true };
  }

  if (r.negocios.length === 1) return { ok: true, tipo: 'negocio', negocio: r.negocios[0] };
  if (r.negocios.length > 1) return { ok: true, tipo: 'elegir', negocios: r.negocios };

  const d = await destinoTrasLogin();
  if (!d.ok) return d;
  if (!d.slug) return { ok: true, tipo: 'staff' };
  return { ok: true, tipo: 'negocio', negocio: { slug: d.slug, name: d.slug } };
}

/** La sesion abierta, empaquetada para viajar en el hash de `base`. */
async function urlConTraspaso(base) {
  const { data } = await supabase.auth.getSession();
  const s = data?.session;
  if (!s?.access_token || !s?.refresh_token) {
    return { ok: false, error: 'Se cerró tu sesión. Volvé a entrar.' };
  }
  const carga = encodeURIComponent(JSON.stringify({ a: s.access_token, r: s.refresh_token }));
  return { ok: true, traspasa: true, url: `${base}#${CLAVE_TRASPASO}=${carga}` };
}

/**
 * Arma el link al admin del negocio.
 * Desde la raiz de la plataforma cruza de origen y lleva la sesion en el hash;
 * en local y en las URLs *.vercel.app no hay subdominio, el origen es el mismo
 * y la sesion ya esta.
 */
export async function armarUrlAdmin(slug) {
  if (!slugValido(slug)) return { ok: false, error: 'Ese negocio no es válido.' };

  if (!isPlatformRoot(window.location.hostname)) {
    return { ok: true, traspasa: false, url: `${window.location.origin}/admin` };
  }
  return urlConTraspaso(`https://${slug}.divianco.app/admin`);
}

/** Igual, para la consola de Divianco (consola.divianco.app). */
export async function armarUrlConsola() {
  if (!isPlatformRoot(window.location.hostname)) {
    return { ok: true, traspasa: false, url: `${window.location.origin}/consola` };
  }
  return urlConTraspaso(`https://${CONSOLA_HOST}/`);
}

/** Prefijo de las claves de sesion de Supabase en localStorage (src/lib/supabase.js). */
const CLAVE_SESION = 'hermes-auth';

/**
 * Olvida la sesion de ESTE origen sin revocarla: la copia que viaja en el hash
 * sigue siendo valida. Se frena el auto-refresh antes, o este origen podria
 * rotar el refresh token y dejar muerto el que se mando.
 */
async function olvidarSesionLocal() {
  try { await supabase.auth.stopAutoRefresh(); } catch { /* se sigue igual */ }
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(CLAVE_SESION))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch { /* sin localStorage: nada que borrar */ }
}

/** Cruza de origen: olvida la sesion de este y navega. Si sale bien, no vuelve. */
async function irA(r) {
  if (!r.ok) return r;
  if (r.traspasa) await olvidarSesionLocal();
  window.location.assign(r.url);
  return { ok: true };
}

/** Lleva a la persona al admin de su negocio. */
export const irAlAdmin = async (slug) => irA(await armarUrlAdmin(slug));

/** Lleva al staff a la consola. */
export const irALaConsola = async () => irA(await armarUrlConsola());

/**
 * A donde manda la consola a quien llega sin sesion o sin permiso: al login
 * unico, que vive en la raiz de la plataforma.
 */
export function urlDeEntrar() {
  if (isConsolaHost(window.location.hostname)) return `https://${PLATFORM_ROOTS[0]}/entrar`;
  return `${window.location.origin}/entrar`;
}

/**
 * Lado receptor: si la URL trae una sesion de traspaso, la toma.
 * Lo primero que hace, y de forma sincronica, es sacar el hash de la barra:
 * un token en la barra queda en el historial y en lo que se copie.
 * @returns {Promise<boolean>} true si dejo una sesion abierta.
 */
export async function tomarTraspaso() {
  let crudo = null;
  try {
    const hash = window.location.hash || '';
    if (!hash.includes(`${CLAVE_TRASPASO}=`)) return false;
    crudo = new URLSearchParams(hash.slice(1)).get(CLAVE_TRASPASO);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    return false;
  }

  try {
    const { a, r } = JSON.parse(crudo || '');
    if (typeof a !== 'string' || typeof r !== 'string' || !a || !r) return false;
    const { error } = await supabase.auth.setSession({ access_token: a, refresh_token: r });
    return !error;
  } catch {
    return false;
  }
}
