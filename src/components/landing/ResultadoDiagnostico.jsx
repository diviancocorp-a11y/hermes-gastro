import { planRecomendado, paramsDelAlta } from '../../lib/diagnostico';
import { PLANES_COMERCIALES, pesosDelPlan, precioDelPeriodo } from '../../lib/planesPlataforma';
import { presentacionDelDiagnostico, motivoDelPlan, herramientasDelDiagnostico } from '../../lib/resultadoDiagnostico';

const TRAZOS = {
  rentabilidad: 'M5 20V13m7 7V8m7 12V3', ventas: 'M5 20V13m7 7V8m7 12V3',
  sistema: 'M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3Zm0 0v12c0 2-4 3-8 3s-8-1-8-3V6m0 6c0 2 4 3 8 3s8-1 8-3',
  locales: 'M3 10V6l2-3h14l2 3v4M4 10v11h16V10M9 21v-7h6v7M3 10c1 2 4 2 5 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 5 0',
  turnos: 'M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16m-11 5h2m2 0h2',
  agenda: 'M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16m-11 5h2m2 0h2',
  stock: 'm3 7 9-4 9 4-9 5Zm0 0v10l9 4 9-4V7m-9 5v9',
  equipo: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M12 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4-2a3 3 0 0 1 0 6m6 11v-3a4 4 0 0 0-3-4',
};
function Icono({ tipo }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={TRAZOS[tipo] || 'M5 3h14v18H5Zm4 5h6m-6 4h6m-6 4h4'} /></svg>;
}

export default function ResultadoDiagnostico({ sol, respuestas, id, guardado, onReintentar, encabezado, resumen }) {
  const plan = PLANES_COMERCIALES.find(p => p.id === planRecomendado(respuestas));
  const anual = plan.anualPorMes !== null ? precioDelPeriodo(plan, true) : null;
  const herramientas = herramientasDelDiagnostico(respuestas);
  const { primerPaso, hallazgos } = presentacionDelDiagnostico(respuestas);
  const operaEnLocal = respuestas.canales.some(c => ['salon', 'mostrador'].includes(c));
  const beneficios = plan.incluye.filter(b => b !== 'Caja y arqueo' || operaEnLocal).slice(0, 3);
  const alcance = respuestas.desafio === 'mermas_caja' && !operaEnLocal
    ? 'Podés registrar compras y existencias en Dico. Revisamos con vos qué controles de cobro corresponden a tu forma de operar.'
    : sol.hoy;
  const alta = new URLSearchParams(paramsDelAlta(respuestas, id));
  alta.set('plan', plan.id);
  const landing = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app') ? '/landing' : '/';

  return <div className="dg-resultado-grilla">
    <div className="dg-resultado-texto">
      {encabezado}
      <p className="dg-resultado-intro">Según tus respuestas, este sería nuestro punto de partida para ayudarte a ordenar tu negocio.</p>
      <section className="dg-resultado-seccion" aria-labelledby="dg-hallazgos">
        <h2 className="dg-resultado-subtitulo" id="dg-hallazgos"><span aria-hidden="true">01</span>Lo que entendimos</h2>
        <ul className="dg-resultado-hallazgos">{hallazgos.map(h => <li key={h.titulo}><Icono tipo={h.icono} /><div><h3>{h.titulo}</h3><p>{h.texto}</p></div></li>)}</ul>
      </section>
      <section className="dg-resultado-seccion" aria-labelledby="dg-primer-paso">
        <h2 className="dg-resultado-subtitulo" id="dg-primer-paso"><span aria-hidden="true">02</span>Por dónde empezar</h2>
        <p className="dg-resultado-parrafo">{primerPaso}</p>
        <ul className="dg-resultado-herramientas">{herramientas.map(h => <li key={h.id}><Icono tipo={h.id} />{h.nombre}</li>)}</ul>
        <div className="dg-resultado-alcance"><h3>Qué está disponible hoy</h3><p>{alcance}</p>{sol.pendiente && <p><strong>En desarrollo:</strong> {sol.pendiente}</p>}{respuestas.vertical === 'otro' && <p>Primero confirmamos con vos el alcance para tu actividad.</p>}</div>
      </section>
      <p className="dg-resultado-nota">Orientación basada en tus respuestas. No estima pérdidas ni promete ahorros.</p>
      {guardado === 'error' && <p className="dg-resultado-nota" role="status">No pudimos guardar el diagnóstico. Tu resultado sigue disponible. <button type="button" className="dg-texto-boton" onClick={onReintentar}>Reintentar guardado</button></p>}
      <div className="dg-resultado-resumen">{resumen}</div>
    </div>
    <aside className="dg-plan-recomendado" aria-labelledby="dg-plan-nombre">
      <div className="dg-plan-distincion"><span className="dg-plan-orden" aria-hidden="true">03</span><p>Recomendado para tu negocio</p></div>
      <h2 id="dg-plan-nombre">{plan.nombre}</h2>
      <p className="dg-plan-descripcion">{plan.descripcion}</p>
      <p className="dg-plan-importe">{pesosDelPlan(plan.mensual)}<span>/mes por local</span></p>
      <p className="dg-plan-condiciones">Pago mensual · Sin IVA</p>
      <ul className="dg-plan-beneficios">{beneficios.map(b => <li key={b}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m7 12 3 3 7-7" /></svg>{b}</li>)}</ul>
      <div className="dg-plan-motivo"><h3>Por qué este plan</h3><p>{motivoDelPlan(respuestas)}</p></div>
      <a className="dg-plan-empezar" href={`/registro?${alta}`}>Empezar con Dico <span aria-hidden="true">→</span></a>
      <p className="dg-plan-aclaracion">Crear tu cuenta no contrata una suscripción ni realiza un cobro.</p>
      {anual && <details className="dg-plan-anual"><summary>Alternativa con pago anual</summary><p>{pesosDelPlan(anual.importe)} al año por local. Equivale a {pesosDelPlan(anual.equivalente)} por mes. Sin IVA.</p></details>}
      <a className="dg-plan-comparar" href={`${landing}#precios`} target="_blank" rel="noopener noreferrer">Comparar planes <span aria-hidden="true">↗</span><span className="pl-oculto"> (abre en otra pestaña)</span></a>
    </aside>
  </div>;
}
