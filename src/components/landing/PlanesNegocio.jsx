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

function seguirBorde(evento) {
  if (evento.pointerType !== 'mouse') return;
  const tarjeta = evento.currentTarget;
  const rect = tarjeta.getBoundingClientRect();
  tarjeta.style.setProperty('--pp-x', `${evento.clientX - rect.left}px`);
  tarjeta.style.setProperty('--pp-y', `${evento.clientY - rect.top}px`);
}

function soltarBorde(evento) {
  evento.currentTarget.style.removeProperty('--pp-x');
  evento.currentTarget.style.removeProperty('--pp-y');
}

function Beneficios({ items }) {
  return <ul className="pp-incluye">{items.map(item => <li key={item}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>{item}</li>)}</ul>;
}

export default function PlanesNegocio({ onDiagnostico }) {
  const [anual, setAnual] = useState(false);
  return (
    <section className="pp-root" id="precios" aria-labelledby="pp-titulo">
      <div className="pp-dentro">
        <header className="pp-cabecera">
          <h2 id="pp-titulo">Un plan para cada etapa.</h2>
          <p>Elegí cómo querés empezar.</p>
        </header>
        <fieldset className="pp-periodo">
          <legend className="pl-oculto">Período de pago</legend>
          <label><input type="radio" name="periodo-plan" checked={!anual} onChange={() => setAnual(false)} /><span>Mensual</span></label>
          <label><input type="radio" name="periodo-plan" checked={anual} onChange={() => setAnual(true)} /><span>Anual</span></label>
        </fieldset>
        <p className="pp-ahorro">20% menos en Local y Cadena con pago anual.</p>
        <div className="pp-planes">
          {PLANES_COMERCIALES.map(plan => {
            const precio = precioDelPeriodo(plan, anual);
            return (
              <article className="pp-plan" key={plan.id} aria-labelledby={`pp-${plan.id}`} onPointerMove={seguirBorde} onPointerLeave={soltarBorde}>
                <p className="pp-para">{plan.para}</p>
                <div className="pp-nombre"><h3 id={`pp-${plan.id}`}>{plan.nombre}</h3>{precio.equivalente !== null && <span className="pp-descuento" aria-label="20% menos respecto al pago mensual">−20%</span>}</div>
                <p className="pp-descripcion">{plan.descripcion}</p>
                <div className="pp-precio">
                  <p className="pp-importe"><Importe valor={precio.equivalente ?? precio.importe} /><span className="pp-unidad">/mes</span></p>
                  <p className="pp-equivalente">{precio.equivalente !== null ? 'Equivalente mensual · Pago anual' : plan.anualPorMes === null ? 'Solo pago mensual' : 'Pago mensual'}</p>
                  <p className="pp-por-local">{precio.equivalente !== null ? `${pesosDelPlan(precio.importe)} al año · ` : ''}Por local · Sin IVA</p>
                </div>
                <Beneficios items={plan.incluye.slice(0, 3)} />
                <button type="button" className="pp-elegir" onClick={onDiagnostico}>Elegir {plan.nombre} <span aria-hidden="true">→</span></button>
              </article>
            );
          })}
        </div>
        <details className="pp-comparar">
          <summary>Comparar todas las funciones <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
          <div className="pp-comparacion">{PLANES_COMERCIALES.map(plan => <section key={plan.id} aria-labelledby={`pp-comparar-${plan.id}`}><h3 id={`pp-comparar-${plan.id}`}>{plan.nombre}</h3><Beneficios items={plan.incluye} /></section>)}</div>
        </details>
        <div className="pp-condiciones"><p>Precios en pesos argentinos, por local y sin IVA. Sin cargo por usuario ni por pedido.</p><p>Funciones disponibles según el rubro. Facturación electrónica ARCA en desarrollo.</p></div>
        <div className="pp-accion">
          <button type="button" className="pl-boton pp-boton" onClick={onDiagnostico}>Encontrar mi plan <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span></button>
          <a href="/registro" className="pl-enlace">Crear mi cuenta sin diagnóstico</a>
          <p>Los botones de los planes abren el diagnóstico. No realizan ningún cobro.</p>
        </div>
      </div>
    </section>
  );
}
