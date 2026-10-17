// scripts/sentry-prueba.mjs
// El error de prueba de `probar_alerta` (morning-health a mano): recorre la
// cadena entera app -> Sentry -> regla "Error nuevo -> Telegram" ->
// sentry-alerta -> GerenteDico. Sirve cada vez que se cambia una clave o el bot.
//
// Usa el DSN que lleva el build publicado (no uno aparte): si la app no
// reporta, la prueba tampoco.

/** El DSN publico que viaja en el bundle. null si no hay. */
export function dsnDelCodigo(codigo) {
  return String(codigo || '').match(/https:\/\/[a-f0-9]+@o\d+\.ingest(?:\.[a-z]+)?\.sentry\.io\/\d+/)?.[0] ?? null;
}

/**
 * Pedido al endpoint store de Sentry. El fingerprint cambia en cada corrida:
 * la regla avisa por issue NUEVO, y con el mismo fingerprint la segunda
 * prueba caeria en el issue de la primera y no avisaria.
 * El tag `prueba` es lo que el resumen diario filtra para no contarla.
 */
export function armarPrueba(dsn, ahora = new Date()) {
  const u = new URL(dsn);
  const key = u.username;
  const proyecto = u.pathname.replace(/\//g, '');
  const cuando = ahora.toISOString();
  return {
    url: `${u.protocol}//${u.host}/api/${proyecto}/store/`,
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=dico-morning-health/1.0, sentry_key=${key}`,
    },
    body: {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: cuando,
      platform: 'javascript',
      level: 'error',
      environment: 'production',
      fingerprint: ['prueba-alerta', cuando],
      exception: { values: [{ type: 'PruebaDico', value: `Prueba de alerta (morning-health ${cuando.slice(0, 16)})` }] },
      tags: { prueba: 'alerta', tenant: 'prueba', screen: '/prueba' },
      request: { url: 'https://prueba.divianco.app/prueba' },
    },
  };
}
