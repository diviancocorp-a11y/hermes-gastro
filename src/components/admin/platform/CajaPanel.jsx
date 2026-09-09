/**
 * CajaPanel — el turno de caja (Etapa 6d).
 *
 * LA DECISION DE DISENO
 * La caja tiene dos momentos con necesidades opuestas:
 *
 *   apertura / arqueo / cierre   pasa DOS VECES POR DIA. Es ceremonial: hay
 *                                que contar plata y hacerse cargo del numero.
 *                                Aca la estetica de registradora suma.
 *   cobrar                       pasa 200 VECES POR DIA. Se mide en segundos.
 *                                Aca la misma estetica seria un estorbo.
 *
 * Por eso el display de tira de papel esta en el arqueo y NO en el cobro.
 * Convertir toda la app en una caja retro se ve bien en una captura y cansa a
 * las tres horas de servicio.
 *
 * EL FALTANTE NO SE ESCONDE
 * La diferencia se muestra en grande, con signo y color. Un arqueo que siempre
 * cierra en cero es un arqueo que nadie mira.
 */
import { useState, useEffect, useCallback } from 'react';

const money = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 2,
}).format(Number(n) || 0);

// La tira de papel del arqueo. Monoespaciada porque son numeros que se
// comparan de arriba abajo: con fuente proporcional las columnas no alinean.
const papel = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  background: 'var(--ag-surface, #fffdf7)',
  color: 'var(--ag-ink, #1a1a1a)',
  border: '1px solid var(--ag-line, rgba(0,0,0,0.15))',
  borderRadius: 4,
  padding: '18px 20px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.08)',
};

function Linea({ label, valor, fuerte, tono }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 16,
      padding: '5px 0', fontSize: fuerte ? 16 : 14,
      fontWeight: fuerte ? 700 : 400,
      color: tono || 'inherit',
      borderTop: fuerte ? '1px dashed var(--ag-line, rgba(0,0,0,0.25))' : 'none',
      marginTop: fuerte ? 6 : 0, paddingTop: fuerte ? 10 : 5,
    }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}

const RENDICION_LABEL = {
  submitted: 'Presentada', under_review: 'En revisión', observed: 'Observada',
  approved: 'Aprobada', closed: 'Cerrada',
};

function Rendicion({ item, onRevisar }) {
  const [notas, setNotas] = useState('');
  const pendiente = item.status !== 'closed';
  return (
    <article className="ag-caja-fila">
      <div className="ag-caja-fila-head">
        <strong>{item.staff?.name || 'Integrante del equipo'}</strong>
        <span data-status={item.status}>{RENDICION_LABEL[item.status] || item.status}</span>
      </div>
      <div className="ag-caja-numeros">
        <span>Esperado <b>{money(item.expected_cash)}</b></span>
        <span>Declarado <b>{money(item.declared_cash)}</b></span>
        <span>Diferencia <b>{money(item.difference)}</b></span>
      </div>
      {pendiente && (
        <>
          <input
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
            placeholder="Nota de revisión"
            aria-label={`Nota para ${item.staff?.name || 'la rendición'}`}
          />
          <div className="ag-caja-acciones">
            {item.status === 'submitted' && (
              <button type="button" onClick={() => onRevisar?.(item.id, 'review', notas)}>
                Revisar
              </button>
            )}
            <button type="button" onClick={() => onRevisar?.(item.id, 'observe', notas)}>
              Observar
            </button>
            <button className="es-primaria" type="button"
              onClick={() => onRevisar?.(item.id, 'approve', notas)}>
              Recibir y cerrar
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function Incidencia({ item, onResolver }) {
  const [resolucion, setResolucion] = useState('');
  return (
    <article className="ag-caja-fila" data-severity={item.severity}>
      <div className="ag-caja-fila-head">
        <strong>{item.title}</strong>
        <span>{item.severity === 'critical' ? 'Crítica' : 'Requiere revisión'}</span>
      </div>
      {item.description && <p>{item.description}</p>}
      <div className="ag-caja-resolver">
        <input value={resolucion} onChange={(event) => setResolucion(event.target.value)}
          placeholder="Cómo se resolvió" aria-label={`Resolución de ${item.title}`} />
        <button type="button" disabled={resolucion.trim().length < 4}
          onClick={() => onResolver?.(item.id, resolucion)}>
          Resolver
        </button>
      </div>
    </article>
  );
}

function Supervision({
  turno, rendiciones, incidencias, bloqueos, perfilFiscal, documentosFiscales,
  onRevisarRendicion, onResolverIncidencia,
}) {
  const fiscalesPendientes = documentosFiscales.filter((item) =>
    ['queued', 'processing', 'retry_required', 'rejected'].includes(item.status));
  return (
    <aside className="ag-caja-supervision" aria-label="Supervisión de caja">
      <header>
        <div>
          <span className="ag-caja-kicker">CONTROL DE TURNO</span>
          <h2>Rendiciones</h2>
        </div>
        <span className="ag-caja-cuenta">{rendiciones.filter(r => r.status !== 'closed').length} pendientes</span>
      </header>

      {!turno ? (
        <p className="ag-caja-vacio">Las mini cajas aparecen cuando el turno está abierto.</p>
      ) : rendiciones.length === 0 ? (
        <p className="ag-caja-vacio">Todavía no se presentaron rendiciones.</p>
      ) : rendiciones.map(item => (
        <Rendicion key={item.id} item={item} onRevisar={onRevisarRendicion} />
      ))}

      <div className="ag-caja-subhead">
        <h3>Incidencias</h3>
        <span>{incidencias.length} abiertas</span>
      </div>
      {incidencias.length === 0
        ? <p className="ag-caja-vacio">No hay puntos pendientes para el encargado.</p>
        : incidencias.map(item => (
          <Incidencia key={item.id} item={item} onResolver={onResolverIncidencia} />
        ))}

      <div className="ag-caja-subhead">
        <h3>Facturación ARCA</h3>
        <span>{perfilFiscal?.enabled ? 'Activa' : 'Sin configurar'}</span>
      </div>
      <div className="ag-caja-fiscal">
        <span>{fiscalesPendientes.length} comprobantes requieren seguimiento</span>
        {perfilFiscal?.enabled && (
          <small>PV {String(perfilFiscal.point_of_sale).padStart(5, '0')} · {perfilFiscal.environment === 'production' ? 'Producción' : 'Homologación'}</small>
        )}
      </div>

      {turno && bloqueos && (
        <div className="ag-caja-bloqueos" aria-label="Bloqueos del cierre">
          <span>{bloqueos.open_tables || 0} mesas abiertas</span>
          <span>{bloqueos.pending_settlements || 0} rendiciones</span>
          <span>{bloqueos.critical_exceptions || 0} críticas</span>
        </div>
      )}
    </aside>
  );
}

export default function CajaPanel({
  turno,               // la sesion abierta, o null
  esperado,            // numero: lo que deberia haber en el cajon
  turnosPrevios = [],
  rendiciones = [],
  incidencias = [],
  bloqueos = null,
  perfilFiscal = null,
  documentosFiscales = [],
  onAbrir,             // (montoInicial, notas) -> Promise
  onCerrar,            // (montoContado, notas) -> Promise
  onRevisarRendicion,
  onResolverIncidencia,
  onRefrescarEsperado,
  cargando = false,
}) {
  const [montoInicial, setMontoInicial] = useState('');
  const [contado, setContado] = useState('');
  const [notas, setNotas] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  // Al abrir el turno se limpia el arqueo anterior: dejar el numero viejo en
  // el campo es la forma mas facil de cerrar con el conteo de ayer.
  useEffect(() => { setContado(''); setNotas(''); setConfirmando(false); }, [turno?.id]);

  const diferencia = contado === '' ? null : (Number(contado) || 0) - (Number(esperado) || 0);

  const abrir = useCallback(async () => {
    await onAbrir?.(Number(montoInicial) || 0, notas || null);
    setMontoInicial(''); setNotas('');
  }, [onAbrir, montoInicial, notas]);

  const input = {
    width: '100%', padding: '11px 13px', borderRadius: 9, fontSize: 16,
    fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
    background: 'var(--ag-surface-2, rgba(0,0,0,0.04))',
    border: '1px solid var(--ag-line, rgba(0,0,0,0.15))',
    color: 'inherit', boxSizing: 'border-box',
  };

  /* ── Sin turno abierto: apertura ── */
  if (!turno) {
    return (
      <section className="cp-root ag-caja-layout">
        <div className="ag-caja-arqueo">
        <div style={papel}>
          <div style={{ textAlign: 'center', letterSpacing: '0.14em', fontSize: 12, opacity: 0.6 }}>
            CAJA CERRADA
          </div>
          <div style={{ textAlign: 'center', margin: '14px 0 4px', fontSize: 15 }}>
            Abrí el turno para empezar a cobrar
          </div>
        </div>

        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            ¿Con cuánto arrancás?
          </span>
          <input
            style={input} inputMode="decimal" value={montoInicial}
            onChange={(e) => setMontoInicial(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="0" autoFocus
          />
          <span style={{ display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--ag-ink-3, #666)' }}>
            El cambio que dejás en el cajón. Si no dejás nada, poné 0.
          </span>
        </label>

        <button
          type="button" onClick={abrir} disabled={cargando}
          style={{
            padding: '13px', borderRadius: 10, cursor: 'pointer', font: 'inherit',
            fontSize: 15, fontWeight: 650, border: 'none',
            background: 'var(--ag-accent, #e8b947)', color: '#1a1a1a',
          }}
        >
          Abrir caja
        </button>

        {turnosPrevios.length > 0 && (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ag-ink-3, #666)' }}>
              Últimos arqueos ({turnosPrevios.length})
            </summary>
            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              {turnosPrevios.map(t => (
                <div key={t.id} style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: 13,
                  padding: '7px 10px', borderRadius: 7,
                  background: 'var(--ag-surface-2, rgba(0,0,0,0.03))',
                }}>
                  <span>{t.business_day || (t.opened_at || '').slice(0, 10)}</span>
                  <span style={{
                    fontVariantNumeric: 'tabular-nums',
                    color: Number(t.difference) === 0 ? 'inherit'
                      : Number(t.difference) < 0 ? 'var(--ag-bad, #c62828)' : 'var(--ag-warn, #ef6c00)',
                  }}>
                    {Number(t.difference) === 0 ? 'cerró justo' : money(t.difference)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
        </div>
        <Supervision
          turno={turno} rendiciones={rendiciones} incidencias={incidencias}
          bloqueos={bloqueos} perfilFiscal={perfilFiscal}
          documentosFiscales={documentosFiscales}
          onRevisarRendicion={onRevisarRendicion}
          onResolverIncidencia={onResolverIncidencia}
        />
      </section>
    );
  }

  /* ── Turno abierto: arqueo y cierre ── */
  return (
    <section className="cp-root ag-caja-layout">
      <div className="ag-caja-arqueo">
      <div style={papel}>
        <div style={{ textAlign: 'center', letterSpacing: '0.14em', fontSize: 12, opacity: 0.6 }}>
          TURNO ABIERTO
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.55, marginBottom: 12 }}>
          {turno.business_day || ''} · desde {(turno.opened_at || '').slice(11, 16)}
        </div>

        <Linea label="Apertura" valor={money(turno.opening_amount)} />
        <Linea label="Cobrado en efectivo"
               valor={money((Number(esperado) || 0) - (Number(turno.opening_amount) || 0))} />
        {/* Solo efectivo: lo de tarjeta no esta en el cajon, y sumarlo haria
            que el arqueo diera mal siempre. */}
        <Linea label="Debería haber" valor={money(esperado)} fuerte />

        {diferencia !== null && (
          <Linea
            label={diferencia === 0 ? 'Cierra justo' : diferencia < 0 ? 'Falta' : 'Sobra'}
            valor={diferencia === 0 ? '—' : money(Math.abs(diferencia))}
            fuerte
            tono={diferencia === 0 ? 'var(--ag-ok, #2e7d32)'
              : diferencia < 0 ? 'var(--ag-bad, #c62828)' : 'var(--ag-warn, #ef6c00)'}
          />
        )}
      </div>

      <label style={{ display: 'block' }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          ¿Cuánto contaste?
        </span>
        <input
          style={input} inputMode="decimal" value={contado}
          onChange={(e) => { setContado(e.target.value.replace(/[^\d.,]/g, '')); setConfirmando(false); }}
          placeholder="0"
        />
        <span style={{ display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--ag-ink-3, #666)' }}>
          Contá la plata del cajón. Si no coincide, se guarda la diferencia igual.
        </span>
      </label>

      {diferencia !== null && diferencia !== 0 && (
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            ¿Sabés por qué?
          </span>
          <input
            style={{ ...input, fontFamily: 'inherit', fontSize: 14 }}
            value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="Se pagó un flete, sobró vuelto..."
          />
        </label>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button" onClick={onRefrescarEsperado}
          style={{
            padding: '12px 14px', borderRadius: 10, cursor: 'pointer', font: 'inherit',
            border: '1px solid var(--ag-line, rgba(0,0,0,0.15))',
            background: 'transparent', color: 'inherit',
          }}
        >
          Actualizar
        </button>
        <button
          type="button"
          disabled={contado === '' || cargando}
          onClick={() => {
            // Cerrar la caja termina el turno y no se deshace: la confirmacion
            // en dos pasos evita el cierre por un toque de mas.
            if (!confirmando) { setConfirmando(true); return; }
            onCerrar?.(Number(contado) || 0, notas || null);
          }}
          style={{
            flex: 1, padding: '12px', borderRadius: 10, font: 'inherit',
            fontSize: 15, fontWeight: 650, border: 'none',
            cursor: contado === '' ? 'not-allowed' : 'pointer',
            opacity: contado === '' ? 0.5 : 1,
            background: confirmando ? 'var(--ag-bad, #c62828)' : 'var(--ag-accent, #e8b947)',
            color: confirmando ? '#fff' : '#1a1a1a',
          }}
        >
          {confirmando ? '¿Seguro? Tocá de nuevo' : 'Cerrar caja'}
        </button>
      </div>
      </div>
      <Supervision
        turno={turno} rendiciones={rendiciones} incidencias={incidencias}
        bloqueos={bloqueos} perfilFiscal={perfilFiscal}
        documentosFiscales={documentosFiscales}
        onRevisarRendicion={onRevisarRendicion}
        onResolverIncidencia={onResolverIncidencia}
      />
    </section>
  );
}
