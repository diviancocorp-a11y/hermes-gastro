import { useEffect, useRef, useState } from 'react';
import '../../styles/navegacion-landing.css';

const SECCIONES = [
  ['rubros', 'Tu rubro'],
  ['como-empezar', 'Acompañamiento'],
  ['precios', 'Planes'],
  ['preguntas', 'Preguntale a Dico'],
];

export default function NavegacionLanding({ raizRef, oculta, onDiagnostico }) {
  const [visible, setVisible] = useState(false);
  const [activa, setActiva] = useState('');
  const progresoRef = useRef(null);

  useEffect(() => {
    if (oculta) return undefined;
    const raiz = raizRef.current;
    const hero = raiz?.querySelector('.pl-hero');
    if (!raiz || !hero) return undefined;
    const secciones = SECCIONES.map(([id]) => raiz.querySelector(`#${id}`));
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      setVisible(hero.getBoundingClientRect().bottom <= 0);
      const limite = document.documentElement.scrollHeight - window.innerHeight;
      const avance = limite > 0 ? Math.min(1, Math.max(0, window.scrollY / limite)) : 0;
      if (progresoRef.current) progresoRef.current.style.transform = `scaleX(${avance})`;
      const umbral = window.innerHeight * .35;
      let actual = '';
      secciones.forEach((seccion, indice) => {
        if (seccion && seccion.getBoundingClientRect().top <= umbral) actual = SECCIONES[indice][0];
      });
      setActiva(actual);
    };
    const programar = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(programar) : null;
    observador?.observe(raiz);
    window.addEventListener('scroll', programar, { passive: true });
    window.addEventListener('resize', programar);
    medir();
    return () => {
      cancelAnimationFrame(cuadro);
      observador?.disconnect();
      window.removeEventListener('scroll', programar);
      window.removeEventListener('resize', programar);
    };
  }, [raizRef, oculta]);

  const mostrar = visible && !oculta;
  return <header className="nl-root" data-visible={mostrar} inert={!mostrar} aria-hidden={!mostrar}>
    <div className="nl-contenido">
      <a className="nl-marca" href="#main-content" aria-label="Dico, volver al inicio">
        <img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
      </a>
      <nav className="nl-enlaces" aria-label="Secciones de la landing">
        {SECCIONES.map(([id, nombre]) => <a key={id} href={`#${id}`} aria-current={activa === id ? 'location' : undefined}>{nombre}</a>)}
      </nav>
      <button type="button" className="nl-accion" onClick={onDiagnostico} aria-label="Empezar mi diagnóstico"><span className="nl-accion-larga">Empezar mi diagnóstico</span><span className="nl-accion-corta" aria-hidden="true">Diagnóstico</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
    </div>
    <div className="nl-progreso" aria-hidden="true"><span ref={progresoRef} /></div>
  </header>;
}
