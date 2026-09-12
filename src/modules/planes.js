/**
 * Los planes de Dico: QUE incluye cada uno.
 *
 * LA DIVISION CON LA BASE
 * Los PRECIOS y las PROMOS viven en la tabla `plans` y los edita Ricky desde
 * la consola: cambian con la inflacion y son numeros, no decisiones. Lo que
 * está acá es qué desbloquea cada plan, que es producto: se versiona con el
 * código, se revisa en un diff y se prueba. Si viviera en la base, un UPDATE
 * mal hecho le abre el ERP entero al plan más barato sin dejar rastro.
 *
 * Es la misma división que hizo 6f con los roles, por la misma razón.
 *
 * POR QUE NO SE SEGMENTA POR MODO OPERATIVO
 * La idea original era cobrar distinto a físico / digital / híbrido. El modo
 * no correlaciona con el valor ni con la capacidad de pago —una dark kitchen
 * puede facturar más que un bar— y ningún competidor del mercado segmenta así.
 * El modo pasa a SUGERIR el plan en el alta, no a definirlo.
 *
 * QUE SEPARA UN PLAN DEL OTRO (desde el 12/sep/2026)
 * Ya no son los módulos: el plan gratis los trae todos. Lo que se paga es lo
 * que un local en blanco necesita para operar —facturación electrónica, cocina
 * en pantalla, soporte con una persona del otro lado— y la escala: varias
 * sucursales con su consolidado. Si algún día vuelve a haber un módulo que
 * solo esté en un plan pago, va acá y se nota en el diff.
 *
 * DICOTIP NO ES UN EXTRA
 * Se evaluó cobrarlo aparte y se decidió que no: es el diferencial que hace que
 * los mozos QUIERAN que el local use Dico. Ponerle precio frena justo lo que
 * tiene que propagarse.
 */

/** Todo lo que el edificio sabe hacer hoy, por si hay que sumar un plan. */
const TODO = [
  'products', 'orders', 'stock', 'finanzas', 'ventas', 'personal',
  'mesas', 'caja', 'agenda', 'variants',
];

export const PLANES = {
  /**
   * DIGITAL — gratis desde el 12/sep/2026.
   *
   * Antes valía $29.000 e incluía seis módulos. El cambio no es una promo: es
   * la apuesta de que el producto se vende usándolo. Un local que carga sus
   * recetas y ve su primer P&L real ya entendió para qué sirve; uno que mira
   * una página de precios, no. Lo que se cobra pasa a ser lo que un local en
   * blanco necesita para operar —facturación, cocina en pantalla, soporte— y
   * lo que solo le sirve a quien ya creció: varias sucursales.
   *
   * Por eso el plan gratis trae TODO lo que el edificio sabe hacer hoy y sin
   * tope de usuarios: poner un límite de tres personas en un plan pensado para
   * que lo use el equipo entero lo vuelve inservible justo donde tiene que
   * enganchar.
   */
  digital: {
    id: 'digital',
    // Los negocios que operan sin salón. El registry de modos (6a) los llama
    // `virtual`.
    modosSugeridos: ['virtual'],
    modulos: [...TODO],
    limites: {
      sucursales: 1,
      // Sin tope de usuarios, de productos ni de pedidos: cobrar por volumen
      // castiga al que crece, que es justo el que no se quiere perder.
      // `limiteDe` devuelve Infinity cuando la clave no está.
    },
  },

  local: {
    id: 'local',
    modosSugeridos: ['fisico', 'hibrido'],
    modulos: [...TODO],
    limites: {
      sucursales: 1,
    },
  },

  cadena: {
    id: 'cadena',
    modosSugeridos: [],
    modulos: [...TODO],
    limites: {
      // El límite real del plan: varias sucursales, y sin tope.
    },
  },

  /**
   * TOTAL — modelado y NO disponible todavía.
   *
   * Es lo que falta para competir de igual a igual con Fudo y Maxirest en un
   * local que factura en blanco:
   *
   *   - FACTURACION ELECTRONICA (ARCA/AFIP). No es un extra: para un local en
   *     blanco es requisito legal. Fudo la cobra $13.500 aparte y Maxirest la
   *     incluye. El legacy tiene `afip-invoice`; el edificio no.
   *   - SOPORTE 24 h CON IA. Maxirest publica lunes a sábado de 9 a 24, y a
   *     este precio el soporte es parte del producto.
   *
   * Queda con `disponible: false` en la tabla `plans` a propósito: prometer
   * facturación electrónica antes de tenerla es la forma más rápida de perder
   * al primer cliente que factura.
   */
  total: {
    id: 'total',
    modosSugeridos: [],
    modulos: [...TODO],
    limites: {
      sucursales: 100,
      usuarios: 500,
    },
    // Lo que hay que construir antes de venderlo.
    pendiente: ['facturacion-electronica', 'soporte-24h-ia'],
  },
};

export const PLAN_POR_DEFECTO = 'digital';

/** El orden va de menor a mayor: sirve para "¿alcanza con lo que tiene?". */
const ESCALA = ['digital', 'local', 'cadena', 'total'];

/** Si este plan incluye ese módulo. */
export function planTieneModulo(planId, moduloId) {
  const p = PLANES[planId];
  if (!p) return false;
  return p.modulos.includes(moduloId);
}

/**
 * El plan mínimo que incluye un módulo. Es lo que la pantalla necesita para
 * decir "Salón está en el plan Local" en vez de "no tenés permiso", que no le
 * dice a nadie qué hacer.
 */
export function planMinimoPara(moduloId) {
  return ESCALA.find(id => planTieneModulo(id, moduloId)) || null;
}

/** Un límite del plan, o Infinity si ese plan no lo declara. */
export function limiteDe(planId, limite) {
  const v = PLANES[planId]?.limites?.[limite];
  return v === undefined ? Infinity : v;
}

/** Si ya llegó al tope: `cuantos` es lo que tiene HOY. */
export function alcanzoElLimite(planId, limite, cuantos) {
  return Number(cuantos) >= limiteDe(planId, limite);
}

/** Qué plan sugerirle a un negocio según cómo dijo que opera, en el alta. */
export function planSugerido(modo) {
  const encontrado = Object.values(PLANES)
    .find(p => (p.modosSugeridos || []).includes(modo));
  return encontrado?.id || PLAN_POR_DEFECTO;
}

/**
 * Lo que paga los primeros meses, mes a mes.
 *
 * Se calcula acá y no en la pantalla porque el mismo número tiene que salir en
 * la página de precios, en el panel del negocio y en el cobro. Tres lugares
 * calculando lo mismo terminan diciendo tres cosas distintas.
 *
 * `plan` es la fila de la tabla `plans`, con los precios que puso Ricky.
 */
export function cronogramaDeAlta(plan, meses = 12) {
  if (!plan) return [];
  const base = Number(plan.precio_mensual) || 0;
  const gratis = Number(plan.meses_gratis) || 0;
  const conDto = Number(plan.meses_descuento) || 0;
  const pct = Number(plan.descuento_pct) || 0;

  const filas = [];
  for (let i = 0; i < meses; i++) {
    let importe = base;
    let nota = null;
    if (i < gratis) {
      importe = 0;
      nota = 'gratis';
    } else if (i < gratis + conDto) {
      importe = base * (1 - pct / 100);
      nota = `${pct}% off`;
    }
    filas.push({ mes: i + 1, importe, nota });
  }
  return filas;
}

/** Lo que sale el primer año con la promo aplicada. */
export function totalPrimerAnio(plan) {
  return cronogramaDeAlta(plan, 12).reduce((a, f) => a + f.importe, 0);
}
