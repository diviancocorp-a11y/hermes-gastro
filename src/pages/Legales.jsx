// src/pages/Legales.jsx
// /terminos y /privacidad de la plataforma (divianco.app). El texto vive en
// src/lib/textosLegales.js; esta pagina solo lo pone en pantalla: cabecera de
// la landing, indice y una columna de lectura en el fondo claro.

import { useEffect } from 'react';
import { cargarAnalitica } from '../lib/analiticaPlataforma';
import { VIGENCIA, EMAIL_LEGAL, LEGALES } from '../lib/textosLegales';
import '../styles/plataforma-claro.css';
import '../styles/platform-landing.css';
import '../styles/legales.css';

export default function Legales({ ruta }) {
  const documento = LEGALES.find(d => d.ruta === ruta) || LEGALES[0];
  const otro = LEGALES.find(d => d !== documento);

  useEffect(() => {
    const tituloPrevio = document.title;
    document.title = `${documento.titulo} — Dico`;
    const meta = document.head.querySelector('meta[name="description"]');
    const descripcionPrevia = meta?.getAttribute('content');
    if (meta) meta.setAttribute('content', documento.descripcion);
    cargarAnalitica();

    // El chunk llega despues de que el navegador busco el #ancla (/privacidad#cookies).
    const ancla = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (ancla) ancla.scrollIntoView();

    const raiz = document.documentElement;
    const esquemaPrevio = raiz.style.colorScheme;
    raiz.style.colorScheme = 'light';
    return () => {
      raiz.style.colorScheme = esquemaPrevio;
      document.title = tituloPrevio;
      if (meta && descripcionPrevia != null) meta.setAttribute('content', descripcionPrevia);
    };
  }, [documento]);

  return (
    <div className="pl-root lg-pagina">
      <header className="pl-cabecera lg-cabecera">
        <a className="pl-marca" href="/">
          <img src="/brand/dico/logo/dico-claro.png" alt="Dico" width="1368" height="452" />
        </a>
        <a className="pl-enlace pl-cabecera-link" href="/#precios">Planes</a>
      </header>
      <article className="lg-documento" aria-labelledby="lg-titulo">
        <h1 id="lg-titulo" className="lg-titulo">{documento.titulo}</h1>
        <p className="lg-vigencia">Vigente desde el {VIGENCIA}.</p>
        <nav className="lg-indice" aria-label="Contenido">
          <ol>{documento.secciones.map(s => <li key={s.id}><a href={`#${s.id}`}>{s.titulo}</a></li>)}</ol>
        </nav>
        {documento.secciones.map(s => (
          <section className="lg-seccion" id={s.id} key={s.id} aria-labelledby={`lg-${s.id}`}>
            <h2 id={`lg-${s.id}`}>{s.titulo}</h2>
            {s.intro && <p>{s.intro}</p>}
            {s.lista && <ul>{s.lista.map(item => <li key={item}>{item}</li>)}</ul>}
            {s.parrafos?.map(p => <p key={p}>{p}</p>)}
          </section>
        ))}
        <footer className="lg-pie">
          <p>¿Dudas sobre este texto? Escribinos a <a href={`mailto:${EMAIL_LEGAL}`}>{EMAIL_LEGAL}</a>.</p>
          <nav className="lg-pie-nav" aria-label="Más textos"><a href={otro.ruta}>{otro.titulo}</a><a href="/">Volver a Dico</a></nav>
        </footer>
      </article>
    </div>
  );
}
