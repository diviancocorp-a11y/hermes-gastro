const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_CON_TILDE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function partesLocales(fecha, timezone) {
  const opciones = {
    timeZone: timezone || undefined,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  const partes = new Intl.DateTimeFormat('en-US', opciones).formatToParts(fecha);
  const valor = (tipo) => partes.find(p => p.type === tipo)?.value;
  const diaIngles = valor('weekday')?.toLowerCase();
  const indiceJs = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(diaIngles);
  return {
    indiceJs: indiceJs >= 0 ? indiceJs : fecha.getDay(),
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
  };
}

function horarioDelDia(horarios, indiceJs) {
  const indiceLunes = (indiceJs + 6) % 7;
  const dia = horarios?.[indiceLunes]
    ?? horarios?.[DIAS[indiceJs]]
    ?? horarios?.[DIAS_CON_TILDE[indiceJs]];
  if (!dia) return null;

  // El edificio nacio con {open:true, from, to}; el editor compartido usa
  // {open:"09:00", close:"23:00", closed:false}. Se leen los dos hasta que
  // los datos historicos hayan pasado por el editor.
  if (typeof dia.open === 'boolean') {
    return {
      cerrado: !dia.open,
      desde: dia.from || null,
      hasta: dia.to || null,
      h24: dia.open && (!dia.from || !dia.to),
    };
  }
  return {
    cerrado: !!dia.closed,
    desde: dia.open || null,
    hasta: dia.close || null,
    h24: !!dia.h24,
  };
}

function aMinutos(valor) {
  if (!/^\d{1,2}:\d{2}$/.test(valor || '')) return null;
  const [hora, minuto] = valor.split(':').map(Number);
  if (hora > 23 || minuto > 59) return null;
  return hora * 60 + minuto;
}

function intervalosSemanales(horarios) {
  const base = [];
  for (let dia = 0; dia < 7; dia += 1) {
    const horario = horarioDelDia(horarios, dia);
    if (!horario || horario.cerrado) continue;
    const desde = aMinutos(horario.desde);
    const hasta = aMinutos(horario.hasta);
    const inicio = dia * 1440 + (desde ?? 0);
    let fin = dia * 1440 + (hasta ?? 1440);
    if (horario.h24 || desde == null || hasta == null || desde === hasta) fin = inicio + 1440;
    else if (hasta < desde) fin += 1440;
    base.push({ inicio, fin, desde: horario.desde || '00:00', hasta: horario.hasta || '24:00' });
  }
  const semana = 7 * 1440;
  return [-semana, 0, semana].flatMap(desplazamiento => base.map(intervalo => ({
    ...intervalo,
    inicio: intervalo.inicio + desplazamiento,
    fin: intervalo.fin + desplazamiento,
  })));
}

function limitar(valor, minimo = 0, maximo = 1) {
  return Math.min(maximo, Math.max(minimo, valor));
}

export function duracionCorta(minutos) {
  const total = Math.max(0, Math.round(Number(minutos) || 0));
  const dias = Math.floor(total / 1440);
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (dias) {
    const horasRestantes = Math.floor((total % 1440) / 60);
    return horasRestantes ? `${dias} d ${horasRestantes} h` : `${dias} d`;
  }
  if (!horas) return `${resto} m`;
  if (!resto) return `${horas} h`;
  return `${horas} h ${resto} m`;
}

function abreEn(horario, minutos, desdeDiaAnterior = false) {
  if (!horario || horario.cerrado) return false;
  if (horario.h24) return !desdeDiaAnterior;
  const desde = aMinutos(horario.desde);
  const hasta = aMinutos(horario.hasta);
  if (desde == null || hasta == null) return false;
  if (desde === hasta) return true;
  if (desde < hasta) return !desdeDiaAnterior && minutos >= desde && minutos < hasta;
  return desdeDiaAnterior ? minutos < hasta : minutos >= desde;
}

/**
 * Estado que comunica la topbar. `store_open=false` es el cierre manual y
 * manda sobre el horario. Sin una grilla configurada el local queda operativo,
 * que es el mismo contrato historico del catalogo.
 */
export function estaOperativo(settings, fecha = new Date(), timezone) {
  if (settings?.store_open === false) return false;
  const horarios = settings?.store_hours;
  if (!horarios || Object.keys(horarios).length === 0) return true;

  const { indiceJs, minutos } = partesLocales(fecha, timezone);
  const hoy = horarioDelDia(horarios, indiceJs);
  const ayer = horarioDelDia(horarios, (indiceJs + 6) % 7);
  return abreEn(hoy, minutos) || abreEn(ayer, minutos, true);
}

/**
 * Describe el tramo que explica el estado. La barra siempre avanza hacia el
 * proximo cambio: el cierre mientras opera y la apertura mientras descansa.
 */
export function ventanaOperativa(settings, fecha = new Date(), timezone) {
  const operativo = estaOperativo(settings, fecha, timezone);
  if (settings?.store_open === false) {
    return {
      operativo: false,
      etiqueta: 'Cierre manual',
      valor: 'Horario pausado',
      detalle: 'Reabrí el local desde Configuración',
      progreso: 0,
      horaObjetivo: null,
      minutosRestantes: null,
      minutosTranscurridos: null,
    };
  }

  const horarios = settings?.store_hours;
  if (!horarios || Object.keys(horarios).length === 0) {
    const { minutos } = partesLocales(fecha, timezone);
    return {
      operativo: true,
      etiqueta: 'Ventana operativa',
      valor: 'Sin límite horario',
      detalle: 'El local figura abierto todo el día',
      progreso: 1,
      horaObjetivo: null,
      minutosRestantes: null,
      minutosTranscurridos: minutos,
    };
  }

  const { indiceJs, minutos } = partesLocales(fecha, timezone);
  const actual = indiceJs * 1440 + minutos;
  const intervalos = intervalosSemanales(horarios);
  const activo = intervalos.find(i => actual >= i.inicio && actual < i.fin);
  if (operativo && activo) {
    const transcurrido = actual - activo.inicio;
    const duracion = activo.fin - activo.inicio;
    return {
      operativo: true,
      etiqueta: 'Ventana operativa',
      valor: `${activo.desde} — ${activo.hasta}`,
      detalle: `Cierra en ${duracionCorta(activo.fin - actual)}`,
      progreso: limitar(transcurrido / duracion),
      horaObjetivo: activo.hasta,
      minutosRestantes: activo.fin - actual,
      minutosTranscurridos: transcurrido,
    };
  }

  const anterior = intervalos.filter(i => i.fin <= actual).sort((a, b) => b.fin - a.fin)[0];
  const siguiente = intervalos.filter(i => i.inicio > actual).sort((a, b) => a.inicio - b.inicio)[0];
  if (!siguiente) {
    return {
      operativo: false,
      etiqueta: 'Sistema en reposo',
      valor: 'Sin próxima apertura',
      detalle: 'Revisá el horario del local',
      progreso: 0,
      horaObjetivo: null,
      minutosRestantes: null,
      minutosTranscurridos: null,
    };
  }

  const faltan = siguiente.inicio - actual;
  const descanso = siguiente.inicio - (anterior?.fin ?? actual);
  const diferenciaDias = Math.floor(siguiente.inicio / 1440) - indiceJs;
  const dia = diferenciaDias === 0 ? 'Hoy'
    : diferenciaDias === 1 ? 'Mañana'
      : DIAS[(indiceJs + diferenciaDias) % 7].replace(/^./, letra => letra.toUpperCase());
  return {
    operativo: false,
    etiqueta: 'Próxima apertura',
    valor: `${dia} · ${siguiente.desde}`,
    detalle: `Abre en ${duracionCorta(faltan)}`,
    progreso: limitar(1 - (faltan / Math.max(descanso, 1))),
    horaObjetivo: siguiente.desde,
    minutosRestantes: faltan,
    minutosTranscurridos: null,
    diaObjetivo: dia,
  };
}

export function horaDelLocal(fecha = new Date(), timezone) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone || undefined,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(fecha);
}

export function horaCortaDelLocal(fecha = new Date(), timezone) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone || undefined,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(fecha);
}
