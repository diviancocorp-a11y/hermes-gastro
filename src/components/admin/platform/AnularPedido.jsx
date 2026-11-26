/**
 * AnularPedido — confirmacion de anular un pedido YA completado.
 *
 * Anular saca el pedido de Ventas y de Caja y devuelve el stock, y no se
 * deshace. Por eso no es un "deslizar para confirmar" (ConfirmSlide no recibe
 * texto): pide el motivo, que queda en el pedido para el que revise la caja.
 *
 * Se monta por Dialog (portal, trampa de foco, Escape), asi que vive bajo
 * `.ag-overlay-root` y sus botones son propios (`.ag-anular-*`).
 */
import { useId, useRef, useState } from 'react';
import Dialog from '../../ui/Dialog';
import { MOTIVO_MAX, motivoValido } from '../../../lib/anularPedido';
import '../../../styles/admin-anular-pedido.css';

export default function AnularPedido({
  pedido, onConfirmar, onCerrar,
  // Solo para la vista previa (npm run pantalla): el render de servidor no
  // monta portales ni corre efectos.
  motivoInicial = '', sinPortal = false,
}) {
  const uid = useId();
  const [motivo, setMotivo] = useState(motivoInicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // El estado llega un render tarde: el ref corta el segundo toque antes.
  const enCurso = useRef(false);

  const limpio = motivoValido(motivo);
  const cliente = pedido?.customer_name || 'este cliente';

  const anular = async (e) => {
    e.preventDefault();
    if (!limpio || enCurso.current) return;
    enCurso.current = true;
    setEnviando(true);
    setError('');
    let res;
    try {
      res = await onConfirmar(pedido, limpio);
    } catch {
      res = { __error: 'red', message: 'No se pudo anular el pedido. Probá de nuevo.' };
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
    if (res?.__error) { setError(res.message || 'No se pudo anular el pedido'); return; }
    onCerrar();
  };

  const formulario = (
    <form onSubmit={anular} className="ag-anular-form" noValidate>
        <h2 id={`${uid}-titulo`} className="ag-anular-titulo">Anular el pedido de {cliente}</h2>
        <p id={`${uid}-efecto`} className="ag-anular-efecto">
          Sale de Ventas y Caja y devuelve el stock. No se puede deshacer.
        </p>

        <div className="ag-anular-campo">
          <label htmlFor={`${uid}-motivo`} className="ag-anular-etiqueta">Motivo</label>
          <textarea
            id={`${uid}-motivo`}
            className="ag-anular-input"
            rows={3}
            maxLength={MOTIVO_MAX}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: se cargó dos veces"
            autoFocus
            disabled={enviando}
            aria-describedby={limpio ? undefined : `${uid}-ayuda`}
          />
          {!limpio && (
            <p id={`${uid}-ayuda`} className="ag-anular-ayuda">Escribí al menos 3 caracteres</p>
          )}
        </div>

        {error && <p id={`${uid}-error`} role="alert" className="ag-anular-error">{error}</p>}

        <div className="ag-anular-acciones">
          <button type="button" className="ag-anular-volver" onClick={onCerrar} disabled={enviando}>
            Volver
          </button>
          <button type="submit" className="ag-anular-confirmar" disabled={!limpio || enviando}>
            {enviando ? 'Anulando…' : 'Anular pedido'}
          </button>
        </div>
    </form>
  );

  if (sinPortal) {
    return (
      <div className="ag-dialog-backdrop">
        <div
          role="dialog" aria-modal="true" aria-labelledby={`${uid}-titulo`}
          className="ag-dialog-panel ag-dialog-panel--center ag-anular"
        >
          {formulario}
        </div>
      </div>
    );
  }

  return (
    <Dialog
      open
      onClose={enviando ? undefined : onCerrar}
      cerrarConBackdrop={!motivo.trim()}
      labelledBy={`${uid}-titulo`}
      describedBy={`${uid}-efecto`}
      variante="center"
      className="ag-anular"
    >
      {formulario}
    </Dialog>
  );
}
