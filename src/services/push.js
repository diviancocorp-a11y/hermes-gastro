// src/services/push.js
// Web Push notifications. Suscripciones se asocian con:
//   - user_id (si esta logueado)
//   - phone (si es guest)
//   - role: 'customer' para el catalogo, 'admin' para el panel admin.
// La edge function send-push usa esto para targetear especificos vs broadcast.
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  return await Notification.requestPermission();
}

/**
 * Suscribe el browser actual a push notifications.
 * @param {Object} opts
 * @param {'customer'|'admin'} opts.role - quien se suscribe
 * @param {string|null} opts.userId - auth user id (logueado)
 * @param {string|null} opts.phone - phone (guest)
 */
export async function subscribeToPush({ role = 'customer', userId = null, phone = null } = {}) {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return null;

  const permission = await requestPushPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: subJson.endpoint,
    keys_p256dh: subJson.keys?.p256dh || '',
    keys_auth: subJson.keys?.auth || '',
    user_agent: navigator.userAgent,
    user_id: userId,
    phone: phone,
    role,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  if (error) console.error('Push subscription save error:', error);
  return subscription;
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
}

export async function isSubscribed() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  return !!(await registration.pushManager.getSubscription());
}

/**
 * Envia push notification via Edge Function.
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {string} [payload.url]
 * @param {string} [payload.icon]
 * @param {Object} [payload.target] - { role?, user_id?, phone? }
 */
export async function sendPushNotification({ title, body, url, icon, target = { role: 'customer' } }) {
  const { data, error } = await supabase.functions.invoke('send-push', {
    body: { title, body, url, icon, target },
  });
  if (error) throw error;
  return data;
}


// Helper para mapear order.status -> push payload listo para sendPushNotification.
// Solo dispara para los 3 status que el cliente quiere saber.
const ORDER_STATUS_PUSH = {
  preparing: { title: 'Estamos preparando tu pedido', body: 'Cocina arranco. Te avisamos cuando salga.' },
  ready:     { title: 'Tu pedido esta listo',         body: 'Sale en camino o pasalo a buscar.' },
  done:      { title: 'Pedido entregado',             body: 'Gracias por elegirnos.' },
};

/**
 * Notifica al cliente (por phone) el cambio de status. Fire-and-forget.
 */
export async function notifyOrderStatusChange(phone, status) {
  if (!phone || !ORDER_STATUS_PUSH[status]) return;
  try {
    const payload = ORDER_STATUS_PUSH[status];
    await sendPushNotification({ ...payload, url: '/mi-cuenta?tab=historial', target: { phone } });
  } catch (e) {
    console.warn('notifyOrderStatusChange (non-blocking):', e?.message);
  }
}

export async function getSubscriberCount(role = 'customer') {
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('role', role);
  if (error) return 0;
  return count || 0;
}
