import { useEffect, useLayoutEffect, useId, useRef } from 'react';

// Lectura no modal: ocupa el lateral, no bloquea ni oscurece la maqueta.
export default function LecturaRubro({ titulo, contexto, onCerrar, origen, children }) {
  const id = useId();
  const panel = useRef(null);
  const encabezado = useRef(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);
  useLayoutEffect(() => {
    const disparador = origen.current || document.activeElement;
    const hayModal = () => document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!hayModal()) encabezado.current?.focus({ preventScroll: true });
    if (!hayModal() && window.matchMedia('(min-width: 1000px)').matches) panel.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const teclado = e => {
      if (hayModal()) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarRef.current(); }
    };
    const fuera = e => {
      if (hayModal()) return;
      if (!panel.current?.contains(e.target) && !e.target.closest('[data-rn-disparador]')) cerrarRef.current();
    };
    document.addEventListener('keydown', teclado, true);
    document.addEventListener('pointerdown', fuera);
    const elemento = panel.current;
    return () => {
      document.removeEventListener('keydown', teclado, true);
      document.removeEventListener('pointerdown', fuera);
      if (elemento?.contains(document.activeElement)) queueMicrotask(() => {
        if (document.activeElement === document.body && disparador?.isConnected) disparador.focus({ preventScroll: true });
      });
    };
  }, [origen]);
  return (
    <div className="rn-lectura" role="dialog" aria-labelledby={id} ref={panel}>
      <button type="button" className="rn-cerrar-lectura" aria-label="Cerrar explicación" onClick={onCerrar}>×</button>
      <p className="rn-lectura-contexto">{contexto}</p>
      <h4 id={id} tabIndex={-1} ref={encabezado}>{titulo}</h4>
      {children}
    </div>
  );
}
