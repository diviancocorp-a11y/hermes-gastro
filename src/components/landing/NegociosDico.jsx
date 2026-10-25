import { NEGOCIOS } from './clientes';
import '../../styles/negocios-dico.css';

export default function NegociosDico() {
  return (
    <section className="nc-root" id="negocios" aria-labelledby="nc-titulo">
      <h2 id="nc-titulo">Negocios que ya usan Dico</h2>
      <div className="nc-deslizable" role="region" aria-label="Negocios que usan Dico. Deslizá para ver todos." tabIndex={0}>
        <ul className="nc-fila">
          {NEGOCIOS.map(negocio => (
            <li key={negocio.logo}>
              <a className="nc-negocio" href={`https://www.instagram.com/${negocio.instagram}/`}
                target="_blank" rel="noopener noreferrer" aria-label={`${negocio.nombre}: ver Instagram (abre en otra pestaña)`}>
                <img src={`/brand/landing/clientes/${negocio.logo}.webp`} alt="" width="72" height="72" loading="lazy" />
                <span className="nc-nombre">{negocio.nombre}</span>
                <span className="nc-destino" aria-hidden="true">Ver Instagram <svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" /></svg></span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
