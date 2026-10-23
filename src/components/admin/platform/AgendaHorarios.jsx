/**
 * BuscaHorarios — dia + botones con los huecos libres de un servicio.
 *
 * Lo usan "Nuevo turno" y "Mover". Pide UN dia a la base; si ese dia no tiene
 * lugar, busca hasta 14 dias adelante y ofrece el primero con hueco, para que
 * nadie tenga que ir probando fechas a ciegas.
 *
 * Los huecos vienen de get_available_slots; la garantia final contra el doble
 * turno sigue siendo el EXCLUDE de la base, y quien reserva muestra su error.
 */
import { useEffect, useState } from 'react';
import { fetchSlots } from '../../../services/platformAgenda';
import { agruparPorHora, diaLocal, etiquetaDelDia, sumarDias } from '../../../modules/agenda';

const DIAS_DE_BUSQUEDA = 14;

export default function BuscaHorarios({
  tenantId, serviceId, staffId = null, locationKind = 'local', travelMin = null,
  dia, onDia, elegido, onElegir, version = 0,
}) {
  const clave = [tenantId, serviceId, staffId, locationKind, travelMin, dia, version].join('|');
  const [estado, setEstado] = useState({ clave: null, error: '', grupos: [], proximo: null });
  const cargando = estado.clave !== clave;

  useEffect(() => {
    if (!serviceId) return undefined;
    let vigente = true;
    (async () => {
      const r = await fetchSlots(tenantId, serviceId, dia, dia, { staffId, locationKind, travelMin });
      if (!vigente) return;
      if (r.__error) { setEstado({ clave, error: r.message || 'No pudimos calcular los horarios.', grupos: [], proximo: null }); return; }
      const grupos = agruparPorHora(r.slots);
      if (grupos.length) { setEstado({ clave, error: '', grupos, proximo: null }); return; }
      const sig = await fetchSlots(tenantId, serviceId, sumarDias(dia, 1), sumarDias(dia, DIAS_DE_BUSQUEDA), { staffId, locationKind, travelMin });
      if (!vigente) return;
      const primero = sig.slots?.[0];
      setEstado({ clave, error: sig.__error ? sig.message : '', grupos: [], proximo: primero ? diaLocal(primero.starts_at) : null });
    })();
    return () => { vigente = false; };
  }, [clave, tenantId, serviceId, staffId, locationKind, travelMin, dia]);

  return (
    <div className="ag-agd-sub">
      <div className="ag-agd-campo">
        <label htmlFor="ag-agd-busca-dia">Día</label>
        <input id="ag-agd-busca-dia" type="date" className="ag-agd-input" value={dia}
          min={diaLocal()} onChange={(e) => e.target.value && onDia(e.target.value)} />
      </div>

      {!serviceId && <p className="ag-agd-ayuda">Elegí un servicio para ver los horarios.</p>}
      {serviceId && cargando && <p className="ag-agd-ayuda" role="status">Buscando horarios...</p>}
      {!cargando && estado.error && <div className="ag-agd-aviso" data-tipo="error" role="alert"><span>{estado.error}</span></div>}

      {serviceId && !cargando && !estado.error && estado.grupos.length > 0 && (
        <div className="ag-agd-horas" role="group" aria-label={`Horarios libres del ${etiquetaDelDia(dia)}`}>
          {estado.grupos.map(g => (
            <button key={g.hora} type="button" className="ag-agd-hora" aria-pressed={elegido === g.hora}
              onClick={() => onElegir(g)}>
              {g.hora}
            </button>
          ))}
        </div>
      )}

      {serviceId && !cargando && !estado.error && estado.grupos.length === 0 && (
        <div className="ag-agd-aviso" role="status">
          <span>
            <strong>No hay horarios este día.</strong>{' '}
            {estado.proximo
              ? `El próximo con lugar es el ${etiquetaDelDia(estado.proximo)}.`
              : `Tampoco hay lugar en los próximos ${DIAS_DE_BUSQUEDA} días. Revisá los horarios de trabajo y las ausencias.`}
          </span>
        </div>
      )}
      {!cargando && estado.proximo && (
        <button type="button" className="ag-agd-btn" onClick={() => onDia(estado.proximo)}>
          Ver el {etiquetaDelDia(estado.proximo)}
        </button>
      )}
    </div>
  );
}
