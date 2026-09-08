/**
 * El saludo del fondo, arriba de la superficie madre.
 *
 * El nombre del negocio ya vive en la topbar. Esta banda saluda a la persona
 * que esta trabajando y deja el contexto humano fuera de la pantalla activa.
 *
 * NO ES i18n. El panel del edificio habla español argentino y punto; meter
 * esto en el sistema de traducciones seria arrastrar toda esa maquinaria por
 * tres cadenas.
 */

/**
 * Franjas: la madrugada saluda "buenas noches", como en la calle. Nadie dice
 * "buenos dias" a las 4 de la mañana.
 */
export function saludoDe(fecha = new Date(), timezone) {
  const h = timezone
    ? Number(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: '2-digit', hourCycle: 'h23',
    }).format(fecha))
    : fecha.getHours();
  if (h >= 6 && h < 13) return 'Buenos días';
  if (h >= 13 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

const FRASES = {
  products: [
    'Un catálogo claro vende antes de explicar.',
    'Cada precio cuenta una decisión.',
    'Lo que está ordenado se elige más rápido.',
  ],
  orders: [
    'Cada pedido merece un ritmo claro.',
    'La precisión también se sirve a tiempo.',
    'Un pedido bien seguido llega mejor.',
  ],
  stock: [
    'Lo que se mide a tiempo no falta.',
    'El orden de mañana empieza en el stock de hoy.',
    'Cada unidad visible evita una urgencia.',
  ],
  finanzas: [
    'La claridad también es rentabilidad.',
    'Cada gasto entendido mejora la próxima decisión.',
    'Los números tranquilos nacen de cuentas claras.',
  ],
  ventas: [
    'Los datos muestran dónde insistir.',
    'Cada venta deja una pista para la siguiente.',
    'Mirar el patrón cambia el resultado.',
  ],
  caja: [
    'Un turno claro cierra tranquilo.',
    'Cada movimiento contado protege el resultado.',
    'La caja ordenada sostiene el ritmo.',
  ],
  mesas: [
    'El buen servicio empieza antes de sentarse.',
    'Cada lugar preparado mejora la bienvenida.',
    'El salón ordenado hace liviano el servicio.',
  ],
  personal: [
    'Un equipo coordinado hace liviano el turno.',
    'El ritmo se construye entre todos.',
    'Los roles claros dejan espacio para trabajar.',
  ],
  default: [
    'Lo que se entiende, se puede mejorar.',
    'Una decisión clara mueve todo el día.',
    'El progreso también vive en los detalles.',
  ],
};

/** Una frase estable durante el dia, distinta por pantalla. */
export function fraseDe(pantalla, fecha = new Date(), timezone) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || undefined, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha);
  const numero = ['year', 'month', 'day'].reduce((total, tipo) => (
    total * 37 + Number(partes.find(p => p.type === tipo)?.value || 0)
  ), 0);
  const frases = FRASES[pantalla] || FRASES.default;
  return frases[numero % frases.length];
}

/**
 * El PRIMER nombre, no el completo: "Buenos días Ricardo" es un saludo,
 * "Buenos días Ricardo Rodriguez" es una citacion judicial.
 *
 * Sale de `user_metadata.full_name`, que es lo que escribe el alta. Si no hay
 * —cuentas viejas, invitaciones a medias— cae al usuario del correo, y si
 * tampoco hay correo devuelve null: quien llama decide que poner en su lugar,
 * porque un "Buenos días undefined" es peor que no saludar.
 */
export function nombreDe(session) {
  const meta = session?.user?.user_metadata || {};
  const completo = (meta.full_name || meta.name || '').trim();
  if (completo) return capitalizar(completo.split(/\s+/)[0]);

  const email = session?.user?.email || '';
  const usuario = email.split('@')[0] || '';
  if (!usuario) return null;
  // `dueno.parrilla-smoke` -> `Dueno`: el primer tramo antes de un separador.
  return capitalizar(usuario.split(/[.\-_+]/)[0]);
}

function capitalizar(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
