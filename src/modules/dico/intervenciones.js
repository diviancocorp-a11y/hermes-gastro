/**
 * Cuando Dico Physical sale al plano — y sobre todo, cuando NO.
 *
 * Mismo espiritu que `reglas.js`: funcion pura, sin React, estado adentro e
 * intervencion afuera. Se puede testear sin montar nada.
 *
 * ─────────────────── LA REGLA QUE ORDENA TODO ───────────────────
 *
 * Una intervencion normalmente nace de algo que el usuario acaba de hacer.
 * Hay una excepcion operativa deliberada: cuando comienza la ventana del local
 * y Caja sigue cerrada, el reloj produce un evento porque no se puede iniciar
 * el turno sin registrarla.
 *
 * La auditoria (platform/DICO-PHYSICAL-EVENT-CONTRACT.md) encontro que casi
 * todas las seniales del runtime ya tienen a Dico encima —el aviso 2D, las
 * oportunidades, los toasts— y que sacar a Physical para esas seria decir lo
 * mismo dos veces, mas grande. De ahi que este modulo declare DOS casos y no
 * una tabla de eventos.
 */

/** Los unicos casos implementados. Agregar uno es una decision de producto. */
export const INTERVENCIONES = Object.freeze([
  'catalogo-vacio', 'nada-visible', 'caja-cerrada-al-abrir', 'impulso-enviado:*',
]);

/**
 * Donde se para Dico. Dos, semanticos: no hay coordenadas libres.
 *
 * `presence`  junto a la presencia, donde ya vive. Default.
 * `target`    junto al objetivo real. SOLO para poses direccionales: si la
 *             pose no senala nada, anclar al objetivo no significa nada.
 */
export const ANCLAJES = Object.freeze(['presence', 'target']);

/** Poses que senalan. Son las unicas que pueden pedir `target`. */
const DIRECCIONALES = Object.freeze(['pointDown', 'pointUp']);

function intervencion({ id, pose, mensaje, cta = null, anclaje = 'presence' }) {
  if (anclaje === 'target' && !DIRECCIONALES.includes(pose)) {
    throw new Error(`${id}: anclar al objetivo con una pose que no senala (${pose})`);
  }
  return Object.freeze({ id, pose, mensaje, cta, anclaje });
}

/**
 * @param {object} evento  lo que acaba de pasar
 *   { tipo: 'entro-al-catalogo', productos: number }
 *   { tipo: 'cambio-visibilidad', visiblesAntes: number, visiblesAhora: number }
 *   { tipo: 'local-abierto-sin-caja' }
 *   { tipo: 'impulsar-producto', productoId, producto, audiencia }
 * @param {object} contexto
 *   { vistas: string[]  ids ya mostrados en esta sesion
 *     terminologia: { singular, nuevo } }
 * @returns {null | {id, pose, mensaje, cta, anclaje}}
 */
export function intervencionDe(evento, contexto = {}) {
  const { vistas = [], terminologia: t = { singular: 'producto', nuevo: '+ Agregar producto' } } = contexto;

  if (!evento || typeof evento.tipo !== 'string') return null;

  // ── Orden inmediata de venta ───────────────────────────────────────────
  // El encargado ya tomo la decision al tocar Impulsar. No hay confirmacion,
  // selector de canal ni armado de brief: Dico resuelve el destino antes de
  // llegar aca y confirma que la directriz salio.
  if (evento.tipo === 'impulsar-producto') {
    if (!evento.productoId || !evento.producto || !evento.audiencia) return null;
    return intervencion({
      id: `impulso-enviado:${evento.productoId}`,
      pose: 'celebrate',
      mensaje: `Listo. ${evento.audiencia} ya sabe que hoy impulsamos ${evento.producto}.`,
      anclaje: 'presence',
    });
  }

  // ── 0. Abre el local sin Caja ───────────────────────────────────────────
  // Excepcion de sistema: el productor espera a que horario y Caja hayan
  // cargado. Se muestra una vez por sesion y espera la apertura real de Caja.
  if (evento.tipo === 'local-abierto-sin-caja') {
    if (vistas.includes('caja-cerrada-al-abrir')) return null;
    return intervencion({
      id: 'caja-cerrada-al-abrir',
      pose: 'worried',
      mensaje: 'El local ya abrió y Caja sigue cerrada. Abrila antes de empezar el turno.',
      cta: { texto: 'Abrir Caja', accion: 'abrir-caja' },
      anclaje: 'presence',
    });
  }

  // ── 1. Catalogo vacio ────────────────────────────────────────────────────
  // Se dispara al ENTRAR al catalogo, que es una accion del usuario, y una
  // sola vez por sesion: "no como popup repetitivo en cada entrada". Volver a
  // la pestania cinco veces no lo trae cinco veces.
  if (evento.tipo === 'entro-al-catalogo') {
    if (evento.productos !== 0) return null;
    if (vistas.includes('catalogo-vacio')) return null;
    return intervencion({
      id: 'catalogo-vacio',
      // Senala de verdad: el CTA queda debajo del dedo (ver `anclaje: target`).
      pose: 'pointDown',
      mensaje: `Empecemos por tu primer ${t.singular}. Cargalo y queda publicado en tu catálogo.`,
      cta: { texto: t.nuevo, accion: 'crear-producto' },
      anclaje: 'target',
    });
  }

  // ── 2. Nada visible ──────────────────────────────────────────────────────
  // SOLO por transicion: el usuario apago el ultimo producto visible. Entrar a
  // una cuenta que ya tiene cero visibles no lo dispara, y un re-render con
  // cero tampoco, porque no hay transicion que reportar.
  if (evento.tipo === 'cambio-visibilidad') {
    const antes = Number(evento.visiblesAntes);
    const ahora = Number(evento.visiblesAhora);
    if (!(antes > 0 && ahora === 0)) return null;
    return intervencion({
      id: 'nada-visible',
      // Problema recuperable de un click, no un fallo: `worried`, no `error`.
      pose: 'worried',
      mensaje: 'Apagaste el último visible: tu página se ve vacía para el cliente.',
      cta: { texto: 'Volver a mostrarlo', accion: 'revisar-visibilidad' },
      anclaje: 'presence',
    });
  }

  return null;
}

/**
 * Si la intervencion sigue teniendo sentido con el estado de ahora.
 *
 * Es lo que la cierra: no hay timers ni auto-dismiss. Dico se va cuando la
 * accion que esperaba resolvio el estado —se cargo un producto, se volvio a
 * mostrar alguno— o cuando el usuario lo guarda con la ranura.
 */
export function sigueVigente(intervencionActiva, estado = {}) {
  if (!intervencionActiva) return false;
  const { productos = 0, visibles = 0, operativo = false, cajaAbierta = false } = estado;
  if (intervencionActiva.id === 'catalogo-vacio') return productos === 0;
  if (intervencionActiva.id === 'nada-visible') return visibles === 0;
  if (intervencionActiva.id === 'caja-cerrada-al-abrir') return operativo && !cajaAbierta;
  if (intervencionActiva.id.startsWith('impulso-enviado:')) return true;
  return false;
}
