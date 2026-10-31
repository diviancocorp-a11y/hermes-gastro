// Registro de la plataforma: cuenta primero, negocio despues.
import { useState, useEffect, useRef } from 'react';
import { slugify, validateSlug } from '../lib/slugify';
import { slugDisponible, registrarNegocio, googleDisponible, iniciarRegistroGoogle, cuentaGoogleActual, registrarNegocioConGoogle } from '../services/signup';
import { modosDisponibles, canalesSugeridos } from '../modules/registry';
import { paisesDisponibles, monedaDe, zonaDe, PAIS_POR_DEFECTO } from '../modules/paises';
import { cargarAnalitica, marcarEvento } from '../lib/analiticaPlataforma';
import { contextoDelRegistro, recordarRegistroGoogle, limpiarRegistroGoogle } from '../lib/registroPlataforma';
import { PLANES_COMERCIALES, pesosDelPlan, precioDelPeriodo } from '../lib/planesPlataforma';
import DicoPhysical from '../components/dico/DicoPhysical';
import '../styles/signup.css';

const VERTICALES = [{ id: 'gastro', nombre: 'Gastronomía' }, { id: 'retail', nombre: 'Comercio' }, { id: 'barber', nombre: 'Servicios' }];
const MODOS = modosDisponibles();
const PAISES = paisesDisponibles();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODOS_LABEL = { fisico: 'En un local', virtual: 'A distancia', hibrido: 'Ambas' };

const MENSAJES_REGISTRO = [
  { titulo: 'Tu negocio empieza acá.', texto: 'Creá tu cuenta. El primer paso para recuperar tu tiempo.', detalle: 'Una cuenta. Todo tu negocio conectado.' },
  { titulo: 'Hagamos espacio para lo que importa.', texto: 'Contanos cómo trabajás. Te acompañamos para configurar Dico.', detalle: 'Tu negocio, tu forma de trabajar.' },
  { titulo: 'Un mes para encontrar tu ritmo.', texto: 'Probá Dico con acompañamiento. Después empieza el pago del plan que elijas.', detalle: 'Primero lo conocés. Después seguís con tu plan.' },
];

function BrandPanel({ paso, negocio }) {
  const mensaje = MENSAJES_REGISTRO[paso];
  const [saludando, setSaludando] = useState(true);
  useEffect(() => { if (!saludando) return undefined; const timer = setTimeout(() => setSaludando(false), 1400); return () => clearTimeout(timer); }, [saludando]);
  return <aside className="signup-brand" data-paso={paso} aria-label="Bienvenida a Dico">
    <a href="/" className="signup-logo"><img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" /></a>
    <div className="signup-brand__message" key={paso}><h1>{mensaje.titulo}</h1><p>{mensaje.texto}</p></div>
    {paso === 1 && <div className="signup-brand__business" aria-hidden="true"><span>Tu espacio en Dico</span><strong>{negocio || 'Tu negocio'}</strong><p>Ventas · Stock · Resultados</p></div>}
    {paso === 2 && <div className="signup-brand__trial" aria-hidden="true"><strong>01</strong><span>mes de prueba</span></div>}
    <button type="button" className="signup-mascota" aria-label="Saludar a Dico" onPointerEnter={() => setSaludando(true)} onFocus={() => setSaludando(true)} onClick={() => setSaludando(true)}>
      <DicoPhysical pose="idle" animacion={saludando ? 'saluda' : null} reducedMotion={saludando ? undefined : true} ritmo={.45} title="Dico" />
    </button>
    <p className="signup-brand__caption">{mensaje.detalle}</p>
  </aside>;
}

function Campo({ label, id, error, hint, children }) {
  return <div className="signup-field"><label className="signup-label" htmlFor={id}>{label}</label>{children}{hint && <p className="signup-hint" id={`${id}-ayuda`}>{hint}</p>}{error && <p className="signup-field-error" id={`${id}-error`}>{error}</p>}</div>;
}

export default function Signup() {
  const [inicial] = useState(contextoDelRegistro);
  const [paso, setPaso] = useState(0);
  const [bizName, setBizName] = useState(inicial.bizName);
  const [slugManual, setSlug] = useState(inicial.slug || slugify(inicial.bizName));
  const [slugTocado, setSlugTocado] = useState(inicial.slugTocado);
  const [vertical, setVertical] = useState(inicial.vertical);
  const [modo, setModo] = useState(inicial.modo);
  const [country, setCountry] = useState(PAISES.some(p => p.id === inicial.country) ? inicial.country : PAIS_POR_DEFECTO);
  const [fullName, setFullName] = useState(inicial.fullName);
  const [email, setEmail] = useState(inicial.email);
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [plan, setPlan] = useState(inicial.plan);
  const [periodo, setPeriodo] = useState(inicial.periodo);
  const [cambiarPlan, setCambiarPlan] = useState(false);
  const [resultadoDispo, setResultadoDispo] = useState(null);
  const [chequeo, setChequeo] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState({});
  const [listo, setListo] = useState(false);
  const [google, setGoogle] = useState(false);
  const [cuentaGoogle, setCuentaGoogle] = useState(false);
  const [conectandoGoogle, setConectandoGoogle] = useState(() => new URLSearchParams(window.location.search).get('oauth') === 'google');
  const tituloRef = useRef(null);
  const pasoAnterior = useRef(0);
  const formRef = useRef(null);
  const slug = slugTocado ? slugManual : slugify(bizName);
  const validacionLocal = validateSlug(slug);
  const dispo = !validacionLocal.ok ? null : resultadoDispo?.slug === slug && resultadoDispo.chequeo === chequeo ? resultadoDispo.valor : 'checking';

  useEffect(() => { document.title = 'Creá tu cuenta — Dico'; cargarAnalitica(); }, []);
  useEffect(() => {
    let vigente = true;
    if (!validacionLocal.ok) return undefined;
    const timer = setTimeout(async () => {
      try { const disponible = await slugDisponible(slug); if (vigente) setResultadoDispo({ slug, chequeo, valor: disponible }); } catch { if (vigente) setResultadoDispo({ slug, chequeo, valor: null }); }
    }, 400);
    return () => { vigente = false; clearTimeout(timer); };
  }, [slug, validacionLocal.ok, chequeo]);
  useEffect(() => {
    if (pasoAnterior.current !== paso) { tituloRef.current?.focus(); pasoAnterior.current = paso; }
  }, [paso]);
  useEffect(() => {
    let vigente = true;
    googleDisponible().then(ok => { if (vigente) setGoogle(ok); });
    if (new URLSearchParams(window.location.search).get('oauth') === 'google') {
      cuentaGoogleActual().then(cuenta => {
        if (!vigente) return;
        setConectandoGoogle(false);
        if (!cuenta.ok) { setError(cuenta.error); return; }
        setCuentaGoogle(true); setEmail(cuenta.email); setFullName(nombre => nombre || cuenta.nombre); setPaso(1);
      });
    }
    return () => { vigente = false; };
  }, []);

  const cambiar = (campo, valor, setter) => { setter(valor); setErrores(anteriores => ({ ...anteriores, [campo]: null })); setError(null); };
  const validarCuenta = () => ({
    ...(fullName.trim().length < 2 ? { fullName: 'Escribí tu nombre (al menos dos caracteres).' } : {}),
    ...(!EMAIL.test(email) ? { email: 'Escribí un email válido.' } : {}),
    ...(!cuentaGoogle && password.length < 8 ? { password: 'Usá al menos 8 caracteres.' } : {}),
  });
  const enfocarError = nuevos => {
    setErrores(nuevos);
    const primer = Object.keys(nuevos)[0];
    formRef.current?.querySelector(`[name="${primer}"]`)?.focus();
  };
  const datos = { email, password, bizName: bizName.trim(), vertical, slug, fullName: fullName.trim(), operationMode: modo, country, currency: monedaDe(country), timezone: zonaDe(country), channels: canalesSugeridos(vertical, modo), diagnostico: inicial.diagnostico, plan, periodo };
  const abrirGoogle = async () => {
    if (conectandoGoogle || enviando) return;
    if (!recordarRegistroGoogle({ ...datos, modo, slugTocado })) { setError('No pudimos conservar los datos para volver de Google. Podés continuar con tu email.'); return; }
    setConectandoGoogle(true); setError(null);
    const r = await iniciarRegistroGoogle();
    if (!r.ok) { setConectandoGoogle(false); setError(r.error); }
  };
  const enviar = async e => {
    e.preventDefault();
    if (enviando || conectandoGoogle) return;
    const cuenta = validarCuenta();
    if (Object.keys(cuenta).length) { setPaso(0); enfocarError(cuenta); return; }
    if (paso === 0) { setErrores({}); setPaso(1); return; }
    const nuevos = {
      ...(bizName.trim().length < 2 ? { bizName: 'Escribí el nombre de tu negocio (al menos dos caracteres).' } : {}),
      ...(!validacionLocal.ok ? { slug: validacionLocal.reason } : dispo !== true ? { slug: dispo === 'checking' ? 'Esperá la comprobación del enlace.' : dispo === false ? 'Este enlace ya está ocupado. Elegí otro.' : 'No pudimos comprobar el enlace. Volvé a intentarlo.' } : {}),
    };
    if (Object.keys(nuevos).length) { enfocarError(nuevos); return; }
    if (paso === 1) { setErrores({}); setPaso(2); return; }
    // El checkout requiere autorizacion real y confirmacion del servidor.
    // No crear un tenant ni simular una prueba desde esta maqueta.
    if (paso === 2) { setError('La conexión de suscripciones con Mercado Pago todavía no está habilitada.'); return; }
    setEnviando(true); setError(null);
    try {
      const r = await (cuentaGoogle ? registrarNegocioConGoogle(datos) : registrarNegocio(datos));
      if (!r.ok) { setError(r.error); return; }
      limpiarRegistroGoogle(); marcarEvento('registro-enviado');
      if (r.needsConfirmation === false) { window.location.assign(`/bienvenido${inicial.diagnostico ? `?d=${inicial.diagnostico}` : ''}`); return; }
      setListo(true);
    } catch { setError('No pudimos crear tu cuenta. Tus datos siguen acá para reintentar.'); }
    finally { setEnviando(false); }
  };
  const atributos = campo => ({ 'aria-invalid': Boolean(errores[campo]), 'aria-describedby': errores[campo] ? `signup-${campo}-error` : undefined });
  const planActual = PLANES_COMERCIALES.find(p => p.id === plan);
  const landing = window.location.hostname.endsWith('.vercel.app') ? '/landing' : '/';

  const precio = precioDelPeriodo(planActual, periodo === 'anual');

  return <div className="signup-page"><BrandPanel paso={paso} negocio={bizName} /><section className="signup-workspace" aria-label="Registro">
    <div className="signup-content">
      {listo ? <div className="signup-success" role="status"><h2>Revisá tu email</h2><p>Te mandamos un link a <strong>{email}</strong>. Cuando lo confirmes, activamos <strong>{slug}.divianco.app</strong>.</p><p>Si no llega en unos minutos, mirá en spam. Al confirmar, verificamos que el enlace siga disponible.</p><p>Crear tu cuenta no contrata una suscripción ni realiza un cobro.</p><a className="signup-inline-link" href="/entrar">Iniciá sesión</a></div> : <>
        <ol className="signup-progress" aria-label="Pasos del registro">{['Tu cuenta', 'Tu negocio', 'Prueba y pago'].map((nombre, indice) => <li key={nombre} aria-current={paso === indice ? 'step' : undefined} data-completo={paso > indice}><span>{paso > indice ? '✓' : `0${indice + 1}`}</span>{indice < paso ? <button type="button" onClick={() => setPaso(indice)}>{nombre}</button> : nombre}</li>)}</ol>
        <h2 className="signup-title" tabIndex={-1} ref={tituloRef}>{['Creá tu cuenta', 'Prepará tu negocio', 'Confirmá tu comienzo'][paso]}</h2>
        {paso === 1 && <><div className="signup-plan"><span>Plan {planActual.nombre} · {periodo === 'anual' ? 'Anual' : 'Mensual'}</span><button type="button" aria-expanded={cambiarPlan} onClick={() => setCambiarPlan(!cambiarPlan)}>Cambiar</button></div>
        {cambiarPlan && <div className="signup-plan-opciones"><label className="signup-label" htmlFor="signup-plan">Elegí tu plan</label><select id="signup-plan" className="signup-control" value={plan} onChange={e => { setPlan(e.target.value); if (e.target.value === 'digital') setPeriodo('mensual'); }}>{PLANES_COMERCIALES.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select><label className="signup-label" htmlFor="signup-periodo">Período de pago</label><select id="signup-periodo" className="signup-control" value={periodo} onChange={e => setPeriodo(e.target.value)}><option value="mensual">Mensual</option>{plan !== 'digital' && <option value="anual">Anual</option>}</select><a href={`${landing}#comparar-planes`} target="_blank" rel="noopener noreferrer">Comparar planes ↗</a></div>} </>}
        {paso === 1 && inicial.desdeDiagnostico && <p className="signup-preloaded">Completamos estos datos con tu diagnóstico. Podés editarlos.</p>}
        {error && <p className="signup-error" role="alert">{error}</p>}
        <form className="signup-form" ref={formRef} onSubmit={enviar} noValidate aria-busy={enviando || conectandoGoogle}>
          {paso === 0 ? <>
            {google && !cuentaGoogle && <><button type="button" className="signup-google" onClick={abrirGoogle} disabled={conectandoGoogle}><img src="/brand/google.svg" alt="" width="20" height="20" />{conectandoGoogle ? 'Conectando con Google…' : 'Continuar con Google'}</button><p className="signup-separator">o usá tu email</p></>}
            {cuentaGoogle && <p className="signup-preloaded">Correo verificado con Google.</p>}
            <Campo label="Tu nombre" id="signup-fullName" error={errores.fullName}><input id="signup-fullName" name="fullName" className="signup-control" autoComplete="name" maxLength={80} required value={fullName} onChange={e => cambiar('fullName', e.target.value, setFullName)} {...atributos('fullName')} /></Campo>
            <Campo label="Email" id="signup-email" error={errores.email}><input id="signup-email" name="email" className="signup-control" type="email" autoComplete="email" maxLength={254} required readOnly={cuentaGoogle} value={email} onChange={e => cambiar('email', e.target.value, setEmail)} {...atributos('email')} /></Campo>
            {!cuentaGoogle && <Campo label="Contraseña" id="signup-password" error={errores.password} hint="Mínimo 8 caracteres."><div className="signup-password"><input id="signup-password" name="password" className="signup-control" type={verPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={e => cambiar('password', e.target.value, setPassword)} {...atributos('password')} /><button type="button" aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVerPassword(!verPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg></button></div></Campo>}
          </> : paso === 1 ? <>
            <Campo label="Nombre de tu negocio" id="signup-bizName" error={errores.bizName}><input id="signup-bizName" name="bizName" className="signup-control" autoComplete="organization" maxLength={80} required value={bizName} onChange={e => cambiar('bizName', e.target.value, setBizName)} {...atributos('bizName')} /></Campo>
            <fieldset className="signup-fieldset"><legend className="signup-label">Rubro</legend><div className="signup-options">{VERTICALES.map(v => <button key={v.id} className="signup-option" type="button" aria-pressed={vertical === v.id} onClick={() => setVertical(v.id)}>{v.nombre}</button>)}</div></fieldset>
            <fieldset className="signup-fieldset"><legend className="signup-label">¿Cómo atendés?</legend><div className="signup-options">{MODOS.map(m => <button key={m.id} className="signup-option" type="button" aria-pressed={modo === m.id} onClick={() => setModo(m.id)}>{MODOS_LABEL[m.id] || m.label}</button>)}</div></fieldset>
            <div className="signup-business-grid"><Campo label="País y moneda" id="signup-country"><select id="signup-country" className="signup-control" value={country} onChange={e => setCountry(e.target.value)}>{PAISES.map(p => <option key={p.id} value={p.id}>{p.label} — {p.currency}</option>)}</select></Campo>
              <Campo label="El enlace de tu negocio" id="signup-slug" error={errores.slug}><input id="signup-slug" name="slug" className="signup-control" value={slug} maxLength={40} spellCheck={false} autoCapitalize="none" autoComplete="off" onChange={e => { setSlugTocado(true); cambiar('slug', slugify(e.target.value), setSlug); }} {...atributos('slug')} /><p className="signup-url">{slug || 'tu-negocio'}.divianco.app</p></Campo></div>
            <div className="signup-validation" aria-live="polite">{slug && !validacionLocal.ok ? validacionLocal.reason : validacionLocal.ok && (dispo === 'checking' ? 'Comprobando el enlace…' : dispo === true ? 'El enlace está disponible.' : dispo === false ? 'Ese enlace ya está ocupado.' : <span>No pudimos comprobar el enlace. <button type="button" className="signup-inline-link" onClick={() => setChequeo(c => c + 1)}>Reintentar</button></span>)}</div>
          </> : <div className="signup-payment">
            <p className="signup-preloaded">Un mes de prueba. El pago comienza después.</p>
            <dl className="signup-payment__summary">
              <div><dt>Tu negocio</dt><dd>{bizName}</dd></div>
              <div><dt>Plan elegido</dt><dd>{planActual.nombre} · {periodo === 'anual' ? 'Anual' : 'Mensual'}</dd></div>
              <div><dt>Durante el primer mes</dt><dd className="signup-payment__zero">$0</dd></div>
              <div><dt>Después de la prueba</dt><dd>{pesosDelPlan(precio.importe)} /{precio.periodo}<small>Por local · Sin IVA · Pesos argentinos</small></dd></div>
            </dl>
            <div className="signup-payment__provider"><span aria-hidden="true">↗</span><div><strong>Tu medio de pago, en Mercado Pago</strong><p>Vas a revisar el importe y autorizar los cobros desde su pantalla segura.</p></div></div>
            <p className="signup-payment__pending" role="status">Vista previa: todavía falta conectar las suscripciones de Divianco. No se guarda una tarjeta, se inicia una prueba ni se crea el negocio desde esta pantalla.</p>
          </div>}
          <button className="signup-submit" type="submit" disabled={enviando || conectandoGoogle || paso === 2}>{enviando ? 'Creando…' : conectandoGoogle ? 'Verificando Google…' : paso === 2 ? 'Continuar a Mercado Pago' : 'Continuar'} <span aria-hidden="true">→</span></button>
          {paso > 0 && <button type="button" className="signup-back" onClick={() => setPaso(paso - 1)}>{paso === 1 ? 'Volver a tu cuenta' : 'Volver a tu negocio'}</button>}
          <p className="signup-login">¿Ya tenés cuenta? <a href="/entrar">Iniciá sesión</a></p>
        </form>
      </>}
    </div>
  </section></div>;
}
