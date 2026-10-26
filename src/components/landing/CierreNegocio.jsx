import { AGENDA_URL, AGENDA_HORARIO, WHATSAPP_URL, WHATSAPP_HORARIO, WHATSAPP_VISIBLE, INSTAGRAM_DICO_URL, INSTAGRAM_DIVIANCO_URL } from '../../lib/contactoPlataforma';
import { marcarEvento } from '../../lib/analiticaPlataforma';
import '../../styles/cierre-negocio.css';

export default function CierreNegocio({ onDiagnostico }) {
  return (
    <>
      <section className="cf-root" id="contacto" aria-labelledby="cf-titulo">
        <div className="cf-destellos" aria-hidden="true"><span className="cf-luz-volt" /><span className="cf-luz-oro" /></div>
        <div className="cf-panel">
          <h2 id="cf-titulo"><span>Tu negocio más ordenado.</span><span>Tu tiempo más tuyo.</span></h2>
          <p>Descubrí por dónde empezar con Dico.</p>
          <button type="button" className="pl-boton cf-boton" onClick={onDiagnostico}>
            <span className="cf-etiqueta">Empezar mi diagnóstico</span>
            <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
          <span className="cf-ayuda">Diagnóstico breve, sin dejar tu email.</span>
        </div>
      </section>
      <footer className="pf-root" aria-label="Contacto y navegación de Dico">
        <div className="pf-contenido">
          <p className="pf-marca-texto"><a href={INSTAGRAM_DIVIANCO_URL} target="_blank" rel="noopener noreferrer">Hecho por Grupo Divianco</a></p>
          <nav className="pf-nav" aria-label="Navegación del pie">
            <a href="#que-hace">Cómo funciona</a><a href="#rubros">Tu rubro</a><a href="#precios">Planes</a><a href="#preguntas">Preguntale a Dico</a><a href="/entrar">Iniciá sesión</a>
          </nav>
          <div className="pf-redes">
            <a href={INSTAGRAM_DICO_URL} target="_blank" rel="noopener noreferrer"><span className="pf-icono"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg></span><span>Instagram</span></a>
            <a className="pf-whatsapp" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('whatsapp')}><span className="pf-icono"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-12 7L3 20l1.5-5A8 8 0 1 1 20 11.5Z" /><path d="M8 7.5c-.5 3 2.5 6 5.5 6.5l1.5-1.5-2-1-1 1c-1.5-.5-2.5-1.5-3-3l1-1-1-2Z" /></svg></span><span>WhatsApp</span></a>
            <a href="mailto:hola@divianco.app"><span className="pf-icono"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 6 8 7 8-7" /></svg></span><span>Email</span></a>
          </div>
          <div className="pf-datos"><a href="mailto:hola@divianco.app">hola@divianco.app</a><span aria-hidden="true">·</span><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('whatsapp')}>{WHATSAPP_VISIBLE}</a></div>
          <a className="pf-agenda" href={AGENDA_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('agenda')}>Agendar una reunión <span aria-hidden="true">↗</span></a>
          <p className="pf-horarios">WhatsApp: {WHATSAPP_HORARIO}.<br />Reuniones: {AGENDA_HORARIO}.</p>
          <div className="pf-legales">{['Términos y condiciones', 'Política de privacidad', 'Preferencias de cookies'].map(texto => <button key={texto} type="button" disabled title="Pendiente de publicación">{texto}</button>)}</div>
          <p className="pf-copyright">© {new Date().getFullYear()} Grupo Divianco. Todos los derechos reservados.</p>
        </div>
        <div className="pf-logo" aria-hidden="true"><img src="/brand/dico/logo/dico-oscuro.png" alt="" width="1368" height="452" loading="lazy" /></div>
      </footer>
    </>
  );
}
