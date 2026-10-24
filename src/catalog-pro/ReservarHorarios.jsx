// src/catalog-pro/ReservarHorarios.jsx
// Tira de dias + botones de horario de la reserva online. Es presentacional:
// quien pide los horarios al servidor es Reservar.jsx.
//
// Dias y horas son del negocio. Cada dia es un radio nativo (flechas del
// teclado, lector de pantalla); los dias sin lugar quedan deshabilitados Y
// dicen "sin lugar": el estado nunca depende solo del color.

import { useEffect, useRef } from 'react';
import Icon from './Icon';
import { etiquetaCorta, etiquetaLarga } from './reservarHelpers';

export default function ReservarHorarios({
  dias, dia, onDia, horarios, slotElegido, onSlot,
  estado, mensajeError, onReintentar,
  hayMasDias, cargandoMas, onMas,
  proximoDia, onProximo, notaZona,
}) {
  const tira = useRef(null);
  const cargando = estado === 'cargando';

  // El dia marcado queda a la vista dentro de la tira (sin mover la pagina).
  useEffect(() => {
    try {
      tira.current?.querySelector('input:checked')?.closest('label')
        ?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    } catch { /* sin scroll */ }
  }, [dia]);
  const diaSinLugar = dia && !cargando && horarios.length === 0;
  const nadaCargado = !cargando && estado !== 'error' && dias.every(d => d.estado === 'sin');

  return (
    <div>
      {estado === 'error' ? (
        <div className="rv-note rv-note--err" role="alert">
          <Icon name="x" size={18} />
          <div>
            <p>{mensajeError || 'No pudimos traer los horarios.'}</p>
            <button type="button" className="rv-link" onClick={onReintentar}>Probar de nuevo</button>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="rv-days cp-no-scrollbar" ref={tira}>
            <legend className="rv-vh">Elegí un día</legend>
            {dias.map(d => {
              const c = etiquetaCorta(d.dia);
              const sinLugar = d.estado === 'sin';
              const esperando = d.estado === 'cargando';
              return (
                <label key={d.dia} className="rv-day">
                  <input
                    type="radio" name="rv-dia" value={d.dia}
                    checked={dia === d.dia}
                    disabled={sinLugar || esperando}
                    onChange={() => onDia(d.dia)}
                    aria-label={`${etiquetaLarga(d.dia)}${sinLugar ? ', sin lugar' : ''}`}
                  />
                  <span className="rv-day-sem" aria-hidden="true">{c.semana}</span>
                  <span className="rv-day-num" aria-hidden="true">{c.numero}</span>
                  <span className="rv-day-mes" aria-hidden="true">{c.mes}</span>
                  {(sinLugar || esperando) && (
                    <span className="rv-day-estado" aria-hidden="true">{sinLugar ? 'sin lugar' : '…'}</span>
                  )}
                </label>
              );
            })}
            {hayMasDias && (
              <button type="button" className="rv-more" onClick={onMas} disabled={cargandoMas}>
                {cargandoMas ? 'Buscando…' : 'Ver más días'}
              </button>
            )}
          </fieldset>

          {notaZona && <p className="rv-hint">{notaZona}</p>}

          <p className="rv-vh" role="status">
            {cargando ? 'Buscando horarios…' : (dia && horarios.length > 0 ? `${horarios.length} ${horarios.length === 1 ? 'horario disponible' : 'horarios disponibles'}` : '')}
          </p>

          <div>
            {cargando && (
              <div className="rv-times" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="rv-skel" />)}
              </div>
            )}

            {!cargando && dia && horarios.length > 0 && (
              <>
                <p className="rv-times-title">Horarios del {etiquetaLarga(dia)}</p>
                <fieldset className="rv-times">
                  <legend className="rv-vh">Horarios disponibles</legend>
                  {horarios.map(h => (
                    <label key={h.hora} className="rv-chip">
                      <input
                        type="radio" name="rv-hora" value={h.hora}
                        checked={slotElegido === h.opciones[0].starts_at}
                        onChange={() => onSlot(h.opciones[0], h.hora)}
                        aria-label={`${h.hora} horas`}
                      />
                      <span aria-hidden="true">{h.hora}</span>
                    </label>
                  ))}
                </fieldset>
              </>
            )}

            {diaSinLugar && (
              <div className="rv-note">
                <Icon name="clock" size={18} />
                <div>
                  <p>Ya no quedan horarios el {etiquetaLarga(dia)}.</p>
                  {proximoDia ? (
                    <button type="button" className="rv-link" onClick={onProximo}>
                      Ver el próximo día con lugar: {etiquetaLarga(proximoDia)}
                    </button>
                  ) : hayMasDias ? (
                    <button type="button" className="rv-link" onClick={onMas}>Buscar en más días</button>
                  ) : null}
                </div>
              </div>
            )}

            {nadaCargado && !dia && (
              <div className="rv-note">
                <Icon name="clock" size={18} />
                <div>
                  <p>No hay horarios en estos días.</p>
                  {hayMasDias && <button type="button" className="rv-link" onClick={onMas}>Buscar en más días</button>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
