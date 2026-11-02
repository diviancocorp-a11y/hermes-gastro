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
// hacer cualquier otra cosa. Del lado de salida se cierra la sesion LOCAL de
// divianco.app (`scope: 'local'`: no revoca nada en el servidor) para que el
// mismo refresh token no quede vivo en dos origenes: con la rotacion de
// Supabase, uno de los dos terminaria invalidando al otro.

import { supabase } from '../lib/supabase';
import { isPlatformRoot } from '../lib/tenantHost';
import { destinoTrasLogin } from './signup';

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
 *   { ok: true, tipo: 'elegir', negocios: Array<{ slug: string, name: string }> } |
 *   { ok: true, tipo: 'staff', url: string }
 * >}
 */
export async function resolverDestino() {
  const r = await negociosDelUsuario();
  if (!r.ok) return r;
  if (r.negocios.length === 1) return { ok: true, tipo: 'negocio', negocio: r.negocios[0] };
  if (r.negocios.length > 1) return { ok: true, tipo: 'elegir', negocios: r.negocios };

  const d = await destinoTrasLogin();
  if (!d.ok) return d;
  if (!d.slug) return { ok: true, tipo: 'staff', url: d.url };
  return { ok: true, tipo: 'negocio', negocio: { slug: d.slug, name: d.slug } };
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

  const { data } = await supabase.auth.getSession();
  const s = data?.session;
  if (!s?.access_token || !s?.refresh_token) {
    return { ok: false, error: 'Se cerró tu sesión. Volvé a entrar.' };
  }
  const carga = encodeURIComponent(JSON.stringify({ a: s.access_token, r: s.refresh_token }));
  return { ok: true, traspasa: true, url: `https://${slug}.divianco.app/admin#${CLAVE_TRASPASO}=${carga}` };
}

/** Lleva a la persona al admin de su negocio. Si sale bien, no vuelve. */
export async function irAlAdmin(slug) {
  const r = await armarUrlAdmin(slug);
  if (!r.ok) return r;
  if (r.traspasa) await supabase.auth.signOut({ scope: 'local' });
  window.location.assign(r.url);
  return { ok: true };
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
