/**
 * AgendaDia — los turnos de un dia.
 *
 * En el celular (donde la usa la duenia) es una lista cronologica: hora,
 * clienta, servicio y quien atiende. En escritorio es una grilla de tiempo con
 * una columna por profesional, para ver de un vistazo quien esta libre.
 * Un turno nunca se oculta: si cae fuera del horario, la grilla se estira.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  etiquetaDelDia, weekdayDe, inicioDelDia, ventanaDelDia, posicionDeTurno,
  tramosDelDia, aMinutos, hhmm, deMinutos, ocupaLugar, ESTADOS,
} from '../../../modules/agenda';
import { EstadoChip, Punto } from './AgendaHoja';

const PX_POR_MIN = 64 / 60;

/** matchMedia no existe en todos los entornos (tests): sin el, vista de lista. */
function useEscritorio() {
  const consulta = '(min-width: 900px)';
  const [si, setSi] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(consulta);
    const f = () => setSi(mq.matches);
    f();
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);
  return si;
}

const nombreServicio = (base, id) => base.servicios.find(s => s.id === id)?.name || 'Sin servicio';
const nombreStaff = (base, id) => base.staff.find(s => s.id === id);
const rango = (t) => `${hhmm(t.starts_at)}–${hhmm(t.ends_at)}`;

function TarjetaTurno({ turno, base, onAbrir }) {
  const staff = nombreStaff(base, turno.staff_id);
  const domicilio = turno.location_kind === 'home';
  return (
    <li>
      <button type="button" className="ag-agd-turno" data-estado={turno.status} onClick={() => onAbrir(turno.id)}>
        <span className="ag-agd-turno-hora">
          <strong>{hhmm(turno.starts_at)}</strong>
          <span>hasta {hhmm(turno.ends_at)}</span>
        </span>
        <span className="ag-agd-turno-cuerpo">
          <span className="ag-agd-turno-cliente">{turno.customer_name || 'Sin nombre'}</span>
          <span className="ag-agd-turno-linea">
            <span>{nombreServicio(base, turno.service_id)}</span>
            {staff && <span><Punto color={staff.color} />{staff.name}</span>}
            <span className="ag-agd-modo">{domicilio ? 'A domicilio' : 'Local'}</span>
          </span>
          {domicilio && turno.address && <span className="ag-agd-dir">{turno.address}</span>}
          <span><EstadoChip status={turno.status} /></span>
        </span>
      </button>
    </li>
  );
}

/** Tramos [desde, hasta] en minutos del dia que quedan fuera del horario. */
function fueraDeHorario(tramos, inicio, fin) {
  const huecos = [];
  let cursor = inicio;
  for (const [a, b] of tramos) {
    if (a > cursor) huecos.push([cursor, Math.min(a, fin)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < fin) huecos.push([cursor, fin]);
  return huecos.filter(([a, b]) => b > a);
}

function Grilla({ base, dia, turnos, columnas, onAbrir }) {
  const wd = weekdayDe(dia);
  const { inicio, fin } = ventanaDelDia(base.horarios, turnos, wd);
  const alto = (fin - inicio) * PX_POR_MIN;
  const ini = inicioDelDia(dia).getTime();
  const horas = [];
  for (let m = inicio; m <= fin; m += 60) horas.push(m);
  const dibujables = turnos.filter(ocupaLugar);

  const ausenciasDe = (staffId) => base.ausencias
    .filter(a => a.staff_id == null || a.staff_id === staffId)
    .map(a => {
      const desde = Math.max(new Date(a.starts_at).getTime(), ini);
      const hasta = Math.min(new Date(a.ends_at).getTime(), ini + 24 * 3600000);
      return { a, desde: (desde - ini) / 60000, hasta: (hasta - ini) / 60000 };
    })
    .filter(x => x.hasta > x.desde)
    .map(x => ({ ...x, desde: Math.max(x.desde, inicio), hasta: Math.min(x.hasta, fin) }))
    .filter(x => x.hasta > x.desde);

  return (
    <div className="ag-agd-grilla-caja">
      <div
        className="ag-agd-grilla"
        style={{ '--cols': columnas.length, '--alto': `${alto}px`, '--hora-px': `${60 * PX_POR_MIN}px` }}
      >
        <div className="ag-agd-g-cab"><span className="ag-agd-g-nota">Hora</span></div>
        {columnas.map(c => (
          <div key={c.id} className="ag-agd-g-cab">
            {c.color && <Punto color={c.color} />}{c.name}
          </div>
        ))}
        <div className="ag-agd-g-horas" aria-hidden="true">
          {horas.map(m => (
            <span key={m} className="ag-agd-g-hora" style={{ '--t': `${(m - inicio) * PX_POR_MIN}px` }}>
              {deMinutos(m % 1440)}
            </span>
          ))}
        </div>
        {columnas.map(c => {
          const tramos = c.sinAsignar ? [] : tramosDelDia(base.horarios.filter(h => h.staff_id === c.id), wd)
            .map(t => [aMinutos(t.start_time), aMinutos(t.end_time)]);
          const fuera = c.sinAsignar ? [] : tramos.length
            ? fueraDeHorario(tramos, inicio, fin)
            : [[inicio, fin]];
          return (
            <div key={c.id} className="ag-agd-g-col">
              {fuera.map(([a, b]) => (
                <div key={a} className="ag-agd-g-fuera"
                  style={{ '--t': `${(a - inicio) * PX_POR_MIN}px`, '--h': `${(b - a) * PX_POR_MIN}px` }}>
                  {tramos.length ? '' : 'No trabaja este día'}
                </div>
              ))}
              {!c.sinAsignar && ausenciasDe(c.id).map(({ a, desde, hasta }) => (
                <div key={a.id} className="ag-agd-g-aus"
                  style={{ '--t': `${(desde - inicio) * PX_POR_MIN}px`, '--h': `${(hasta - desde) * PX_POR_MIN}px` }}>
                  Ausencia{a.reason ? `: ${a.reason}` : ''}
                </div>
              ))}
              {dibujables.filter(t => (c.sinAsignar ? !nombreStaff(base, t.staff_id) : t.staff_id === c.id)).map(t => {
                const p = posicionDeTurno(t, inicio, PX_POR_MIN);
                return (
                  <button key={t.id} type="button" className="ag-agd-bloque"
                    style={{ '--t': `${p.top}px`, '--h': `${p.alto}px` }}
                    title={`${rango(t)} · ${t.customer_name || 'Sin nombre'} · ${nombreServicio(base, t.service_id)} · ${ESTADOS[t.status]?.label || t.status}`}
                    aria-label={`${rango(t)}, ${t.customer_name || 'Sin nombre'}, ${nombreServicio(base, t.service_id)}, ${ESTADOS[t.status]?.label || t.status}`}
                    onClick={() => onAbrir(t.id)}>
                    <strong>{hhmm(t.starts_at)} {t.customer_name || 'Sin nombre'}</strong>
                    <span>{nombreServicio(base, t.service_id)} · {t.location_kind === 'home' ? 'A domicilio' : 'Local'}</span>
                    <span className="ag-agd-b-estado" data-estado={t.status}>
                      {t.status === 'done' ? '✓ ' : t.status === 'no_show' ? '✕ ' : ''}{ESTADOS[t.status]?.label || t.status}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AgendaDia({
  base, dia, onDia, hoy, turnos, cargando, errorTurnos, onReintentar,
  staffVisibles, filtro, onFiltro, acceso, puedeCrear, pendientes,
  onAbrir, onNuevo, onIrConfig,
}) {
  const escritorio = useEscritorio();
  const propio = acceso === 'propio';

  const columnas = useMemo(() => {
    const cols = staffVisibles.map(s => ({ id: s.id, name: s.name, color: s.color }));
    const huerfanos = turnos.some(t => !nombreStaff(base, t.staff_id));
    if (huerfanos && !propio) cols.push({ id: 'sin', name: 'Sin asignar', sinAsignar: true });
    return cols;
  }, [staffVisibles, turnos, base, propio]);

  const cancelados = turnos.filter(t => !ocupaLugar(t));
  const [verCancelados, setVerCancelados] = useState(false);

  return (
    <>
      <section className="ag-agd-dia" aria-label="Día de la agenda">
        <div className="ag-agd-dia-fila">
          <button type="button" className="ag-agd-btn" onClick={() => onDia(-1)} aria-label="Día anterior">
            <span aria-hidden="true">{'‹'}</span>
          </button>
          <h2 aria-live="polite">{etiquetaDelDia(dia)}</h2>
          <button type="button" className="ag-agd-btn" onClick={() => onDia(1)} aria-label="Día siguiente">
            <span aria-hidden="true">{'›'}</span>
          </button>
        </div>
        <div className="ag-agd-dia-acciones">
          <button type="button" className="ag-agd-btn" onClick={() => onDia(0)} aria-pressed={dia === hoy}>Hoy</button>
          <input type="date" className="ag-agd-input" aria-label="Elegir fecha" value={dia}
            onChange={(e) => e.target.value && onDia(e.target.value)} />
          {puedeCrear && (
            <button type="button" className="ag-agd-btn" data-primario="true" onClick={onNuevo}>Nuevo turno</button>
          )}
        </div>
        {!propio && base.staff.length > 1 && (
          <div className="ag-agd-filtro" role="group" aria-label="Filtrar por profesional">
            <button type="button" aria-pressed={!filtro} onClick={() => onFiltro(null)}>{!filtro && <span aria-hidden="true">{'✓'}</span>}Todas</button>
            {base.staff.map(s => (
              <button key={s.id} type="button" aria-pressed={filtro === s.id} onClick={() => onFiltro(s.id)}>
                {filtro === s.id && <span aria-hidden="true">{'✓'}</span>}<Punto color={s.color} />{s.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {pendientes.length > 0 && (
        <section className="ag-agd-pendientes" aria-label="Falta configurar">
          <h3>Todavía no hay horarios para ofrecer</h3>
          <p className="ag-agd-ayuda">La agenda necesita estos datos para calcular cuándo hay lugar:</p>
          <ul>{pendientes.map(p => <li key={p.id}>{p.texto}</li>)}</ul>
          {acceso === 'completo'
            ? <button type="button" className="ag-agd-btn" data-primario="true" onClick={onIrConfig}>Completar en Horarios y reglas</button>
            : <p className="ag-agd-ayuda">Lo tiene que completar quien administra el negocio. Avisale para que aparezcan horarios.</p>}
        </section>
      )}

      {cargando ? (
        <p className="ag-agd-cargando" role="status">Cargando turnos...</p>
      ) : errorTurnos ? (
        <div className="ag-agd-vacio" role="alert">
          <h3>No pudimos cargar los turnos</h3>
          <p>{errorTurnos} Revisá la conexión y probá de nuevo.</p>
          <button type="button" className="ag-agd-btn" onClick={onReintentar}>Reintentar</button>
        </div>
      ) : turnos.length === 0 ? (
        <div className="ag-agd-vacio">
          <h3>No hay turnos este día</h3>
          <p>{puedeCrear ? 'Podés cargar uno ahora.' : 'Cuando se cargue un turno va a aparecer acá.'}</p>
          {puedeCrear && <button type="button" className="ag-agd-btn" data-primario="true" onClick={onNuevo}>Nuevo turno</button>}
        </div>
      ) : escritorio ? (
        <>
          <Grilla base={base} dia={dia} turnos={turnos} columnas={columnas} onAbrir={onAbrir} />
          {cancelados.length > 0 && (
            <div className="ag-agd-sub">
              <p className="ag-agd-g-nota">{cancelados.length} turno(s) cancelado(s) no se dibujan en la grilla.</p>
              <button type="button" className="ag-agd-btn" data-chico="true" aria-expanded={verCancelados}
                onClick={() => setVerCancelados(v => !v)}>
                {verCancelados ? 'Ocultar cancelados' : 'Ver cancelados'}
              </button>
              {verCancelados && (
                <ul className="ag-agd-lista" aria-label="Turnos cancelados del día">
                  {cancelados.map(t => <TarjetaTurno key={t.id} turno={t} base={base} onAbrir={onAbrir} />)}
                </ul>
              )}
            </div>
          )}
        </>
      ) : (
        <ul className="ag-agd-lista" aria-label="Turnos del día">
          {turnos.map(t => <TarjetaTurno key={t.id} turno={t} base={base} onAbrir={onAbrir} />)}
        </ul>
      )}
    </>
  );
}
