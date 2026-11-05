import { useRef, useState } from 'react';
import GlyphPortal from './GlyphPortal';
import Palabras from './Palabras';
import '../../styles/cierre-negocio.css';

export default function CierreNegocio({ onDiagnostico }) {
  // El titulo entra una sola vez: cuando la camara ya revelo el panel o cuando
  // el foco llega al panel antes de entrar. Con el portal estatico (movimiento
  // reducido, fuente colgada) el titulo no se esconde: ver platform-landing.css.
  // La fuente y el peso de la palabra salen de --gp-font-family y
  // --gp-font-weight (cierre-negocio.css), no de props.
  const [tituloListo, setTituloListo] = useState(false);
  const yaListo = useRef(false);
  const marcarListo = () => { if (yaListo.current) return; yaListo.current = true; setTituloListo(true); };
  const alAvanzar = (progreso) => { if (progreso >= .85) marcarListo(); };
  return (
      <GlyphPortal
        className="cf-root" aria-labelledby="cf-titulo" data-titulo={tituloListo ? 'listo' : undefined}
        word="DICO" focusChar="O" scrollLength={1.6}
        campo={<span className="cf-luces"><span /><span /><span /></span>}
        onProgress={alAvanzar} onFocusCapture={marcarListo}
      >
        <div className="cf-panel">
          {/* El ancla cae al panel, no a la palabra: un link a #contacto llega con todo revelado. */}
          <span className="pl-ancla" id="contacto" aria-hidden="true" />
          <h2 id="cf-titulo" data-reveal="palabras"><span><Palabras texto="Tu negocio más ordenado." /></span><span><Palabras texto="Tu tiempo más tuyo." inicio={4} /></span></h2>
          <div className="cf-accion">
          <button type="button" className="pl-boton cf-boton" onClick={onDiagnostico}>
            <span className="cf-etiqueta">Empezar mi diagnóstico</span>
            <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
          <p className="cf-ayuda">Diagnóstico breve, sin dejar tu email.</p>
          </div>
        </div>
      </GlyphPortal>
  );
}
