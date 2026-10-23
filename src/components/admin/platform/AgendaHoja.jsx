/**
 * Piezas compartidas de la agenda: la hoja (dialogo), el chip de estado, el
 * punto de la profesional y los avisos. Viven juntas porque las usan las
 * cuatro pantallas y ninguna tiene sentido afuera de la agenda.
 */
import { useEffect, useId, useRef } from 'react';
import { ESTADOS } from '../../../modules/agenda';
import '../../../styles/admin-agenda.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hoja accesible: role="dialog", aria-modal, Escape cierra, el foco queda
 * adentro mientras esta abierta y vuelve a quien la abrio al cerrar.
 */
export function Hoja({ titulo, onCerrar, children, pie, error, foco, cerrarConFondo = true }) {
  const ref = useRef(null);
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; });
  const idTitulo = useId();

  // Al abrir: el foco entra a la hoja, el fondo deja de scrollear y todo se
  // devuelve al cerrar.
  useEffect(() => {
    const previo = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (previo && typeof previo.focus === 'function') previo.focus();
    };
  }, []);

  // "foco" cambia cuando la misma hoja cambia de contenido (detalle, mover,
  // confirmar): el boton que se toco desaparece y el foco tiene que quedar
  // adentro, o Escape deja de llegar a la hoja.
  useEffect(() => { ref.current?.focus(); }, [foco]);

  const alTeclear = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar.current?.(); return; }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const primero = items[0];
    const ultimo = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === ref.current)) {
      e.preventDefault(); ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primero.focus();
    }
  };

  return (
    <div className="ag-agd-velo" onMouseDown={(e) => { if (cerrarConFondo && e.target === e.currentTarget) onCerrar?.(); }}>
      <div
        ref={ref}
        className="ag-agd-hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={alTeclear}
      >
        <header className="ag-agd-hoja-cab">
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className="ag-agd-btn" onClick={onCerrar} aria-label="Cerrar">
            <span aria-hidden="true">{'×'}</span>
          </button>
        </header>
        <div className="ag-agd-hoja-cuerpo">{children}</div>
        {pie || error ? (
          <footer className="ag-agd-hoja-pie">
            {error && <Aviso tipo="error">{error}</Aviso>}
            {pie}
          </footer>
        ) : <span />}
      </div>
    </div>
  );
}

/** El estado siempre lleva su palabra: el color solo no alcanza. */
export function EstadoChip({ status }) {
  const e = ESTADOS[status] || { label: status, tono: 'neutro' };
  return (
    <span className="ag-agd-chip" data-tono={e.tono}>
      <i aria-hidden="true" />
      {e.label}
    </span>
  );
}

/** El color de la profesional: decorativo, su nombre va siempre al lado. */
export function Punto({ color }) {
  return <span className="ag-agd-punto" style={color ? { '--c': color } : undefined} aria-hidden="true" />;
}

/** tipo: 'error' | 'ok' | undefined. Los errores se anuncian solos. */
export function Aviso({ tipo, children }) {
  if (!children) return null;
  return (
    <div className="ag-agd-aviso" data-tipo={tipo} role={tipo === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
    </div>
  );
}

/**
 * Guardado explicito de una seccion: el boton, y debajo el resultado en
 * palabras (ok o error). `res` es { tipo: 'ok' | 'error', texto } o null.
 */
export function PieGuardar({ onGuardar, guardando, res, etiqueta = 'Guardar' }) {
  return (
    <div className="ag-agd-guardar">
      <button type="button" className="ag-agd-btn" data-primario="true" onClick={onGuardar} disabled={guardando}>
        {guardando ? 'Guardando...' : etiqueta}
      </button>
      {res && <Aviso tipo={res.tipo}>{res.texto}</Aviso>}
    </div>
  );
}
