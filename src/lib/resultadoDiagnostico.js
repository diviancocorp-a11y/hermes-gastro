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
