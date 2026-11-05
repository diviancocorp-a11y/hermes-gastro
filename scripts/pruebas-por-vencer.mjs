// scripts/pruebas-por-vencer.mjs
// Negocios con la prueba de Dante por terminar (tenants.prueba_hasta, 0122),
// para el reporte de la manana de morning-health.
//
// Por que avisar: los ultimos dias de la prueba son el mejor momento para
// escribirle al negocio, antes de que vuelva a Paris y pierda la ganancia y
// el CRM. Mismo criterio que diasDePrueba (src/modules/planes.js): cuenta
// solo si el plan es menor que Dante y la prueba sigue vigente.

export const DIAS_DE_AVISO = 3;

// Planes menores que Dante ('local'). Hoy solo Paris.
const MENORES_QUE_DANTE = new Set(['digital']);

/**
 * @param {{ slug: string, plan_id: string|null, prueba_hasta: string|null }[]} filas
 * @returns {{ slug: string, dias: number }[]} de la que vence antes a la ultima
 */
export function pruebasPorVencer(filas, ahora = new Date(), aviso = DIAS_DE_AVISO) {
  const out = [];
  for (const t of filas || []) {
    if (!MENORES_QUE_DANTE.has(t.plan_id) || !t.prueba_hasta) continue;
    const ms = new Date(t.prueba_hasta).getTime() - ahora.getTime();
    if (!(ms > 0)) continue;
    const dias = Math.ceil(ms / 86400000);
    if (dias <= aviso) out.push({ slug: t.slug, dias });
  }
  return out.sort((a, b) => a.dias - b.dias || a.slug.localeCompare(b.slug));
}

/** Lineas para Telegram (Markdown). Sin pruebas por vencer, ninguna. */
export function lineasDePruebas(lista) {
  if (!lista?.length) return [];
  const md = (s) => String(s).replace(/([_*`[])/g, '\\$1');
  return [
    '⏳ *Pruebas de Dante por terminar*',
    ...lista.map((p) => `• ${md(p.slug)}: ${p.dias === 1 ? 'termina hoy o mañana' : `le quedan ${p.dias} días`}`),
  ];
}

/**
 * Lee la base con la service role. null sin credenciales o si no contesta:
 * es una novedad, no puede tirar el reporte.
 */
export async function traerPruebasPorVencer(env = process.env) {
  const url = (env.PLATFORM_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/tenants?select=slug,plan_id,prueba_hasta&prueba_hasta=gt.${encodeURIComponent(new Date().toISOString())}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) return null;
    return pruebasPorVencer(await r.json());
  } catch {
    return null;
  }
}
