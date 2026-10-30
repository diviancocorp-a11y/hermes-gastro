import { useEffect, useRef } from 'react';
import OverlayPortal from '../ui/OverlayPortal';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function DiagnosticoCard(props) {
  return <OverlayPortal><Sesion {...props} /></OverlayPortal>;
}

function Sesion({ visible, fondoRef, oroRef, tituloRef, tituloId, resultado, onCerrar, children }) {
  const contenedorRef = useRef(null);
  // Un solo dueño durante apertura, formulario y contracción. El helper no
  // captura ni restaura estos recursos mientras el modal los necesita.
  useEffect(() => {
    const fondo = fondoRef.current?.closest('.pl-root') || fondoRef.current;
    const inertPrevio = fondo?.hasAttribute('inert');
    const overflowHtml = document.documentElement.style.overflow;
    const overflowBody = document.body.style.overflow;
    fondo?.toggleAttribute('inert', true);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      fondo?.toggleAttribute('inert', Boolean(inertPrevio));
      document.documentElement.style.overflow = overflowHtml;
      document.body.style.overflow = overflowBody;
    };
  }, [fondoRef]);
  useFocusTrap({ activo: true, contenedorRef, onEscape: onCerrar, bloquearScroll: false });
  useEffect(() => {
    if (visible) tituloRef.current?.focus({ preventScroll: true });
  }, [visible, tituloRef]);
  return (
    <div className="pl-root dg-modal" data-visible={visible} data-resultado={Boolean(resultado)} role="dialog" aria-modal="true"
      aria-labelledby={visible ? tituloId : undefined} aria-label={visible ? undefined : 'Diagnóstico de Dico'}
      ref={contenedorRef} tabIndex={-1}>
      <div className="dg-modal-luces" aria-hidden="true" />
      <div className="pl-viaje-dico" ref={oroRef} aria-hidden="true" />
      <section className="dg-modal-card" data-visible={visible} aria-hidden={!visible} inert={!visible}>
          <div className="dg-modal-cabecera">
            <img className="dg-modal-logo" src={`/brand/dico/logo/${resultado ? 'dico-claro' : 'dico-oscuro'}.png`} alt="Dico" width="1368" height="452" />
            <button type="button" className="dg-modal-cerrar" aria-label="Cerrar diagnóstico" onClick={onCerrar}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          {children}
      </section>
    </div>
  );
}
