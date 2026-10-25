import { AGENDA_URL, AGENDA_HORARIO, WHATSAPP_URL, WHATSAPP_HORARIO, WHATSAPP_VISIBLE } from '../../lib/contactoPlataforma';
import { marcarEvento } from '../../lib/analiticaPlataforma';
import '../../styles/cierre-negocio.css';

export default function CierreNegocio({ onDiagnostico }) {
  return (
    <>
      <section className="cf-root" id="contacto" aria-labelledby="cf-titulo">
        <div className="cf-panel">
          <h2 id="cf-titulo">Todo tu negocio<br />en un solo lugar.</h2>
          <p>Contanos qué necesitás. Dico te orienta por dónde empezar.</p>
          <button type="button" className="pl-boton cf-boton" onClick={onDiagnostico}>
            <span className="cf-etiqueta">Quiero Dico</span>
            <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
          <span className="cf-ayuda">Un diagnóstico breve, sin dejar tu email.</span>
        </div>
      </section>
      <footer className="pf-root" aria-label="Contacto y navegación de Dico">
        <div className="pf-contenido">
          <p className="pf-marca-texto">Dico, de Divianco.</p>
          <nav className="pf-nav" aria-label="Navegación del pie">
            <a href="#que-hace">Cómo funciona</a><a href="#rubros">Tu rubro</a><a href="#precios">Planes</a><a href="#preguntas">Preguntas</a><a href="/entrar">Entrar</a>
          </nav>
          <div className="pf-contactos">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('whatsapp')}>WhatsApp {WHATSAPP_VISIBLE}</a>
            <a href="mailto:hola@divianco.app">hola@divianco.app</a>
            <a href={AGENDA_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('agenda')}>Agendar una reunión</a>
          </div>
          <p className="pf-horarios">WhatsApp {WHATSAPP_HORARIO}.<br />Reuniones {AGENDA_HORARIO}.</p>
          <div className="pf-legales"><a href="mailto:hola@divianco.app?subject=Consulta%20legal%20y%20privacidad%20de%20Dico">Consultas legales y de privacidad</a><span>© {new Date().getFullYear()} Divianco.</span></div>
        </div>
        <div className="pf-logo" aria-hidden="true"><img src="/brand/dico/logo/dico-oscuro.png" alt="" width="1368" height="452" loading="lazy" /></div>
      </footer>
    </>
  );
}
