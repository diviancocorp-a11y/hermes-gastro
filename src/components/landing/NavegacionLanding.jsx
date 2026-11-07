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
  const enlacesRef = useRef(null);
  // En el telefono los enlaces no entran: se deslizan. El borde que tiene mas
  // contenido se desvanece (data-mas-*), asi se lee que la fila sigue.
  const [mas, setMas] = useState({ izq: false, der: false });

  useEffect(() => {
    const fila = enlacesRef.current;
    if (!fila) return undefined;
    const medir = () => {
      const resto = fila.scrollWidth - fila.clientWidth - fila.scrollLeft;
      const izq = fila.scrollLeft > 1;
      const der = resto > 1;
      setMas(previo => previo.izq === izq && previo.der === der ? previo : { izq, der });
    };
    medir();
    // La fuente propia puede cambiar el ancho de la fila sin cambiar su caja.
    document.fonts?.ready.then(medir);
    fila.addEventListener('scroll', medir, { passive: true });
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    observador?.observe(fila);
    window.addEventListener('resize', medir);
    return () => {
      fila.removeEventListener('scroll', medir);
      observador?.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, []);

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
        <img src="/brand/dico/logo/dico-oscuro-400.webp" alt="Dico" width="400" height="132" />
      </a>
      <nav className="nl-enlaces" ref={enlacesRef} data-mas-izq={mas.izq} data-mas-der={mas.der} aria-label="Secciones de la landing">
        {SECCIONES.map(([id, nombre]) => <a key={id} href={`#${id}`} aria-current={activa === id ? 'location' : undefined}>{nombre}</a>)}
      </nav>
      <button type="button" className="nl-accion" onClick={onDiagnostico} aria-label="Empezar mi diagnóstico"><span className="nl-accion-larga">Empezar mi diagnóstico</span><span className="nl-accion-corta" aria-hidden="true">Diagnóstico</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
    </div>
    <div className="nl-progreso" aria-hidden="true"><span ref={progresoRef} /></div>
  </header>;
}
