// src/pages/Diagnostico.jsx
// /diagnostico: el diagnostico de la landing como pagina propia. La usan la
// landing vieja y los links de afuera (con ?vertical=<id> arranca en la
// segunda pregunta). La home lo abre en el lugar, sin venir aca.
//
// Todo el embudo (pasos, ficha, resultado, guardado, history) vive en
// src/components/landing/Diagnostico.jsx; esta pagina pone la cabecera, el
// titulo de la pestania, la analitica y, debajo, quienes ya usan Dico (los
// mismos negocios y fotos de la landing).

import { useEffect, useRef } from 'react';
import { cargarAnalitica } from '../lib/analiticaPlataforma';
import Embudo from '../components/landing/Diagnostico';
import { FOTOS } from '../components/landing/clientes';
import useEntradas from '../components/landing/useEntradas';
import '../styles/plataforma-claro.css';
import '../styles/platform-landing.css';
import '../styles/diagnostico.css';

const TITULO = 'Diagnóstico de tu negocio — Dico';
const DESCRIPCION = 'Unas pocas preguntas sobre tu negocio, sin email, y Dico te dice qué '
  + 'resolver primero, cómo lo resuelve y qué plan te conviene.';

export default function Diagnostico() {
  const raizRef = useRef(null);
  useEntradas(raizRef);

  useEffect(() => {
    document.title = TITULO;
    const meta = document.head.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', DESCRIPCION);
    cargarAnalitica();

    const raiz = document.documentElement;
    const esquemaPrevio = raiz.style.colorScheme;
    raiz.style.colorScheme = 'light';
    return () => { raiz.style.colorScheme = esquemaPrevio; };
  }, []);

  return (
    <div className="pl-root dg-pagina" ref={raizRef}>
      <header className="pl-cabecera">
        <a className="pl-marca" href="/">
          <img src="/brand/dico/logo/dico-claro.png" alt="Dico" width="1368" height="452" />
        </a>
        <a className="pl-enlace pl-cabecera-link" href="/#rubros">Qué hace Dico</a>
      </header>
      <Embudo modo="pagina" nivel="h1" />
      <section className="pl-seccion dg-confian" aria-labelledby="dg-confian-titulo">
        <h2 id="dg-confian-titulo" className="pl-h2 dg-confian-titulo" data-reveal>Ya trabajan con Dico</h2>
        <p className="dg-parrafo dg-confian-texto" data-reveal="1">
          La Nona Pato, panadería, y Crazy Miga, cookies con delivery en Zona
          Norte, venden con Dico. Estos son algunos de sus productos.
        </p>
        <div className="pl-fotos">
          {FOTOS.map((f, i) => (
            <figure className="pl-foto" key={f.src} data-reveal={(i % 3) + 1}>
              <span className="pl-foto-marco">
                <img src={f.src} alt={f.alt} width={f.ancho} height={f.alto} loading="lazy" />
              </span>
              <figcaption>{f.pie}, de {f.de}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <footer className="pl-pie dg-pie">
        <p className="pl-pie-que">Dico, de Grupo Divianco. Buenos Aires.</p>
        <p className="pl-pie-links">
          <a className="pl-enlace" href="/">Inicio</a>
          <a className="pl-enlace" href="/entrar">Entrar</a>
        </p>
        <p className="pl-pie-legal">Fotos: productos de La Nona Pato y Crazy Miga.</p>
      </footer>
    </div>
  );
}
