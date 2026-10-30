import { useState } from 'react';
import { PLANES, planRecomendado, paramsDelAlta, guardarContactoDiagnostico, normalizarWhatsapp } from '../../lib/diagnostico';
import { hallazgosDelDiagnostico, herramientasDelDiagnostico } from '../../lib/resultadoDiagnostico';

export default function ResultadoDiagnostico({ sol, respuestas, id, token, guardado, onReintentar, onContactoGuardado }) {
  const plan = PLANES[planRecomendado(respuestas)];
  const herramientas = herramientasDelDiagnostico(respuestas);
  return <div className="pl-split-col dg-res-cuerpo dg-entra">
    <section className="dg-bloque" aria-labelledby="dg-prioridad"><h2 className="dg-bloque-titulo" id="dg-prioridad">Tu prioridad</h2><p className="dg-dolor">{sol.titulo}</p></section>
    <section className="dg-bloque" aria-labelledby="dg-hallazgos"><h2 className="dg-bloque-titulo" id="dg-hallazgos">Lo que encontramos</h2><ul className="dg-hallazgos">{hallazgosDelDiagnostico(respuestas).map(texto => <li key={texto}>{texto}</li>)}</ul><p className="dg-parrafo dg-suave">Esta orientación se basa en tus respuestas. No estima pérdidas ni promete ahorros.</p></section>
    <section className="dg-bloque" aria-labelledby="dg-primer-paso"><h2 className="dg-bloque-titulo" id="dg-primer-paso">Tu primer paso con Dico</h2><p className="dg-parrafo">{sol.hoy}</p>{sol.pendiente && <p className="dg-parrafo dg-suave">En desarrollo: {sol.pendiente}</p>}<p className="dg-parrafo">Al configurar tu negocio empezamos por:</p><ul className="dg-herramientas">{herramientas.map(h => <li key={h.id}>{h.nombre}</li>)}</ul><p className="dg-plan-linea"><span>{plan.nombre}</span><span>{plan.precio}</span></p><p className="dg-parrafo dg-suave">{plan.detalle}</p><p className="dg-parrafo">Crear tu cuenta no contrata una suscripción ni realiza un cobro.</p><div className="dg-cierre"><a className="pl-boton" href={`/registro?${paramsDelAlta(respuestas, id)}`}>Crear mi cuenta</a></div></section>
    <section className="dg-bloque" aria-labelledby="dg-contacto"><h2 className="dg-bloque-titulo" id="dg-contacto">¿Querés recibir este diagnóstico por WhatsApp?</h2><p className="dg-parrafo">Te lo mandamos por WhatsApp y te ayudamos a configurar Dico. Es opcional; ya podés leer tu resultado completo.</p><ContactoDiagnostico key={JSON.stringify(respuestas)} id={id} token={token} guardado={guardado} onGuardado={onContactoGuardado} /></section>
    {guardado === 'error' && <p className="dg-parrafo dg-guardado" role="status">No pudimos guardar el diagnóstico. Tu resultado sigue disponible. <button type="button" className="dg-texto-boton" onClick={onReintentar}>Reintentar guardado</button></p>}
  </div>;
}

function ContactoDiagnostico({ id, token, guardado, onGuardado }) {
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [errores, setErrores] = useState({});
  const [estado, setEstado] = useState('nada');
  const enviar = async evento => {
    evento.preventDefault();
    if (estado === 'enviando') return;
    const numero = normalizarWhatsapp(whatsapp);
    const erroresNuevos = { ...(nombre.trim().length < 2 ? { nombre: 'Escribí tu nombre (al menos dos letras).' } : {}), ...(!numero ? { whatsapp: 'Incluí el código de país, por ejemplo +54 9 11 1234 5678.' } : {}), ...(!consentimiento ? { consentimiento: 'Necesitamos tu autorización para contactarte por WhatsApp.' } : {}) };
    setErrores(erroresNuevos);
    if (Object.keys(erroresNuevos).length) {
      const selector = erroresNuevos.nombre ? '#dg-contacto-nombre' : erroresNuevos.whatsapp ? '#dg-contacto-whatsapp' : '.dg-consentimiento input';
      evento.currentTarget.querySelector(selector)?.focus();
      return;
    }
    if (!id || !token) return;
    setEstado('enviando');
    const ok = await guardarContactoDiagnostico({ id, token, nombre: nombre.trim(), whatsapp: numero, consentimiento });
    setEstado(ok ? 'ok' : 'error');
    if (ok) onGuardado();
  };
  if (estado === 'ok') return <p className="dg-contacto-ok" role="status">Recibimos tu pedido. Te contactaremos por WhatsApp para enviarte el diagnóstico y ayudarte con la configuración.</p>;
  return <form className="dg-contacto-form" onSubmit={enviar} noValidate>
    <label htmlFor="dg-contacto-nombre">Tu nombre<input id="dg-contacto-nombre" className="dg-texto" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} autoComplete="given-name" aria-invalid={Boolean(errores.nombre)} aria-describedby={errores.nombre ? 'dg-error-nombre' : undefined} /></label>{errores.nombre && <p id="dg-error-nombre" className="dg-error-campo">{errores.nombre}</p>}
    <label htmlFor="dg-contacto-whatsapp">Tu WhatsApp<input id="dg-contacto-whatsapp" className="dg-texto" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} maxLength={24} autoComplete="tel" placeholder="+54 9 11 1234 5678" aria-invalid={Boolean(errores.whatsapp)} aria-describedby={errores.whatsapp ? 'dg-error-whatsapp' : undefined} /></label>{errores.whatsapp && <p id="dg-error-whatsapp" className="dg-error-campo">{errores.whatsapp}</p>}
    <label className="dg-consentimiento"><input type="checkbox" checked={consentimiento} onChange={e => setConsentimiento(e.target.checked)} />Autorizo que Grupo Divianco me contacte por WhatsApp para enviarme este diagnóstico y ayudarme a configurar Dico.</label>{errores.consentimiento && <p className="dg-error-campo">{errores.consentimiento}</p>}
    <button className="dg-boton" type="submit" disabled={estado === 'enviando' || guardado !== 'ok' || !token}>{estado === 'enviando' ? 'Guardando…' : 'Solicitar envío por WhatsApp'}</button>
    {guardado === 'guardando' && <p role="status">Guardando tu diagnóstico…</p>}{estado === 'error' && <p className="dg-error-campo" role="alert">No pudimos guardar tu contacto. Tus datos siguen acá para reintentar.</p>}
  </form>;
}
