/**
 * Reglas de reserva: cuanto antes se puede reservar, hasta cuando, cada cuanto
 * hay horarios, donde se atiende, la seña y la retencion del hueco.
 * La seña solo guarda la regla: el cobro online llega en una fase posterior.
 */
import { useState } from 'react';
import { saveBookingSettings } from '../../../services/platformAgenda';
import { PieGuardar } from './AgendaHoja';

const PASOS = [5, 10, 15, 20, 30, 45, 60];

const pesos = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function Numero({ id, rotulo, valor, onCambio, unidad, ayuda, min = 0, invalido, vista }) {
  return (
    <div className="ag-agd-campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} className="ag-agd-input" type="number" inputMode="numeric" min={min} step={1}
        value={valor ?? ''} onChange={(e) => onCambio(e.target.value)} aria-describedby={`${id}-a`}
        aria-invalid={invalido ? true : undefined} />
      <span id={`${id}-a`} className="ag-agd-ayuda">{[unidad, ayuda].filter(Boolean).join('. ')}</span>
      {vista && <span className="ag-agd-vista" aria-live="polite">{vista}</span>}
    </div>
  );
}

export default function AgendaReglas({ base, tenantId, onGuardado }) {
  const [r, setR] = useState({ ...base.reglas });
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);
  const [invalido, setInvalido] = useState('');
  const set = (k) => (v) => { setR(prev => ({ ...prev, [k]: v })); setRes(null); };

  const guardar = async () => {
    if (!r.offers_local && !r.offers_home) {
      setRes({ tipo: 'error', texto: 'Tiene que atender en el local, a domicilio o las dos.' }); return;
    }
    if (Number(r.max_advance_days) < 1) {
      setRes({ tipo: 'error', texto: 'Se puede reservar con al menos 1 día de anticipación máxima.' }); return;
    }
    setInvalido('');
    if (r.deposit_mode !== 'none' && !(Number(r.deposit_value) > 0)) {
      setInvalido('sena');
      setRes({ tipo: 'error', texto: 'Si pedís seña, poné el monto o el porcentaje.' });
      document.getElementById('ag-r-sena-v')?.focus(); return;
    }
    if (r.deposit_mode === 'fixed' && !Number.isInteger(Number(r.deposit_value))) {
      setInvalido('sena');
      setRes({ tipo: 'error', texto: 'Poné el monto en pesos, sin puntos ni comas.' });
      document.getElementById('ag-r-sena-v')?.focus(); return;
    }
    if (r.deposit_mode === 'percent' && Number(r.deposit_value) > 100) {
      setRes({ tipo: 'error', texto: 'El porcentaje de la seña no puede pasar de 100.' }); return;
    }
    setGuardando(true);
    const out = await saveBookingSettings(tenantId, r);
    setGuardando(false);
    if (out?.__error) { setRes({ tipo: 'error', texto: out.message || 'No se pudieron guardar las reglas.' }); return; }
    setRes({ tipo: 'ok', texto: 'Reglas guardadas.' });
    onGuardado();
  };

  return (
    <section className="ag-agd-seccion" aria-labelledby="ag-agd-h-reglas">
      <header>
        <h3 id="ag-agd-h-reglas">Reglas de reserva</h3>
        <p className="ag-agd-ayuda">Valen para toda la agenda y para la reserva online que viene después.</p>
      </header>

      <div className="ag-agd-dos">
        <Numero id="ag-r-aviso" rotulo="Anticipación mínima" unidad="minutos antes del turno"
          valor={r.min_notice_min} onCambio={set('min_notice_min')} />
        <Numero id="ag-r-adelante" rotulo="Hasta cuántos días" unidad="días hacia adelante" min={1}
          valor={r.max_advance_days} onCambio={set('max_advance_days')} />
        <div className="ag-agd-campo">
          <label htmlFor="ag-r-paso">Paso de la grilla</label>
          <select id="ag-r-paso" className="ag-agd-input" value={r.slot_step_min}
            onChange={(e) => set('slot_step_min')(parseInt(e.target.value, 10))}>
            {[...new Set([...PASOS, Number(r.slot_step_min)])].sort((a, b) => a - b)
              .map(p => <option key={p} value={p}>{p} min</option>)}
          </select>
          <span className="ag-agd-ayuda">Cada cuánto se ofrece un horario nuevo.</span>
        </div>
        <Numero id="ag-r-cancel" rotulo="Plazo de cancelación" unidad="horas antes del turno"
          valor={r.cancel_window_hours} onCambio={set('cancel_window_hours')} />
      </div>

      <fieldset className="ag-agd-grupo">
        <legend>Dónde atiende</legend>
        <div className="ag-agd-opciones" data-fila="true">
          <label className="ag-agd-opcion">
            <input type="checkbox" checked={!!r.offers_local} onChange={(e) => set('offers_local')(e.target.checked)} />
            En el local
          </label>
          <label className="ag-agd-opcion">
            <input type="checkbox" checked={!!r.offers_home} onChange={(e) => set('offers_home')(e.target.checked)} />
            A domicilio
          </label>
        </div>
        <span className="ag-agd-ayuda">Tiene que quedar marcada al menos una.</span>
      </fieldset>

      {r.offers_home && (
        <Numero id="ag-r-viaje" rotulo="Traslado por defecto" unidad="minutos que se reservan antes de cada turno a domicilio"
          ayuda="Se usa si el turno a domicilio no tiene zona. Las zonas se cargan en la sección Zonas de domicilio"
          valor={r.travel_min} onCambio={set('travel_min')} />
      )}

      <fieldset className="ag-agd-grupo">
        <legend>Seña</legend>
        <div className="ag-agd-dos">
          <div className="ag-agd-campo">
            <label htmlFor="ag-r-sena">Tipo de seña</label>
            <select id="ag-r-sena" className="ag-agd-input" value={r.deposit_mode}
              onChange={(e) => set('deposit_mode')(e.target.value)}>
              <option value="none">Sin seña</option>
              <option value="fixed">Monto fijo</option>
              <option value="percent">Porcentaje del servicio</option>
            </select>
          </div>
          {r.deposit_mode !== 'none' && (
            <Numero id="ag-r-sena-v" rotulo={r.deposit_mode === 'percent' ? 'Porcentaje' : 'Monto'}
              unidad={r.deposit_mode === 'percent' ? 'por ciento, hasta 100' : 'pesos, sin puntos ni comas'}
              valor={r.deposit_value} onCambio={(v) => { setInvalido(''); set('deposit_value')(v); }}
              invalido={invalido === 'sena'}
              vista={r.deposit_mode === 'fixed' && Number(r.deposit_value) > 0 && Number.isInteger(Number(r.deposit_value)) ? `Se va a pedir ${pesos(Number(r.deposit_value))} de seña` : ''} />
          )}
        </div>
        <p className="ag-agd-ayuda">El cobro online llega en una fase posterior: por ahora solo se guarda la regla.</p>
        {r.deposit_mode !== 'none' && (
          <Numero id="ag-r-retiene" rotulo="Retención del hueco" unidad="minutos que se guarda el horario hasta que se paga la seña"
            min={1} valor={r.deposit_hold_min} onCambio={set('deposit_hold_min')} />
        )}
      </fieldset>

      <PieGuardar onGuardar={guardar} guardando={guardando} res={res} etiqueta="Guardar reglas" />
    </section>
  );
}
