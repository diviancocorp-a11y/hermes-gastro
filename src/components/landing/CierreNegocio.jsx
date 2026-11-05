import Palabras from './Palabras';
import '../../styles/cierre-negocio.css';

export default function CierreNegocio({ onDiagnostico }) {
  // Cierre de la pagina, despues de Preguntas: una section comun sobre el azul.
  // El titulo entra palabra por palabra con el IntersectionObserver de
  // useEntradas, como cualquier otro titulo de la landing.
  return (
    <section className="cf-root" id="contacto" aria-labelledby="cf-titulo">
      <div className="cf-panel">
        <h2 id="cf-titulo" data-reveal="palabras"><span><Palabras texto="Tu negocio más ordenado." /></span><span><Palabras texto="Tu tiempo más tuyo." inicio={4} /></span></h2>
        <div className="cf-accion">
          <button type="button" className="pl-boton cf-boton" onClick={onDiagnostico}>
            <span className="cf-etiqueta">Empezar mi diagnóstico</span>
            <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
          <p className="cf-ayuda">Diagnóstico breve, sin dejar tu email.</p>
        </div>
      </div>
    </section>
  );
}
