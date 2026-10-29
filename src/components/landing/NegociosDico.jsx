import { NEGOCIOS } from './clientes';
import '../../styles/negocios-dico.css';

export default function NegociosDico() {
  return (
    <section className="nc-root" id="negocios" aria-labelledby="nc-titulo">
      <h2 id="nc-titulo">Negocios que ya usan <span>Dico</span></h2>
      <div className="nc-panel">
      <div className="nc-deslizable" role="region" aria-label="Negocios que usan Dico. Deslizá para ver todos." tabIndex={0}>
        <ul className="nc-fila">
          {NEGOCIOS.map(negocio => (
            <li key={negocio.logo}>
              <a className="nc-negocio" href={`https://www.instagram.com/${negocio.instagram}/`}
                target="_blank" rel="noopener noreferrer" aria-label={`${negocio.nombre}: ver Instagram (abre en otra pestaña)`}>
                <span className="nc-burbuja"><img src={`/brand/landing/clientes/${negocio.logo}.webp`} alt="" width="48" height="48" loading="lazy" /></span>
                <span className="nc-nombre">{negocio.nombre}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </section>
  );
}
