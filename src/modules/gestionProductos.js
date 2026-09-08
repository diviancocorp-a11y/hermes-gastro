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
  const productosActivos = products.filter(producto => producto.active !== false);
  const filas = productosActivos.flatMap((producto) => {
    const venta = ventas.get(producto.id);
    const contribucion = margen(producto, recetas?.get(producto.id), insumos, settings)?.ganancia;
    if (!venta?.unidades || !Number.isFinite(contribucion)) return [];
    const categoria = String(producto.category || 'Sin categoría').trim() || 'Sin categoría';
    return [{ producto, ...venta, contribucion, categoria }];
  });

  const unidadesTotales = filas.reduce((s, f) => s + f.unidades, 0);
  const corteMargen = unidadesTotales
    ? filas.reduce((s, f) => s + (f.contribucion * f.unidades), 0) / unidadesTotales
    : 0;
  const cortePopularidad = filas.length ? (1 / filas.length) * 0.7 : 0;
  const cuadrantes = { estrellas: [], caballos: [], enigmas: [], perros: [] };

  const porCategoria = new Map();
  for (const fila of filas) {
    const clave = fila.categoria.toLocaleLowerCase('es-AR');
    porCategoria.set(clave, [...(porCategoria.get(clave) || []), fila]);
  }

  for (const filasCategoria of porCategoria.values()) {
    const unidadesCategoria = filasCategoria.reduce((s, f) => s + f.unidades, 0);
    const cortePopularidadCategoria = filasCategoria.length ? (1 / filasCategoria.length) * 0.7 : 0;
    const corteMargenCategoria = unidadesCategoria
      ? filasCategoria.reduce((s, f) => s + (f.contribucion * f.unidades), 0) / unidadesCategoria
      : 0;

    for (const fila of filasCategoria) {
      const participacion = unidadesCategoria ? fila.unidades / unidadesCategoria : 0;
      const popular = participacion >= cortePopularidadCategoria;
      const rentable = fila.contribucion >= corteMargenCategoria;
      const tipo = popular && rentable ? 'estrellas'
        : popular ? 'caballos'
          : rentable ? 'enigmas'
            : 'perros';
      cuadrantes[tipo].push({
        ...fila,
        participacion,
        corteMargen: corteMargenCategoria,
        cortePopularidad: cortePopularidadCategoria,
        unidadesCategoria,
      });
    }
  }

  for (const lista of Object.values(cuadrantes)) {
    lista.sort((a, b) => (
      (b.unidades * b.contribucion) - (a.unidades * a.contribucion)
      || b.participacion - a.participacion
      || b.contribucion - a.contribucion
      || a.producto.name.localeCompare(b.producto.name, 'es')
    ));
  }

  return {
    cuadrantes,
    productosAnalizados: filas.length,
    productosSinDatos: Math.max(0, productosActivos.length - filas.length),
    productosOcultos: Math.max(0, products.length - productosActivos.length),
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

export function recomendacionProductoKasavana(tipo, fila, { corteMargen = 0, cortePopularidad = 0 } = {}) {
  if (!fila?.producto) return null;
  const nombre = fila.producto.name;
  const participacion = Number(fila.participacion) || 0;
  const contribucion = Number(fila.contribucion) || 0;
  const margenReferencia = Number.isFinite(fila.corteMargen) ? fila.corteMargen : corteMargen;
  const popularidadReferencia = Number.isFinite(fila.cortePopularidad)
    ? fila.cortePopularidad
    : cortePopularidad;
  const diferenciaMargen = Math.round(Math.abs(contribucion - margenReferencia));
  const diferenciaPopularidad = Math.max(0, popularidadReferencia - participacion);
  const unidadesCategoria = fila.unidadesCategoria || (participacion > 0 ? fila.unidades / participacion : 0);
  const unidadesObjetivo = Math.max(1, Math.ceil(diferenciaPopularidad * unidadesCategoria));

  if (tipo === 'estrella') {
    return `Mantener ${nombre} visible y disponible: combina alta salida con un margen de ${Math.round(contribucion).toLocaleString('es-AR')} pesos por unidad.`;
  }
  if (tipo === 'caballo') {
    return `Revisar costo, porción o precio de ${nombre}: vende bien, pero necesita recuperar cerca de ${diferenciaMargen.toLocaleString('es-AR')} pesos de margen por unidad.`;
  }
  if (tipo === 'enigma') {
    return `Promocionar ${nombre}: su margen es alto y necesita aproximadamente ${unidadesObjetivo} unidades adicionales en la ventana para alcanzar popularidad de Estrella.`;
  }
  return `Considerar reformular o sacar ${nombre}: está por debajo del nivel de popularidad y deja cerca de ${diferenciaMargen.toLocaleString('es-AR')} pesos menos que el margen de referencia.`;
}

/**
 * Indica el limite mas cercano; no afirma una tendencia historica. Esa flecha
 * solo podra llamarse subida o bajada cuando existan snapshots comparables.
 */
export function proximidadKasavana(tipo, fila = {}) {
  const popularidad = Number(fila.participacion) || 0;
  const margenUnitario = Number(fila.contribucion) || 0;
  const cortePopularidad = Number(fila.cortePopularidad) || 0;
  const corteMargen = Number(fila.corteMargen) || 0;
  const proporcionPopularidad = cortePopularidad > 0 ? popularidad / cortePopularidad : 1;
  const proporcionMargen = corteMargen > 0 ? margenUnitario / corteMargen : 1;

  if (tipo === 'estrella') {
    return proporcionMargen - 1 <= proporcionPopularidad - 1
      ? { direccion: 'baja', destino: 'Caballo', motivo: 'el margen es el límite más cercano' }
      : { direccion: 'baja', destino: 'Enigma', motivo: 'la popularidad es el límite más cercano' };
  }
  if (tipo === 'caballo') {
    return 1 - proporcionMargen <= proporcionPopularidad - 1
      ? { direccion: 'sube', destino: 'Estrella', motivo: 'el margen está cerca de la referencia' }
      : { direccion: 'baja', destino: 'Perro', motivo: 'la popularidad está cerca del límite inferior' };
  }
  if (tipo === 'enigma') {
    return 1 - proporcionPopularidad <= proporcionMargen - 1
      ? { direccion: 'sube', destino: 'Estrella', motivo: 'la popularidad está cerca de la referencia' }
      : { direccion: 'baja', destino: 'Perro', motivo: 'el margen está cerca del límite inferior' };
  }
  return 1 - proporcionMargen <= 1 - proporcionPopularidad
    ? { direccion: 'sube', destino: 'Enigma', motivo: 'el margen es la fortaleza más cercana' }
    : { direccion: 'sube', destino: 'Caballo', motivo: 'la popularidad es la fortaleza más cercana' };
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
