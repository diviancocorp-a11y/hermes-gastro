// src/services/account.js
// La cuenta del COMPRADOR en el catalogo: perfil, direcciones, favoritos e
// historial de pedidos. ETAPA 5b.
//
// Habla solo con el edificio. Hasta el 29/sep bifurcaba por
// `business.platform` con un camino legacy (recipes, `recipe_id`,
// get_phone_customer_orders) que ningun build ejecutaba.
//
// Para las pantallas se traduce aca, en el borde, al shape que ya esperaban:
//   - favoritos: `product_id` sobre `products` (la receta ES el producto)
//   - pedidos: `created_at`/`customer_name` -> `customer`

import { supabase } from '../lib/supabase';

/* ─────────────────── Carga inicial de la cuenta ─────────────────── */

/**
 * Perfil + direcciones + favoritos de un usuario logueado.
 *
 * Devuelve SIEMPRE las tres claves aunque alguna consulta falle: el llamador
 * (AuthContext) pisa su estado con esto, y un undefined ahi dejaria la
 * pantalla mostrando los datos del usuario anterior.
 */
export async function fetchUserData(userId) {
  if (!userId) return { profile: null, addresses: [], favorites: [] };

  const [profRes, addrRes, favRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('addresses').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('favorites').select('product_id').eq('user_id', userId),
  ]);

  if (profRes.error) console.warn('perfil:', profRes.error.message);
  if (addrRes.error) console.warn('direcciones:', addrRes.error.message);
  if (favRes.error) console.warn('favoritos:', favRes.error.message);

  return {
    profile: profRes.data || null,
    addresses: addrRes.data || [],
    favorites: (favRes.data || []).map(f => f.product_id),
  };
}

/* ─────────────────────────── Perfil ─────────────────────────────── */

export async function updateProfile(userId, data) {
  if (!userId) return false;
  // upsert y no update: en el edificio el comprador se registra en el
  // catalogo y NO tiene fila de profiles todavia (la de 0008 solo la creaba
  // provision_owner, para duenos). Con update, guardar su nombre no hacia
  // nada y no avisaba.
  const fila = { ...data, id: userId, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('profiles').upsert(fila);
  if (error) { console.error('updateProfile:', error.message); return false; }
  return true;
}

/* ───────────────────────── Direcciones ──────────────────────────── */

export async function addAddress(userId, addr) {
  if (!userId) return null;
  const { data, error } = await supabase.from('addresses').insert({
    user_id: userId,
    label: addr.label || 'Casa',
    address: addr.address,
    lat: addr.lat || null,
    lng: addr.lng || null,
    notes: addr.notes || null,
  }).select().single();
  if (error) { console.error('addAddress:', error.message); return null; }
  return data;
}

export async function removeAddress(userId, id) {
  if (!userId) return false;
  // El .eq('user_id') es redundante con la RLS y se deja igual: si algun dia
  // la policy se afloja, este filtro sigue impidiendo borrar lo ajeno.
  const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', userId);
  return !error;
}

export async function updateAddress(userId, id, data) {
  if (!userId) return false;
  const { error } = await supabase.from('addresses').update(data).eq('id', id).eq('user_id', userId);
  return !error;
}

/* ────────────────────────── Favoritos ───────────────────────────── */

/** @param esFav estado ACTUAL: true = estaba marcado y hay que sacarlo. */
export async function toggleFavorite(userId, itemId, esFav) {
  if (!userId) return false;
  const { error } = esFav
    ? await supabase.from('favorites').delete().eq('user_id', userId).eq('product_id', itemId)
    : await supabase.from('favorites').insert({ user_id: userId, product_id: itemId });
  if (error) { console.error('toggleFavorite:', error.message); return false; }
  return true;
}

/**
 * Los productos favoritos, con el shape que muestra la pantalla
 * (`sale_price`, el nombre del legacy).
 */
export async function fetchFavoriteProducts(ids) {
  if (!ids?.length) return [];
  const { data, error } = await supabase
    .from('products').select('id, name, price, image_url, category').in('id', ids);
  if (error) { console.error('favoritos:', error.message); return []; }
  return (data || []).map(p => ({ ...p, sale_price: p.price }));
}

/* ───────────────────────── Historial ────────────────────────────── */

/**
 * Pedidos del comprador. Con cuenta se resuelven por `user_id` y la RLS
 * (0035); sin cuenta, por telefono.
 *
 * OJO — el historial POR TELEFONO devuelve vacio a proposito. El legacy lo
 * resolvia con un RPC SECURITY DEFINER que matcheaba el telefono, o sea que
 * cualquiera que escribiera un numero ajeno veia esos pedidos. En una
 * plataforma con muchos locales es el mismo agujero multiplicado: queda
 * anotado en el PLAN-ERP para resolverlo a proposito.
 */
export async function fetchOrderHistory({ user }) {
  if (!user) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('id, created_at, total, status, delivery, payment, customer_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('historial:', error.message); return []; }
  // Al shape que ya usaba la pantalla: cae a created_at si no hay date.
  return (data || []).map(o => ({ ...o, customer: o.customer_name }));
}
