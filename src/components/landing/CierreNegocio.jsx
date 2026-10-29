import { useEffect, useRef, useState } from 'react';
import useMediaQuery from '../../lib/useMediaQuery';
import { AGENDA_URL, AGENDA_HORARIO, WHATSAPP_URL, WHATSAPP_HORARIO, WHATSAPP_VISIBLE, INSTAGRAM_DICO_URL, INSTAGRAM_DIVIANCO_URL } from '../../lib/contactoPlataforma';
import { marcarEvento } from '../../lib/analiticaPlataforma';
import NegociosDico from './NegociosDico';
import '../../styles/cierre-negocio.css';

export default function CierreNegocio({ onDiagnostico }) {
  const [copiaEmail, setCopiaEmail] = useState('');
  const cierre = useRef(null);
  const yaAbierta = useRef(false);
  const reducido = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [compuerta, setCompuerta] = useState('cerrada');
  useEffect(() => {
    if (reducido) {
      const cuadro = requestAnimationFrame(() => { yaAbierta.current = true; setCompuerta('abierta'); });
      return () => cancelAnimationFrame(cuadro);
    }
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const rect = cierre.current.getBoundingClientRect();
      const alto = window.innerHeight;
      if (rect.top > alto + 80) yaAbierta.current = false;
      const junta = rect.top + rect.height / 2;
      const progreso = yaAbierta.current ? 1 : Math.max(0, Math.min(1, (alto * .86 - junta) / (alto * .44)));
      cierre.current.style.setProperty('--cf-apertura', `${progreso * 101}%`);
      const estado = progreso >= 1 ? 'abierta' : progreso > 0 ? 'abriendo' : junta <= alto * .92 ? 'dorada' : 'cerrada';
      setCompuerta(actual => actual === estado ? actual : estado);
    };
    const actualizar = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    window.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    actualizar();
    return () => { cancelAnimationFrame(cuadro); window.removeEventListener('scroll', actualizar); window.removeEventListener('resize', actualizar); };
  }, [reducido]);
  return (
    <>
      <section className="cf-root" id="contacto" aria-labelledby="cf-titulo" ref={cierre} data-compuerta={reducido ? 'abierta' : compuerta} onFocusCapture={evento => { if (!evento.target.matches(':focus-visible')) return; yaAbierta.current = true; cierre.current.style.setProperty('--cf-apertura', '101%'); setCompuerta('abierta'); }}>
        <div className="cf-compuerta" aria-hidden="true"><span className="cf-hoja cf-hoja-superior" /><span className="cf-hoja cf-hoja-inferior" /></div>
        <div className="cf-panel">
          <h2 id="cf-titulo"><span>Tu negocio más ordenado.</span><span>Tu tiempo más tuyo.</span></h2>
          <div className="cf-accion">
          <button type="button" className="pl-boton cf-boton" onClick={onDiagnostico}>
            <span className="cf-etiqueta">Empezar mi diagnóstico</span>
            <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
          <p className="cf-ayuda">Diagnóstico breve, sin dejar tu email.</p>
          </div>
        </div>
      </section>
      <footer className="pf-root" aria-label="Contacto y navegación de Dico">
        <div className="pf-contenido">
          <NegociosDico />
          <p className="pf-marca-texto"><a href={INSTAGRAM_DIVIANCO_URL} target="_blank" rel="noopener noreferrer">Un producto de Grupo Divianco</a></p>
          <nav className="pf-nav" aria-label="Navegación del pie">
            <a href="#rubros">Cómo funciona</a><a href="#rubros">Tu rubro</a><a href="#precios">Planes</a><a href="#preguntas">Preguntale a Dico</a><a href="/entrar">Iniciá sesión</a>
          </nav>
          <div className="pf-redes">
            <div className="pf-contacto">
              <a className="pf-capsula" href={INSTAGRAM_DICO_URL} target="_blank" rel="noopener noreferrer" aria-label="Conocé Dico en Instagram (abre otra pestaña)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg><span className="pf-mensaje">Conocé Dico <span aria-hidden="true">↗</span></span>
              </a>
              <span className="pf-contacto-nombre">Instagram</span><span className="pf-contacto-dato">@dico.arg</span>
            </div>
            <div className="pf-contacto">
              <a className="pf-capsula pf-whatsapp" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('whatsapp')} aria-label="Hablemos de tu negocio por WhatsApp (abre otra pestaña)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path className="pf-whatsapp-glifo" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.241-.579-.486-.5-.668-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.064 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.57-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg><span className="pf-mensaje">Hablemos de tu negocio <span aria-hidden="true">↗</span></span>
              </a>
              <span className="pf-contacto-nombre">WhatsApp</span><span className="pf-contacto-dato">{WHATSAPP_VISIBLE}</span>
            </div>
            <div className="pf-contacto">
              <a className="pf-capsula" href="mailto:hola@divianco.app" aria-label="Enviar email a hola@divianco.app">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 6 8 7 8-7" /></svg><span className="pf-mensaje">hola@divianco.app</span>
              </a>
              <span className="pf-contacto-nombre">Email</span>
              <div className="pf-contacto-dato pf-email-dato"><span>hola@divianco.app</span><button className="pf-copiar" type="button" aria-label="Copiar email" onClick={async () => { try { await navigator.clipboard.writeText('hola@divianco.app'); setCopiaEmail('Email copiado'); } catch { setCopiaEmail('No se pudo copiar. Usá hola@divianco.app.'); } }}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg></button></div>
              <span className="pf-copia-estado" role="status">{copiaEmail}</span>
            </div>
          </div>
          <a className="pf-agenda" href={AGENDA_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('agenda')}>Agendar una reunión <span aria-hidden="true">↗</span></a>
          <p className="pf-horarios"><span>WhatsApp: {WHATSAPP_HORARIO}.</span><span>Reuniones: {AGENDA_HORARIO}.</span></p>
          <div className="pf-legales">{['Términos y condiciones', 'Política de privacidad', 'Preferencias de cookies'].map(texto => <button key={texto} type="button" disabled title="Pendiente de publicación">{texto}</button>)}<span className="pf-legal-pendiente">Textos legales pendientes de publicación.</span></div>
          <p className="pf-copyright">© {new Date().getFullYear()} Grupo Divianco. Todos los derechos reservados.</p>
        </div>
        <div className="pf-logo" aria-hidden="true">
          {/* Contornos trazados del logo original; el viewBox corta debajo de los ojos. */}
          <svg viewBox="24 30 1320 244" fill="none" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" focusable="false">
            <path d="M40 40H260C364 40 420 115 420 220C420 330 364 400 260 400H40V160H116V318H260C310 318 338 290 338 220C338 150 310 124 260 124H40Z" />
            <path d="M472 40H544V400H472Z" />
            <path d="M952 40H766C656 40 598 112 598 220C598 330 656 400 766 400H952V318H766C708 318 682 288 682 220C682 152 708 124 766 124H952Z" />
            <circle cx="1148" cy="226" r="188" /><circle cx="1148" cy="226" r="140" />
            <ellipse cx="1110" cy="223" rx="19" ry="33" /><ellipse cx="1185" cy="223" rx="19" ry="33" />
          </svg>
        </div>
      </footer>
    </>
  );
}
