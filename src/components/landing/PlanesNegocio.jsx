import { useLayoutEffect, useRef, useState } from 'react';
import { PLANES_COMERCIALES, pesosDelPlan, precioDelPeriodo } from '../../lib/planesPlataforma';
import '../../styles/planes-negocio.css';

function Importe({ valor }) {
  const texto = useRef(null);
  const actual = useRef(valor);
  useLayoutEffect(() => {
    const nodo = texto.current;
    if (!nodo) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || actual.current === valor) {
      actual.current = valor;
      nodo.textContent = pesosDelPlan(valor);
      return undefined;
    }
    const desde = actual.current;
    const inicio = performance.now();
    let cuadro;
    const dibujar = ahora => {
      const avance = Math.min(1, (ahora - inicio) / 280);
      actual.current = Math.round(desde + (valor - desde) * (1 - (1 - avance) ** 3));
      nodo.textContent = pesosDelPlan(actual.current);
      if (avance < 1) cuadro = requestAnimationFrame(dibujar);
    };
    nodo.textContent = pesosDelPlan(desde);
    cuadro = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(cuadro);
  }, [valor]);
  return <><span className="pl-oculto">{pesosDelPlan(valor)}</span><span aria-hidden="true" ref={texto}>{pesosDelPlan(valor)}</span></>;
}

export default function PlanesNegocio({ onDiagnostico }) {
  const [anual, setAnual] = useState(false);
  return (
    <section className="pp-root" id="precios" aria-labelledby="pp-titulo">
      <div className="pp-dentro">
        <header className="pp-cabecera">
          <h2 id="pp-titulo">Un plan para cada etapa.</h2>
          <p>Compará planes y formas de pago.</p>
        </header>
        <fieldset className="pp-periodo">
          <legend className="pl-oculto">Período de pago</legend>
          <label><input type="radio" name="periodo-plan" checked={!anual} onChange={() => setAnual(false)} /><span>Mensual</span></label>
          <label><input type="radio" name="periodo-plan" checked={anual} onChange={() => setAnual(true)} /><span>Anual</span></label>
        </fieldset>
        <p className="pp-ahorro">Local y Cadena: 20% menos con pago anual.</p>
        <div className="pp-planes">
          {PLANES_COMERCIALES.map(plan => {
            const precio = precioDelPeriodo(plan, anual);
            return (
              <article className="pp-plan" key={plan.id} aria-labelledby={`pp-${plan.id}`}>
                <p className="pp-para">{plan.para}</p>
                <h3 id={`pp-${plan.id}`}>{plan.nombre}</h3>
                <p className="pp-descripcion">{plan.descripcion}</p>
                <div className="pp-precio">
                  <p className="pp-importe"><Importe valor={precio.importe} /><span className="pp-unidad">/{precio.periodo}</span></p>
                  <p className="pp-equivalente">{precio.equivalente !== null ? `${pesosDelPlan(precio.equivalente)} por mes · Un pago anual` : plan.anualPorMes === null ? 'Solo pago mensual' : 'Pago mensual'}</p>
                  <p className="pp-por-local">Por local · Sin IVA</p>
                </div>
                <ul className="pp-incluye">{plan.incluye.map(item => <li key={item}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>{item}</li>)}</ul>
              </article>
            );
          })}
        </div>
        <div className="pp-condiciones"><p>Precios en pesos argentinos, por local y sin IVA. Sin cargo por usuario ni por pedido.</p><p>Funciones disponibles según el rubro. Facturación electrónica ARCA en desarrollo.</p></div>
        <div className="pp-accion">
          <button type="button" className="pl-boton pp-boton" onClick={onDiagnostico}>Encontrar mi plan <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span></button>
          <a href="/registro" className="pl-enlace">Crear mi cuenta sin diagnóstico</a>
          <p>Comparar precios no contrata un plan ni realiza ningún cobro.</p>
        </div>
      </div>
    </section>
  );
}
