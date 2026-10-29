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
  if (evento.pointerType === 'touch') return;
  const tarjeta = evento.currentTarget;
  const rect = tarjeta.getBoundingClientRect();
  tarjeta.dataset.puntero = 'true';
  tarjeta.style.setProperty('--pp-x', `${evento.clientX - rect.left}px`);
  tarjeta.style.setProperty('--pp-y', `${evento.clientY - rect.top}px`);
}

function soltarBorde(evento) {
  delete evento.currentTarget.dataset.puntero;
  evento.currentTarget.style.removeProperty('--pp-x');
  evento.currentTarget.style.removeProperty('--pp-y');
}

// La comparativa reutiliza la oferta actual; su alcance final queda pendiente.
const COMPARACION_PLANES = PLANES_COMERCIALES.reduce((planes, plan) => {
  const herencia = plan.incluye.find(texto => texto.startsWith('Todo lo de '));
  const base = planes.find(anterior => herencia === `Todo lo de ${anterior.nombre}`);
  const funciones = new Set([...(base?.funciones ?? []), ...plan.incluye.filter(texto => !texto.startsWith('Todo lo de '))]);
  return [...planes, { id: plan.id, nombre: plan.nombre, funciones }];
}, []);
const FUNCIONES_COMPARADAS = [...new Set(COMPARACION_PLANES.flatMap(plan => [...plan.funciones]))];

const DESCRIPCIONES = {
  digital: 'Tu negocio online y su gestión diaria.',
  local: 'La operación de un local, con soporte.',
  cadena: 'Varias sucursales, una mirada conjunta.',
};

function IconoPlan({ tipo }) {
  const tienda = 'M6 12v15h20V12M11 27V18h10v9M4 12l3-7h18l3 7M4 12c0 5 8 5 8 0 0 5 8 5 8 0 0 5 8 5 8 0';
  return <span className="pp-icono" aria-hidden="true"><svg viewBox={tipo === 'cadena' ? '0 0 40 40' : '0 0 32 32'}>
    {tipo === 'digital' ? <path d="M7 6h18v16H7zM4 26h24l-3-4H7z" /> : tipo === 'local' ? <path d={tienda} /> : <><path d="M20 13v7H8v3m12-3h12v3" /><g transform="translate(13 0) scale(.44)"><path d={tienda} /></g><g transform="translate(1 23) scale(.44)"><path d={tienda} /></g><g transform="translate(25 23) scale(.44)"><path d={tienda} /></g></>}
  </svg></span>;
}

function Beneficios({ items }) {
  return <ul className="pp-incluye">{items.map(item => <li key={item}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m7 12 3 3 7-7" /></svg>{item}</li>)}</ul>;
}

export default function PlanesNegocio({ onDiagnostico }) {
  const [anual, setAnual] = useState(false);
  return (
    <section className="pp-root" data-anual={anual} id="precios" aria-labelledby="pp-titulo">
      <div className="pp-luz-fondo" aria-hidden="true" />
      <div className="pp-dentro">
        <header className="pp-cabecera" data-reveal="0">
          <span className="pp-antetitulo">Planes <span>Dico</span></span>
          <h2 id="pp-titulo">Un plan para cada etapa.</h2>
          <p>Elegí según cómo funciona tu negocio.</p>
        </header>
        <fieldset className="pp-periodo" data-reveal="1" onFocusCapture={evento => evento.currentTarget.classList.add('is-in')}>
          <legend className="pl-oculto">Período de pago</legend>
          <label><input type="radio" name="periodo-plan" checked={!anual} onChange={() => setAnual(false)} /><span>Mensual</span></label>
          <label><input type="radio" name="periodo-plan" checked={anual} onChange={() => setAnual(true)} /><span>Anual</span></label>
        </fieldset>
        <p className="pp-ahorro" data-reveal="1">20% menos en Local y Cadena con pago anual.</p>
        <div className="pp-planes">
          {PLANES_COMERCIALES.map((plan, indice) => {
            const precio = precioDelPeriodo(plan, anual);
            return (
              <article className="pp-plan" data-plan={plan.id} data-destacado={plan.id === 'local'} key={plan.id} aria-labelledby={`pp-${plan.id}`} data-reveal={indice + 2} style={{ '--pp-demora': `${320 + indice * 180}ms`, '--pp-inicio': `${15 + indice * 10}%`, '--pp-fin': `${75 + indice * 10}%` }} onPointerEnter={seguirBorde} onPointerMove={seguirBorde} onPointerLeave={soltarBorde} onFocusCapture={evento => evento.currentTarget.classList.add('is-in')}>
                <span className="pp-linea" aria-hidden="true" />
                {plan.id === 'local' && <p className="pp-destacado">Plan destacado</p>}
                <div className="pp-identidad">
                  <IconoPlan tipo={plan.id} />
                  <div className="pp-presentacion">
                    <div className="pp-nombre"><h3 id={`pp-${plan.id}`}>{plan.nombre}</h3>{precio.equivalente !== null && <span className="pp-descuento" aria-label="20% menos respecto al pago mensual">−20%</span>}</div>
                    <p className="pp-descripcion">{DESCRIPCIONES[plan.id]}</p>
                  </div>
                </div>
                <div className="pp-precio">
                  <p className="pp-importe"><Importe valor={precio.equivalente ?? precio.importe} /><span className="pp-unidad">/mes</span></p>
                  <p className="pp-equivalente">{precio.equivalente !== null ? 'Equivalente mensual · Pago anual' : plan.anualPorMes === null ? 'Solo pago mensual' : 'Pago mensual'}</p>
                  <p className="pp-por-local">{precio.equivalente !== null ? `${pesosDelPlan(precio.importe)} al año · ` : ''}Por local · Sin IVA</p>
                </div>
                <p className="pp-incluye-titulo">Lo más destacado</p>
                <Beneficios items={plan.incluye.slice(0, 3)} />
                <button type="button" className="pp-elegir" onClick={onDiagnostico}>Elegir {plan.nombre} <span aria-hidden="true">→</span></button>
              </article>
            );
          })}
        </div>
        <details className="pp-comparar">
          <summary>Comparar todas las funciones <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
          <div className="pp-comparacion">
            <div className="pp-tabla-scroll" role="region" aria-label="Comparación de funciones por plan" tabIndex={0}>
              <table className="pp-tabla">
                <caption className="pl-oculto">Las mismas funciones comparadas entre Digital, Local y Cadena</caption>
                <thead><tr><th scope="col">Funciones</th>{COMPARACION_PLANES.map(plan => <th scope="col" data-plan={plan.id} key={plan.id}>{plan.nombre}</th>)}</tr></thead>
                <tbody>{FUNCIONES_COMPARADAS.map(funcion => <tr key={funcion}>
                  <th scope="row">{funcion}</th>
                  {COMPARACION_PLANES.map(plan => <td data-plan={plan.id} key={plan.id}>
                    {plan.funciones.has(funcion) ? <><svg className="pp-tabla-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg><span className="pl-oculto">Incluido</span></> : <><span className="pp-no-incluido" aria-hidden="true">—</span><span className="pl-oculto">No incluido</span></>}
                  </td>)}
                </tr>)}</tbody>
              </table>
            </div>
            <p className="pp-comparacion-nota">Contenido de los planes en definición.</p>
          </div>
        </details>
        <p className="pp-accion">¿No sabés cuál elegir? <button type="button" className="pp-ayuda" onClick={onDiagnostico}>Hacé el diagnóstico <span aria-hidden="true">→</span></button></p>
        <div className="pp-condiciones"><p>Precios en pesos argentinos, por local y sin IVA. Sin cargo por usuario ni por pedido.</p></div>
      </div>
    </section>
  );
}
