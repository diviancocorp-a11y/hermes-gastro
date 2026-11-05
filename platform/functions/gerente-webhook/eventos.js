// Resumen de los eventos del panel (tabla eventos_app, 0124). Logica pura,
// en .js para que la usen las dos puntas sin duplicarla: GerenteDico
// (herramienta `eventos`, Deno) y morning-health (Node).
//
// Solo slugs, funciones y conteos: nada de los clientes de cada negocio.

const BLOQUEO = /^plan-bloqueo-(visto|click)$/;

/**
 * @param {{ tenant_id: string, nombre: string, props?: { funcion?: string } }[]} filas
 * @param {Record<string, string>} slugs  tenant_id -> slug
 */
export function resumirEventos(filas, slugs = {}) {
  const porEvento = {};
  const bloqueos = {};
  for (const e of filas || []) {
    porEvento[e.nombre] = (porEvento[e.nombre] || 0) + 1;
    const m = BLOQUEO.exec(e.nombre);
    if (!m) continue;
    const funcion = e.props?.funcion || 'sin_funcion';
    const b = bloqueos[funcion] || (bloqueos[funcion] = { funcion, vistos: 0, clicks: 0, vieron: new Set(), tocaron: new Set() });
    const slug = slugs[e.tenant_id] || e.tenant_id;
    if (m[1] === 'visto') { b.vistos++; b.vieron.add(slug); } else { b.clicks++; b.tocaron.add(slug); }
  }
  return {
    total: (filas || []).length,
    por_evento: porEvento,
    // Primero lo que alguien toco: un click en Ver planes es alguien
    // mirando el precio del plan siguiente.
    bloqueos: Object.values(bloqueos)
      .map((b) => ({
        funcion: b.funcion, vistos: b.vistos, clicks: b.clicks,
        negocios_que_vieron: [...b.vieron].sort(), negocios_que_tocaron_ver_planes: [...b.tocaron].sort(),
      }))
      .sort((a, b) => b.clicks - a.clicks || b.vistos - a.vistos || a.funcion.localeCompare(b.funcion)),
  };
}

/**
 * Lineas para el reporte de Telegram (Markdown). Sin eventos no hay lineas:
 * un "0 vistos" cada manana es ruido.
 */
export function lineasDeBloqueos(resumen, ventana) {
  if (!resumen?.bloqueos?.length) return [];
  // Un _ suelto abre una cursiva que no cierra y Telegram rechaza el mensaje.
  const md = (s) => String(s).replace(/([_*`[])/g, '\\$1');
  const lineas = [`📊 *Bloqueos de plan (${ventana})*`];
  for (const b of resumen.bloqueos) {
    let linea = `• ${md(b.funcion)}: ${b.vistos} ${b.vistos === 1 ? 'vista' : 'vistas'}`;
    linea += b.clicks
      ? `, ${b.clicks} en Ver planes (${b.negocios_que_tocaron_ver_planes.map(md).join(', ')})`
      : ', nadie tocó Ver planes';
    lineas.push(linea);
  }
  return lineas;
}
