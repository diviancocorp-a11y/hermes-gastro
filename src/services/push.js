// src/services/push.js
// Web Push notification service: subscribe/unsubscribe, send via Edge Function.
import { supabase } from '../lib/supabase';

// VAPID public key (set this from environment or settings)
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
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  return permission;
}

export async function subscribeToPush() {
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

  // Save to Supabase
  const subJson = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: subJson.endpoint,
    keys_p256dh: subJson.keys?.p256dh || '',
    keys_auth: subJson.keys?.auth || '',
    user_agent: navigator.userAgent,
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
    // Remove from DB
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
}

export async function isSubscribed() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

// Admin: send push notification to all subscribers
export async function sendPushNotification({ title, body, url, icon }) {
  const { data, error } = await supabase.functions.invoke('send-push', {
    body: { title, body, url, icon },
  });

  if (error) throw error;
  return data;
}

// Admin: get subscriber count
export async function getSubscriberCount() {
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true });

  if (error) return 0;
  return count || 0;
}
