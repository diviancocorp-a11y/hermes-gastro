import { useEffect, useLayoutEffect, useRef } from 'react';
import ShaderBackground from './ShaderBackground';
import OverlayPortal from '../ui/OverlayPortal';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function DiagnosticoCard(props) {
  return <OverlayPortal><Sesion {...props} /></OverlayPortal>;
}

function Sesion({ visible, fondoRef, oroRef, tituloRef, tituloId, resultado, analizando, onCerrar, children }) {
  const contenedorRef = useRef(null);
  const cardRef = useRef(null);
  const posicionAnterior = useRef(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    const rect = card?.getBoundingClientRect();
    const previo = posicionAnterior.current;
    posicionAnterior.current = rect;
    if (!analizando || !rect || !previo || !card.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const animacion = card.animate([
      { transform: `translateY(${previo.top - rect.top}px)` },
      { transform: 'translateY(0)' },
    ], { duration: 700, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    return () => animacion.cancel();
  }, [analizando, visible]);
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
    <div className="pl-root dg-modal" data-visible={visible} data-resultado={Boolean(resultado)} data-analizando={Boolean(analizando)} role="dialog" aria-modal="true"
      aria-labelledby={visible ? tituloId : undefined} aria-label={visible ? undefined : 'Diagnóstico de Dico'}
      ref={contenedorRef} tabIndex={-1}>
      {analizando && <div className="dg-analisis-fondo" aria-hidden="true"><ShaderBackground /></div>}
      <div className="dg-modal-luces" aria-hidden="true" />
      <div className="pl-viaje-dico" ref={oroRef} aria-hidden="true" />
      <section className="dg-modal-card" ref={cardRef} data-visible={visible} aria-hidden={!visible} inert={!visible}>
          <div className="dg-modal-cabecera">
            <img className="dg-modal-logo" src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
            <button type="button" className="dg-modal-cerrar" aria-label="Cerrar diagnóstico" onClick={onCerrar}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          {children}
      </section>
    </div>
  );
}
