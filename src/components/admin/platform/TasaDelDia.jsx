/**
 * TasaDelDia — la tasa vigente del negocio, su historial corto y la carga
 * manual. Vive en Configuración → Finanzas, y solo cuando el negocio tiene
 * moneda secundaria (Settings no muestra la fila si no).
 *
 * Quien llega acá es quien puede abrir Configuración (dueño y encargado): el
 * mismo criterio que rige para editar el resto de Finanzas. La base deja
 * insertar a cualquier miembro, asi que el recorte es de esta pantalla.
 *
 * Cargar una tasa tiene dos pasos a proposito: una tasa mal tipeada cambia el
 * precio de todo el catálogo. El segundo paso muestra la variación contra la
 * vigente y, si pasa del 20%, pide una confirmación aparte.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  fetchTasas, cargarTasaManual, elegirVigente, variacionPct, fechaLegible as fmtDia, UMBRAL_VARIACION_PCT,
} from '../../../services/platformTasas';
import { tasaVencida } from '../../../lib/moneda';
import './tasa-del-dia.css';

const ORIGEN = {
  manual: 'Cargada a mano',
  bcv: 'BCV (oficial)',
  dolarapi: 'Respaldo (dolarapi)',
};
export const origenLegible = (source) => ORIGEN[source] || `Automática (${source})`;

const fmtTasa = (n) => Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default function TasaDelDia({ tenantId, moneda, showToast, onCargada }) {
  const { monedaPrincipal: base, monedaSecundaria: quote, zona } = moneda;
  const [filas, setFilas] = useState(null);
  const [texto, setTexto] = useState('');
  const [paso, setPaso] = useState('editar'); // 'editar' | 'confirmar'
  const [extra, setExtra] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => { setFilas(await fetchTasas(tenantId, base, quote, 8)); }, [tenantId, base, quote]);
  useEffect(() => { cargar(); }, [cargar]);

  const vigente = filas ? elegirVigente(filas) : null;
  const vencida = vigente ? tasaVencida(vigente.effective_date, new Date(), zona) : true;
  const nueva = Number(texto);
  const valida = Number.isFinite(nueva) && nueva > 0;
  const variacion = valida && vigente ? variacionPct(nueva, vigente.rate) : null;
  const grande = variacion != null && Math.abs(variacion) > UMBRAL_VARIACION_PCT;

  const volver = () => { setPaso('editar'); setExtra(false); };
  const guardar = async () => {
    if (guardando || !valida || (grande && !extra)) return;
    setGuardando(true);
    const r = await cargarTasaManual(tenantId, { base, quote, rate: nueva, zona });
    setGuardando(false);
    if (!r.ok) { showToast?.(r.error); return; }
    showToast?.('Tasa guardada');
    setTexto(''); volver();
    await cargar();
    onCargada?.();
  };

  return (
    <div className="tasa-dia">
      <section className="tasa-dia-vigente" aria-live="polite">
        <div className="tasa-dia-etq">Tasa vigente</div>
        {filas === null ? <p className="tasa-dia-nota">Cargando…</p> : vigente ? (
          <>
            <div className="tasa-dia-valor">
              <strong>{fmtTasa(vigente.rate)}</strong> <span>{quote} por {base}</span>
            </div>
            <div className="tasa-dia-meta">{origenLegible(vigente.source)} · del {fmtDia(vigente.effective_date)}</div>
            {vencida && (
              <p className="tasa-dia-aviso" role="status">
                Esta tasa está vencida: tiene más de 3 días. Los precios en {quote} pueden no ser reales. Cargá una a mano o esperá a la próxima automática.
              </p>
            )}
          </>
        ) : (
          <p className="tasa-dia-aviso" role="status">
            Todavía no hay ninguna tasa. Sin tasa no se muestran precios en {quote}. Cargá una a mano.
          </p>
        )}
      </section>

      <section className="tasa-dia-carga">
        <label className="tasa-dia-etq" htmlFor="tasa-manual">Cargar una tasa a mano ({quote} por {base})</label>
        {paso === 'editar' ? (
          <div className="tasa-dia-fila">
            <input
              id="tasa-manual" type="number" inputMode="decimal" min="0" step="0.01"
              value={texto} onChange={e => setTexto(e.target.value)} placeholder="0,00"
            />
            <button type="button" className="ag-btn-primary" disabled={!valida} onClick={() => setPaso('confirmar')}>
              Revisar
            </button>
          </div>
        ) : (
          <div className="tasa-dia-confirma">
            <p>
              Vas a guardar <strong>{fmtTasa(nueva)}</strong> {quote} por {base} con fecha de hoy.
              {variacion != null && <> Cambia <strong>{variacion > 0 ? '+' : ''}{variacion.toFixed(1)}%</strong> contra la vigente ({fmtTasa(vigente.rate)}).</>}
            </p>
            {grande && (
              <label className="tasa-dia-extra">
                <input type="checkbox" checked={extra} onChange={e => setExtra(e.target.checked)} />
                <span>La variación pasa del {UMBRAL_VARIACION_PCT}%. Confirmo que no es un error de tipeo.</span>
              </label>
            )}
            <div className="tasa-dia-fila">
              <button type="button" className="ag-btn-ghost" onClick={volver} disabled={guardando}>Corregir</button>
              <button type="button" className="ag-btn-primary" onClick={guardar} disabled={guardando || (grande && !extra)}>
                {guardando ? 'Guardando…' : 'Confirmar y guardar'}
              </button>
            </div>
          </div>
        )}
        <p className="tasa-dia-nota">Una tasa manual le gana a la automática del mismo día. Para corregirla, cargá otra.</p>
      </section>

      {filas && filas.length > 0 && (
        <section className="tasa-dia-historial">
          <div className="tasa-dia-etq">Últimas tasas</div>
          <ul>
            {filas.map(f => (
              <li key={f.id}>
                <span>{fmtDia(f.effective_date)}</span>
                <span>{origenLegible(f.source)}</span>
                <strong>{fmtTasa(f.rate)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
