import { MODULOS, modulosDe } from '../modules/registry';
import { PREGUNTAS_DOLOR } from '../../platform/functions/diagnostico/v2.js';

export function hallazgosDelDiagnostico(r) {
  const hallazgos = [];
  const opcion = PREGUNTAS_DOLOR[r.desafio]?.opciones.find(o => o.id === r.senal);
  if (opcion && r.senal !== 'no_se') {
    const textos = {
      rentabilidad: { diario: 'Ya mirás lo que te queda cada día. El siguiente paso es reunir los costos y gastos que explican ese resultado.', fin_mes: 'Conocés tu resultado al cierre del mes. Un seguimiento diario te permite revisar antes lo que está pasando.', nunca: 'Hoy no tenés un resultado claro. Empezaría por reunir ventas, compras y gastos.' },
      costos: { semanal: 'Revisás precios semanalmente. Relacionar esa revisión con tus recetas evita recalcular cada plato desde cero.', mensual: 'Revisás precios una vez al mes. Conviene contrastarlos con los cambios de costo de tus insumos.', varios_meses: 'Pasan varios meses entre revisiones de precios. Los cambios de costo pueden quedar sin reflejarse.', no_actualizo: 'No revisás precios regularmente. Empezaría por conocer el costo de lo que vendés.' },
    };
    if (textos[r.desafio]) hallazgos.push(textos[r.desafio][r.senal]);
    else if (r.desafio === 'mermas_caja') hallazgos.push(r.senal === 'sin_diferencia' ? 'No reportás diferencias habituales de caja. El arqueo te permite mantener ese control.' : `Reportás una diferencia de caja semanal: ${opcion.label.toLowerCase()}. Es una diferencia a revisar, no una pérdida ni un ahorro recuperable demostrado.`);
    else {
      const unidad = { turnos: 'turnos que se caen o no asisten por semana', stock: 'faltantes por mes', pedidos: 'pedidos perdidos o duplicados por semana', costo_laboral: 'días por semana sin saber si cubrís los sueldos' }[r.desafio];
      hallazgos.push(`Nos contaste: ${opcion.label.toLowerCase()} ${unidad}. ${r.desafio === 'turnos' ? 'Sin el ticket y los turnos recuperados no le asignamos un valor monetario.' : 'Ese es el punto de partida para revisar tu operación.'}`);
    }
  } else hallazgos.push('Todavía no tenés ese dato. El primer paso es registrarlo para poder decidir con información propia.');
  if (r.gestion_actual === 'otro_sistema') hallazgos.push(`Ya usás ${r.sistema_nombre?.trim() || 'otro sistema'}. Antes de cambiar, revisaremos qué datos se pueden importar y cómo hacer la transición.${r.sistema_costo !== '' && r.sistema_costo != null ? ` Declaraste un costo mensual de $${Number(r.sistema_costo).toLocaleString('es-AR')}; no asumimos que cambiar represente un ahorro.` : ''}`);
  else if (r.canales.length > 1) hallazgos.push(`Vendés por ${r.canales.length} canales. Conviene empezar por reunir sus operaciones en un registro común.`);
  else hallazgos.push('Tu operación tiene un canal principal declarado. Podemos empezar por ordenarlo y sumar el resto de forma gradual.');
  if (r.locales !== 'uno') hallazgos.push('Tenés varias sucursales: necesitás separar cada operación y poder compararlas.');
  else if (r.equipo !== 'hasta_5') hallazgos.push('Tu equipo tiene más de cinco personas. Ordenar funciones y registros compartidos ayuda a distribuir el trabajo.');
  return hallazgos.filter(Boolean).slice(0, 3);
}

export function herramientasDelDiagnostico(r) {
  const rubro = { gastronomia: 'gastro', comercio: 'retail', servicios: 'barber', otro: 'retail' }[r.vertical];
  const modo = r.canales.some(c => ['salon', 'mostrador'].includes(c)) ? 'hibrido' : 'virtual';
  const disponibles = new Set(modulosDe(rubro, modo).map(m => m.id));
  const pedidos = { rentabilidad: ['finanzas', 'ventas'], costos: ['products', 'stock'], costo_laboral: ['personal', 'ventas'], mermas_caja: ['caja', 'stock'], stock: ['stock', 'products'], turnos: ['agenda', 'caja'], pedidos: ['orders', 'products', 'kds'] }[r.desafio] || [];
  if (r.vertical === 'gastronomia' && r.canales.includes('salon')) pedidos.push('mesas');
  return [...new Set(pedidos)].filter(id => disponibles.has(id) && MODULOS[id]?.implementado).map(id => ({ id, nombre: MODULOS[id].label }));
}

const TITULOS_HALLAZGO = {
  rentabilidad: 'Resultados más claros', costos: 'Costos y precios', costo_laboral: 'El costo de tu equipo',
  mermas_caja: 'Diferencias que revisar', stock: 'Disponibilidad de productos', turnos: 'Tus turnos', pedidos: 'Tus pedidos',
};
const PRIMEROS_PASOS = {
  rentabilidad: 'Primero configuramos ventas, compras y gastos para reunir la información de tu negocio.',
  costos: 'Primero cargamos tus productos más vendidos y sus recetas. Después revisamos los costos de los insumos y tus precios.',
  costo_laboral: 'Primero cargamos tu equipo y organizamos los fichajes. Después revisamos el costo del personal junto a las ventas del día.',
  mermas_caja: 'Primero ordenamos los registros de cobro y el arqueo. Revisamos cada diferencia antes de sacar conclusiones.',
  stock: 'Primero cargamos tus productos o insumos y sus existencias. Después organizamos las compras y los conteos.',
  turnos: 'Primero organizamos tus servicios, profesionales y horarios. Revisamos con vos el alcance de las reservas online.',
  pedidos: 'Primero cargamos lo que vendés y organizamos los canales que usás para recibir pedidos.',
};

export function presentacionDelDiagnostico(r) {
  const varios = r.locales !== 'uno';
  const inicio = r.desafio === 'mermas_caja' && !r.canales.some(c => ['salon', 'mostrador'].includes(c))
    ? 'Primero ordenamos tus existencias y revisamos cómo registrás los cobros.'
    : PRIMEROS_PASOS[r.desafio] || PRIMEROS_PASOS.rentabilidad;
  const primerPaso = `${inicio}${varios ? ' Después ordenamos la información por sucursal.' : ''}`;
  const titulos = [
    r.senal === 'no_se' ? 'Empezar por registrar' : TITULOS_HALLAZGO[r.desafio],
    r.gestion_actual === 'otro_sistema' ? 'Ya usás otro sistema' : r.canales.length > 1 ? 'Vendés por varios canales' : 'Tu canal principal',
    varios ? 'Tenés varias sucursales' : 'Tu equipo de trabajo',
  ];
  return { primerPaso, hallazgos: hallazgosDelDiagnostico(r).map((texto, i) => ({ titulo: titulos[i], texto, icono: i === 0 ? r.desafio : i === 1 && r.gestion_actual === 'otro_sistema' ? 'sistema' : i === 2 && varios ? 'locales' : 'equipo' })) };
}

export function motivoDelPlan(r) {
  if (r.locales !== 'uno') return 'Porque necesitás separar cada sucursal y comparar su operación con una mirada conjunta.';
  if (r.gestion_actual === 'otro_sistema') return 'Para acompañar la operación de tu local y revisar con vos el cambio desde tu sistema actual.';
  if (r.equipo !== 'hasta_5') return 'Por el tamaño de tu equipo: este plan suma soporte para organizar la operación de un local.';
  return 'Declaraste un local y un equipo de hasta cinco personas. Podemos empezar por la base de Dico y evaluar cómo seguir.';
}
