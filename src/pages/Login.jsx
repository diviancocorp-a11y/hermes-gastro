// src/pages/Login.jsx
// Entrada unica a la plataforma (divianco.app/entrar).
//
// ES LA MISMA PUERTA QUE EL LOGIN DEL ADMIN (`LoginShell`,
// particulas Volt, placa de Dico, caja translucida, boton oro) pero general
// para todos los negocios: la marca es Dico y no se consulta ninguna marca de
// tenant, porque aca todavia no se sabe a cual negocio va la persona.
//
// POR QUE EXISTE: sin esto, un dueño que confirmaba el mail y cerraba la
// pestaña quedaba con una cuenta valida y NINGUNA forma de volver.
//
// A donde va despues de entrar lo decide `resolverDestino()` (servicio
// entradaUnica): un negocio -> directo a su admin; varios -> pregunta a cual;
// ninguno -> el caso de siempre (signup_tenant es idempotente) o el staff.

import { useState, useEffect, useCallback } from 'react';
import { iniciarSesion, pedirResetPassword, cambiarPassword } from '../services/signup';
import { resolverDestino, irAlAdmin, irALaConsola } from '../services/entradaUnica';
import { supabase } from '../lib/supabase';
import LoginShell from '../components/admin/LoginShell';
import {
  GOLD, estiloInput, alEnfocar, alSalir, estiloCaja, estiloBotonOro,
  estiloEnlace, estiloAlerta, estiloAviso,
} from '../components/admin/loginEstilos';

// Los tokens del sistema (dico-tokens.css, cargado desde index.css): no se
// escriben las familias a mano.
const FUENTE = 'var(--ds-font-ui)';
const MONO = 'var(--ds-font-technical)';

const estiloEtiqueta = { display: 'block', textAlign: 'left', fontSize: 12, color: 'rgba(255,255,255,0.7)' };
const estiloCampo = { ...estiloInput, minHeight: 44, width: '100%', boxSizing: 'border-box', marginTop: 6 };

// El aro va por dentro (outline con offset negativo): una sombra hacia afuera se
// recorta contra el borde de la caja.
const alEnfocarOpcion = (e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.outline = `2px solid ${GOLD}`; e.currentTarget.style.outlineOffset = '-3px'; };
const alSalirOpcion = (e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.outline = 'none'; };

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [modoReset, setModoReset] = useState(false);
  // 'elegir' (varios negocios) | 'entrando' (ya se decidio, esperando el salto)
  const [vista, setVista] = useState('form');
  const [negocios, setNegocios] = useState([]);
  // true cuando la persona es staff de Divianco y el selector ofrece la consola.
  const [conConsola, setConConsola] = useState(false);
  const [entrandoA, setEntrandoA] = useState('');
  // El link del mail de reset vuelve a /entrar con type=recovery en el hash y
  // una sesion ya abierta: lo que falta es fijar la contraseña nueva. Se lee
  // en el inicializador (primer render, sincronico) porque el cliente de
  // Supabase procesa y limpia ese hash apenas puede.
  const [modoNueva, setModoNueva] = useState(() => {
    try { return window.location.hash.includes('type=recovery'); } catch { return false; }
  });

  useEffect(() => { document.title = 'Entrar — Dico'; }, []);

  // Red de seguridad para lo de arriba: leer el hash es GANARLE UNA CARRERA al
  // cliente de Supabase, que lo procesa y lo limpia apenas puede. Si nos gana
  // —y con la conexion justa nos gana— la persona ve el login comun con una
  // sesion de recuperacion abierta, escribe la contraseña VIEJA que no
  // recuerda, y no entra.
  //
  // `PASSWORD_RECOVERY` es el evento que Supabase emite para exactamente esto,
  // y no depende de que el hash siga ahi.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') setModoNueva(true);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  /** Salta al admin del negocio. Si sale bien la pagina se va y no vuelve. */
  const entrarA = useCallback(async (negocio) => {
    setError(null); setEntrandoA(negocio.name || negocio.slug); setVista('entrando');
    const r = await irAlAdmin(negocio.slug);
    if (r && r.ok === false) {
      setError(r.error);
      setVista(negocios.length > 1 ? 'elegir' : 'form');
    }
  }, [negocios.length]);

  /** Salta a la consola de Divianco (otro subdominio: la sesion viaja en el hash). */
  const entrarAConsola = useCallback(async () => {
    setError(null); setEntrandoA('la consola de Divianco'); setVista('entrando');
    const r = await irALaConsola();
    if (r && r.ok === false) {
      setError(r.error);
      setVista(negocios.length > 0 ? 'elegir' : 'form');
    }
  }, [negocios.length]);

  /** Con la sesion abierta (login o clave nueva), decide a donde va. */
  const seguir = useCallback(async () => {
    const d = await resolverDestino();
    if (!d.ok) { setError(d.error); setVista('form'); return; }
    if (d.tipo === 'staff') {
      await entrarAConsola();
      return;
    }
    if (d.tipo === 'elegir') {
      setNegocios(d.negocios); setConConsola(d.consola === true); setVista('elegir');
      return;
    }
    await entrarA(d.negocio);
  }, [entrarA, entrarAConsola]);

  const guardarNueva = useCallback(async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (password.length < 6) { setError('La contraseña necesita al menos 6 caracteres.'); return; }
    if (password !== password2) { setError('Las contraseñas no coinciden.'); return; }
    setEnviando(true); setError(null); setAviso(null);

    const r = await cambiarPassword(password);
    if (!r.ok) { setError(r.error); setEnviando(false); return; }

    // Con la clave ya cambiada, mismo destino que un login normal.
    setModoNueva(false);
    await seguir();
    setEnviando(false);
  }, [password, password2, enviando, seguir]);

  const entrar = useCallback(async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true); setError(null); setAviso(null);

    const login = await iniciarSesion({ email, password });
    if (!login.ok) { setError(login.error); setEnviando(false); return; }

    await seguir();
    setEnviando(false);
  }, [email, password, enviando, seguir]);

  const resetear = useCallback(async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true); setError(null); setAviso(null);
    const r = await pedirResetPassword(email);
    setEnviando(false);
    if (!r.ok) { setError(r.error); return; }
    // Mensaje deliberadamente ambiguo: confirmar que el mail existe permitiria
    // averiguar que direcciones estan registradas en la plataforma.
    setAviso('Si esa dirección tiene cuenta, te mandamos un mail para cambiar la contraseña.');
  }, [email, enviando]);

  const otraCuenta = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch { /* si falla igual se vuelve al form */ }
    setNegocios([]); setConConsola(false); setPassword(''); setError(null); setAviso(null); setVista('form');
  }, []);


  const volverAEntrar = () => {
    setModoNueva(false); setModoReset(false);
    setPassword(''); setPassword2(''); setError(null); setAviso(null);
  };

  const subtitulo =
    vista === 'elegir' ? 'Tus negocios'
    : vista === 'entrando' ? 'Un momento'
    : modoNueva ? 'Contraseña nueva'
    : modoReset ? 'Recuperar contraseña'
    : 'Entrá a tu negocio';

  const mensajes = (
    <>
      {error && <div role="alert" style={estiloAlerta}>{error}</div>}
      {aviso && <div role="status" style={estiloAviso}>{aviso}</div>}
    </>
  );

  const botonOro = (texto) => (
    <button type="submit" disabled={enviando} style={estiloBotonOro(enviando, true)}>
      {enviando ? 'Un momento…' : texto}
    </button>
  );

  return (
    <LoginShell
      pastilla="Ingresar"
      titulo="Dico"
      subtitulo={subtitulo}
      fontFamily={FUENTE}
      colorPie="rgba(255,255,255,0.55)"
    >
      {(stage) => {
        if (vista === 'entrando') {
          return (
            <div style={{ ...estiloCaja(stage), alignItems: 'center', textAlign: 'center' }}>
              <p role="status" style={{ margin: 0, fontSize: 14, color: '#fff' }}>
                Entrando a <strong>{entrandoA}</strong>…
              </p>
            </div>
          );
        }

        if (vista === 'elegir') {
          return (
            <div style={estiloCaja(stage)}>
              <p id="elegir-negocio" style={{ margin: '0 4px 2px', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>
                ¿A cuál querés entrar?
              </p>
              {mensajes}
              {/* Sin scroll propio: scrollea la columna del shell, asi no hay dos
                  scrolls anidados con el teclado abierto. role="list" porque
                  list-style:none le saca la lista a Safari/VoiceOver. */}
              <ul role="list" aria-labelledby="elegir-negocio" style={{
                listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {negocios.map((n) => (
                  <li key={n.slug}>
                    <button
                      type="button" onClick={() => entrarA(n)}
                      onFocus={alEnfocarOpcion} onBlur={alSalirOpcion}
                      style={{
                        width: '100%', minHeight: 56, padding: '10px 16px', borderRadius: 12, textAlign: 'left',
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                        color: '#fff', cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{n.name || n.slug}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
                        {n.slug}.divianco.app
                      </span>
                    </button>
                  </li>
                ))}
                {conConsola && (
                  <li>
                    <button
                      type="button" onClick={entrarAConsola}
                      onFocus={alEnfocarOpcion} onBlur={alSalirOpcion}
                      style={{
                        width: '100%', minHeight: 56, padding: '10px 16px', borderRadius: 12, textAlign: 'left',
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                        color: '#fff', cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Consola de Divianco</span>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
                        Equipo Divianco
                      </span>
                    </button>
                  </li>
                )}
              </ul>
              <button type="button" onClick={otraCuenta} style={estiloEnlace(true)}>
                Entrar con otra cuenta
              </button>
            </div>
          );
        }

        if (modoNueva) {
          return (
            <form onSubmit={guardarNueva} style={estiloCaja(stage)}>
              <p style={{ margin: '2px 4px 0', fontSize: 14, textAlign: 'left' }}>Elegí tu contraseña nueva.</p>
              <label style={estiloEtiqueta}>
                Contraseña nueva
                <input
                  style={estiloCampo} type="password" value={password} autoFocus autoComplete="new-password"
                  onChange={(ev) => setPassword(ev.target.value)} placeholder="Mínimo 6 caracteres"
                  onFocus={alEnfocar} onBlur={alSalir}
                />
              </label>
              <label style={estiloEtiqueta}>
                Repetila
                <input
                  style={estiloCampo} type="password" value={password2} autoComplete="new-password"
                  onChange={(ev) => setPassword2(ev.target.value)} placeholder="••••••••"
                  onFocus={alEnfocar} onBlur={alSalir}
                />
              </label>
              {mensajes}
              {botonOro('Guardar y entrar')}
              <button type="button" onClick={volverAEntrar} style={estiloEnlace(true)}>Volver a entrar</button>
            </form>
          );
        }

        return (
          <>
            <form onSubmit={modoReset ? resetear : entrar} style={estiloCaja(stage)}>
              <label style={estiloEtiqueta}>
                Email
                <input
                  style={estiloCampo} type="email" value={email} autoFocus autoComplete="email" required
                  onChange={(ev) => setEmail(ev.target.value)} placeholder="vos@ejemplo.com"
                  onFocus={alEnfocar} onBlur={alSalir}
                />
              </label>

              {!modoReset && (
                <label style={estiloEtiqueta}>
                  Contraseña
                  <input
                    style={estiloCampo} type="password" value={password} autoComplete="current-password" required
                    onChange={(ev) => setPassword(ev.target.value)} placeholder="••••••••"
                    onFocus={alEnfocar} onBlur={alSalir}
                  />
                </label>
              )}

              {modoReset && (
                <p style={{ margin: '2px 4px 0', fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', textAlign: 'left' }}>
                  Te mandamos un link para elegir una contraseña nueva.
                </p>
              )}

              {mensajes}
              {botonOro(modoReset ? 'Mandarme el link' : 'Entrar')}

              <button
                type="button"
                onClick={() => { setModoReset(!modoReset); setError(null); setAviso(null); }}
                style={estiloEnlace(true)}
              >
                {modoReset ? 'Volver a entrar' : 'Olvidé mi contraseña'}
              </button>
            </form>

            <p style={{ margin: '20px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              ¿Todavía no tenés negocio?{' '}
              <a href="/registro" style={{ color: GOLD, display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 4px' }}>Creá el tuyo</a>
            </p>
          </>
        );
      }}
    </LoginShell>
  );
}
