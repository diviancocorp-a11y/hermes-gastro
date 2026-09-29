import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DicoPhysical from './DicoPhysical';
import MensajeDico from './MensajeDico';
import './dico-floating.css';

function posicionInicial() {
  return { x: 0, y: 0 };
}

function posicionParaObjetivo(objetivo) {
  if (!objetivo || typeof objetivo.getBoundingClientRect !== 'function') return posicionInicial();
  const rect = objetivo.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - window.innerWidth / 2,
    y: rect.top + rect.height / 2 - window.innerHeight / 2 - 96,
  };
}

/** Physical vive en una capa propia del documento, nunca dentro de la sidebar. */
export default function DicoFloatingPhysical({
  intervencion,
  objetivo = null,
  onAccion,
  onCerrar,
}) {
  const [destino, setDestino] = useState(posicionInicial);

  useEffect(() => {
    if (objetivo) objetivo.classList.add('dico-guia-target');
    return () => objetivo?.classList.remove('dico-guia-target');
  }, [objetivo]);

  useEffect(() => {
    const medir = () => setDestino(posicionParaObjetivo(objetivo));
    medir();
    if (!objetivo) return undefined;
    const actualizar = () => medir();
    window.addEventListener('resize', actualizar);
    window.addEventListener('scroll', actualizar, true);
    return () => {
      window.removeEventListener('resize', actualizar);
      window.removeEventListener('scroll', actualizar, true);
    };
  }, [objetivo, intervencion?.id]);

  if (!intervencion || typeof document === 'undefined') return null;
  const nivel = intervencion.id === 'nada-visible' ? 'alerta' : 'sugerencia';
  const guiado = Boolean(objetivo || intervencion.cta);
  const capa = (
    <div className="dico-presencia-fisica" data-dico-floating="true">
      <div
        className="dico-presencia-fisica-escena"
        style={{ '--dico-guia-x': `${destino.x}px`, '--dico-guia-y': `${destino.y}px` }}
      >
        <DicoPhysical key={intervencion.id} pose={intervencion.pose || 'idle'} className="dico-physical--flotante" title="Dico te esta guiando" />
        <div className="dico-presencia-fisica-mensaje">
          <MensajeDico
            key={`mensaje:${intervencion.id}`}
            texto={intervencion.mensaje}
            nivel={nivel}
            accion={intervencion.cta?.texto}
            accionClassName={guiado ? 'dico-mensaje-accion--guiado' : ''}
            onAccion={intervencion.cta ? () => onAccion?.(intervencion) : undefined}
            onCerrar={onCerrar}
          />
        </div>
      </div>
    </div>
  );
  return createPortal(capa, document.body);
}
