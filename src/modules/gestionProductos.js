import { margen, indexarInsumos } from '../services/platformRecipes';

const SENIALES_DE_BARRA = [
  'barra', 'bebida', 'cerveza', 'vino', 'coctel', 'cóctel', 'trago',
  'cafe', 'café', 'infusion', 'infusión', 'jugo', 'gaseosa',
];

/**
 * Destino operativo inicial para el prototipo. Cuando Producto tenga un area
 * explicita, esta heuristica desaparece y Dico enruta por ese dato.
 */
export function destinoDeImpulso(producto = {}) {
  const texto = `${producto.category || ''} ${producto.name || ''}`.toLocaleLowerCase('es-AR');
  if (SENIALES_DE_BARRA.some(senial => texto.includes(senial))) {
    return { area: 'barra', etiqueta: 'equipo de barra' };
  }
  return { area: 'salon', etiqueta: 'camareros y recepción' };
}

function enRango(fecha, desde, hasta) {
  const t = new Date(fecha || 0).getTime();
  if (!Number.isFinite(t)) return false;
  if (desde && t < new Date(desde).getTime()) return false;
  if (hasta && t > new Date(hasta).getTime()) return false;
  return true;
}

/** Ventas por producto dentro de una ventana operativa. */
export function ventasPorProducto(orders = [], itemsPorPedido = new Map(), { desde = null, hasta = null } = {}) {
  const totales = new Map();
  for (const pedido of orders) {
    if (pedido.status !== 'completed' || !enRango(pedido.created_at, desde, hasta)) continue;
    for (const item of itemsPorPedido?.get(pedido.id) || []) {
      if (!item.product_id) continue;
      const actual = totales.get(item.product_id) || { unidades: 0, venta: 0 };
      actual.unidades += Number(item.qty) || 0;
      actual.venta += Number(item.subtotal) || ((Number(item.qty) || 0) * (Number(item.unit_price) || 0));
      totales.set(item.product_id, actual);
    }
  }
  return totales;
}

/**
 * Kasavana clasica: popularidad contra margen de contribucion unitario.
 * El umbral de popularidad es 70% de la participacion esperada; el margen
 * alto/bajo se corta por el promedio de los productos que tuvieron ventas.
 */
export function matrizKasavana({
  products = [], orders = [], itemsPorPedido = new Map(), recetas = new Map(),
  ingredientes = [], settings = null, desde = null, hasta = null,
} = {}) {
  const ventas = ventasPorProducto(orders, itemsPorPedido, { desde, hasta });
  const insumos = indexarInsumos(ingredientes);
  const filas = products.flatMap((producto) => {
    const venta = ventas.get(producto.id);
    const contribucion = margen(producto, recetas?.get(producto.id), insumos, settings)?.ganancia;
    if (!venta?.unidades || !Number.isFinite(contribucion)) return [];
    return [{ producto, ...venta, contribucion }];
  });

  const unidadesTotales = filas.reduce((s, f) => s + f.unidades, 0);
  const popularidadEsperada = filas.length ? 1 / filas.length : 0;
  const cortePopularidad = popularidadEsperada * 0.7;
  const corteMargen = filas.length
    ? filas.reduce((s, f) => s + f.contribucion, 0) / filas.length
    : 0;
  const cuadrantes = { estrellas: [], caballos: [], enigmas: [], perros: [] };

  for (const fila of filas) {
    const participacion = unidadesTotales ? fila.unidades / unidadesTotales : 0;
    const popular = participacion >= cortePopularidad;
    const rentable = fila.contribucion >= corteMargen;
    const tipo = popular && rentable ? 'estrellas'
      : popular ? 'caballos'
        : rentable ? 'enigmas'
          : 'perros';
    cuadrantes[tipo].push({ ...fila, participacion });
  }

  for (const lista of Object.values(cuadrantes)) {
    lista.sort((a, b) => b.unidades - a.unidades || b.contribucion - a.contribucion);
  }

  return {
    cuadrantes,
    productosAnalizados: filas.length,
    productosSinDatos: Math.max(0, products.length - filas.length),
    unidadesTotales,
    corteMargen,
    cortePopularidad,
  };
}

function nombresDe(filas = []) {
  const nombres = filas.slice(0, 2).map(fila => fila.producto.name);
  const restantes = Math.max(0, filas.length - nombres.length);
  return `${nombres.join(' y ')}${restantes ? ` y ${restantes} más` : ''}`;
}

/** Convierte los cuadrantes en decisiones concretas para el encargado. */
export function recomendacionesKasavana({ cuadrantes } = { cuadrantes: {} }) {
  const c = cuadrantes || {};
  return [
    c.estrellas?.length ? `Mantener ${nombresDe(c.estrellas)}: combina alta salida y margen alto.` : null,
    c.caballos?.length ? `Revisar costo o precio de ${nombresDe(c.caballos)}: vende bien, pero deja poco margen.` : null,
    c.enigmas?.length ? `Promocionar ${nombresDe(c.enigmas)}: tiene buen margen y necesita más salida.` : null,
    c.perros?.length ? `Considerar reformular o sacar ${nombresDe(c.perros)}: tiene baja salida y bajo margen.` : null,
  ].filter(Boolean);
}

function faltantesDeProducto(producto, recetas, insumos) {
  const lineas = recetas?.get(producto.id) || [];
  return lineas.flatMap((linea) => {
    const ing = insumos.get(linea.ingredient_id);
    if (!ing) return [];
    const stock = Number(ing.stock) || 0;
    const minimo = Number(ing.min_stock) || 0;
    if (stock > minimo) return [];
    return [{ ...ing, agotado: stock <= 0 }];
  });
}

/** Prioridades simples y explicables para el servicio en curso. */
export function accionesOperativas({
  products = [], orders = [], itemsPorPedido = new Map(), recetas = new Map(),
  ingredientes = [], settings = null, desde = null,
} = {}) {
  const ventas = ventasPorProducto(orders, itemsPorPedido, { desde });
  const insumos = indexarInsumos(ingredientes);
  const acciones = [];

  for (const producto of products.filter(p => p.active !== false)) {
    const vendidos = ventas.get(producto.id)?.unidades || 0;
    const stockPropio = producto.stock == null ? null : Number(producto.stock);
    const faltantes = faltantesDeProducto(producto, recetas, insumos);
    const agotados = faltantes.filter(i => i.agotado);
    const m = margen(producto, recetas?.get(producto.id), insumos, settings);

    if (stockPropio === 0 || agotados.length) {
      const nombres = agotados.map(i => i.name).slice(0, 2).join(', ');
      acciones.push({
        id: `faltante:${producto.id}`,
        tipo: 'faltante', prioridad: 3, producto,
        titulo: 'Faltante confirmado',
        detalle: nombres ? `Sin ${nombres}. Afecta la disponibilidad del producto.` : 'El producto llegó a stock cero.',
        metrica: 'Requiere decisión ahora',
      });
      continue;
    }

    if (faltantes.length) {
      acciones.push({
        id: `stock:${producto.id}`,
        tipo: 'stock', prioridad: 2, producto,
        titulo: 'Stock bajo',
        detalle: `${faltantes[0].name} está en su mínimo. Confirmá si llega al cierre.`,
        metrica: `${vendidos} vendidos en el turno`,
      });
    }

    const stockAlto = stockPropio != null && stockPropio >= 6;
    if (stockAlto && vendidos <= 1) {
      acciones.push({
        id: `impulsar:${producto.id}`,
        tipo: 'impulsar', prioridad: 1, producto,
        titulo: 'Oportunidad de rotación',
        detalle: `${stockPropio} unidades disponibles y ${vendidos} vendidas en el turno.`,
        metrica: m ? `Deja $${Math.round(m.ganancia).toLocaleString('es-AR')} por unidad` : 'Margen todavía sin calcular',
      });
    }
  }

  return acciones
    .sort((a, b) => b.prioridad - a.prioridad || a.producto.name.localeCompare(b.producto.name, 'es'))
    .slice(0, 5);
}
