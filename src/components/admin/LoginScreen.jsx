// src/components/admin/LoginScreen.jsx
// Login del admin. Layout:
//   - Splash de marca: el logo DICO completo (DIC + Dico como la O)
//   - Centro: identidad del negocio (logo real desde settings + nombre)
//   - Form: caja muy traslúcida, botón dorado del sistema
//
// El logo + nombre salen de la DB; caen a `business` (config compilada) si
// todavía no respondió.
//
// En la PLATAFORMA no se puede leer `settings`: desde la migración 0025 tiene
// RLS por tenant, y acá justamente no hay sesión todavía. El resultado era que
// todos los tenants mostraban la marca del build — tienda-nueva.divianco.app
// decía "Cochi", con el logo y el color de Cochi. Por eso va por el RPC
// público get_tenant_brand(slug), que devuelve sólo identidad visible.
//
// ─────────────────────────── EL COLOR DICE QUÉ ES ───────────────────────────
//
// El fondo de partículas es VOLT, que en el sistema significa "actividad
// interna, nunca protagonista": es literalmente el flujo de la máquina
// trabajando detrás. El ORO aparece sólo donde hay presencia o acción — unas
// pocas partículas, el aro de Dico y el botón de entrar. Es la misma regla que
// gobierna el panel, aplicada a la puerta de entrada.

import { useState, useEffect, useCallback } from "react";
import { login } from "../../lib/adminService";
import { supabase } from "../../lib/supabase";
import business from "@business";
import { getTenantSlugSync } from "../../lib/activeTenant";
import { fetchTenantBrand } from "../../services/platformSettings";
import { pedirResetPassword } from "../../services/signup";
import FlowFieldBackground from "./FlowFieldBackground";
import DicoNative from "../dico/DicoNative";

const INTRO_MS = 1400;
/** Los tres del sistema (`machine-soul.css`), acá como literales porque este
 *  componente pinta con estilos en línea y no hereda los tokens del panel. */
const GOLD = "#E8B947";
const VOLT = "#60A5FA";   // la variante para fondo oscuro (--ms-volt-dark)
const ZINC = "#18181B";

export default function LoginScreen({ onLogin }) {
  const [stage, setStage] = useState("intro");
  const [modo, setModo] = useState("login");   // 'login' | 'recuperar'
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbSet, setDbSet] = useState(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [saluda, setSaluda] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStage("form"), INTRO_MS);
    let mounted = true;

    if (business.platform) {
      // Subdominio -> slug sincrónico, sin red. En un host desconocido
      // (local, preview) cae al slug del build, que es el comportamiento
      // deseado en dev.
      fetchTenantBrand(getTenantSlugSync())
        .then((data) => {
          if (mounted && data) {
            setDbSet({
              biz_name: data.name,
              logo_letter: data.logo_letter,
              logo_color: data.logo_color,
              logo_url: data.logo_url,
            });
          }
        })
        .catch(() => {});
    } else {
      supabase
        .from("settings")
        .select("biz_name, logo_letter, logo_color, logo_url")
        .limit(1)
        .then(({ data }) => { if (mounted && data?.[0]) setDbSet(data[0]); })
        .catch(() => {});
    }

    return () => { clearTimeout(t); mounted = false; };
  }, []);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try { localStorage.setItem("hg_remember_session", remember ? "1" : "0"); } catch {}
    const res = await login(email, pass);
    setLoading(false);
    if (res.ok) onLogin();
    else setErr(res.msg);
  };

  /**
   * Pedir el mail de recuperación.
   *
   * El aviso es DELIBERADAMENTE AMBIGUO y no confirma si la dirección existe:
   * decirlo permitiría averiguar qué correos tienen cuenta en la plataforma.
   * Es el mismo texto que usa `/entrar`, y el link del mail cae ahí, que es la
   * pantalla que sabe atender `type=recovery`.
   */
  const recuperar = useCallback(async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setErr(""); setAviso("");
    const r = await pedirResetPassword(email);
    setLoading(false);
    if (!r.ok) { setErr(r.error); return; }
    setAviso("Si esa dirección tiene cuenta, te mandamos un mail para cambiar la contraseña.");
  }, [email, loading]);

  const irA = (destino) => { setModo(destino); setErr(""); setAviso(""); };

  // Identidad efectiva (DB > business compilado > fallback)
  const bizName   = dbSet?.biz_name   || business.name || "Panel de gestión";
  const bizColor  = dbSet?.logo_color  || business.branding?.primary || GOLD;
  const logoUrl   = dbSet?.logo_url    || business.branding?.logoUrl || null;
  const recuperando = modo === "recuperar";

  const estiloInput = {
    padding: "13px 16px", borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none",
    transition: "border-color 0.2s, background 0.2s",
  };
  const alEnfocar = (e) => { e.target.style.borderColor = GOLD; e.target.style.background = "rgba(255,255,255,0.07)"; };
  const alSalir = (e) => { e.target.style.borderColor = "rgba(255,255,255,0.12)"; e.target.style.background = "rgba(255,255,255,0.04)"; };

  return (
    <div style={{ position:"fixed", inset:0, fontFamily:"system-ui,-apple-system,sans-serif", color:"#fff", overflow:"hidden" }}>
      {/* Las venas del sistema, todas volt; y cada tanto un pulso dorado que
          las recorre en bloque. Ver la cabecera de `FlowFieldBackground`. */}
      <FlowFieldBackground
        color={VOLT}
        pulseColor={GOLD}
        pulseSize={90}
        pulseLife={300}
        pulseGap={50}
        trailOpacity={0.08}
        particleCount={500}
        speed={0.7}
        bgColor="10,10,10"
      />
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.45) 100%)", pointerEvents:"none" }} />

      {/* Splash de marca. Es el logo DICO completo —DIC más Dico haciendo de
          O—: la misma animación de siempre, la marca que corresponde. */}
      <div style={{
        position:"absolute", inset:0, zIndex:50,
        display:"flex", alignItems:"center", justifyContent:"center",
        background:"#0a0a0a",
        opacity: stage === "intro" ? 1 : 0,
        pointerEvents: stage === "intro" ? "auto" : "none",
        transition:"opacity 0.6s cubic-bezier(0.22,1,0.36,1)",
        overflow:"hidden",
      }}>
        <div style={{
          maxWidth:"min(86vw, 460px)",
          animation:"hg-splash-in 0.9s cubic-bezier(0.22,1,0.36,1) forwards",
          filter:`drop-shadow(0 18px 56px ${GOLD}55)`,
        }}>
          <img
            src="/brand/dico/logo/dico-oscuro.png"
            alt="DICO"
            width="1368"
            height="452"
            style={{ display:"block", width:"100%", height:"auto" }}
          />
        </div>
      </div>

      {/* Centro: identidad del negocio + form */}
      <div style={{ position:"relative", zIndex:2, width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:"100%", maxWidth:380, padding:"0 24px", textAlign:"center" }}>

          <div style={{
            display:"inline-block", padding:"5px 14px",
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:999, color:"rgba(255,255,255,0.65)",
            fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
            marginBottom:24, backdropFilter:"blur(4px)",
            opacity: stage === "intro" ? 0 : 1,
            transform: stage === "intro" ? "translateY(-8px)" : "translateY(0)",
            transition:"opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s",
          }}>
            Sistema administrativo
          </div>

          {/* La placa del sistema.
              Donde iba la inicial del negocio ahora está Dico: la inicial era
              una letra en un cuadrado de color, o sea nada. La placa es ZINC
              con la trama del chasis —el mismo material del panel que hay del
              otro lado de esta puerta— y encima de Dico va un vidrio: un
              reflejo diagonal y un borde claro arriba, para que se lea como
              una pieza montada y no como un PNG pegado.
              Si el negocio cargó su logo, manda el logo: la marca del cliente
              le gana a la nuestra en su propia puerta. */}
          <div style={{
            position:"relative",
            width:108, height:108, margin:"0 auto",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {/* Halo pulsante */}
            <div style={{
              position:"absolute", inset:-18,
              borderRadius:"50%",
              background:`radial-gradient(circle, ${logoUrl ? bizColor : GOLD}55 0%, ${logoUrl ? bizColor : GOLD}22 40%, transparent 70%)`,
              animation:"hg-halo-pulse 3.2s ease-in-out infinite",
              pointerEvents:"none",
            }} />

            <div
              className={logoUrl ? "" : "ms-trace"}
              onMouseEnter={() => setSaluda(true)}
              onMouseLeave={() => setSaluda(false)}
              style={{
                position:"relative",
                width:96, height:96, borderRadius:28,
                background: logoUrl ? "rgba(255,255,255,0.06)" : ZINC,
                color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: logoUrl
                  ? `0 14px 38px ${bizColor}66, 0 0 0 1px rgba(255,255,255,0.08)`
                  : `0 14px 38px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10)`,
                overflow:"hidden",
                opacity:0, transform:"scale(0.85)",
                animation:"hg-login-logo-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s forwards",
              }}
            >
              {logoUrl ? (
                <>
                  <img
                    src={logoUrl}
                    alt={bizName}
                    onLoad={() => setLogoLoaded(true)}
                    onError={() => setLogoLoaded(false)}
                    style={{
                      width:"100%", height:"100%", objectFit:"cover",
                      opacity: logoLoaded ? 1 : 0,
                      transition:"opacity 0.4s ease",
                    }}
                  />
                  {!logoLoaded && (
                    <span style={{ position:"absolute", color:"#fff", opacity:0.55, fontSize:46, fontWeight:800 }}>
                      {bizName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {/* Dico saluda al pasarle el mouse. No hay asset de guiño
                      —los siete estados aprobados no lo incluyen—, así que el
                      saludo es la cara `happy`: cambia la boca y las cejas. */}
                  <DicoNative
                    state={saluda ? "happy" : "neutral"}
                    activity="idle"
                    size={72}
                    title="Dico"
                  />
                  {/* El vidrio. Va DESPUÉS de Dico y sin pointer-events para
                      no comerse el hover de la placa. */}
                  <span aria-hidden="true" style={{
                    position:"absolute", inset:0, pointerEvents:"none",
                    borderRadius:"inherit",
                    background:"linear-gradient(150deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 34%, transparent 52%)",
                    boxShadow:"inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -14px 24px rgba(0,0,0,0.35)",
                  }} />
                </>
              )}
            </div>
          </div>

          <h1 style={{
            margin:"20px 0 4px",
            fontSize:22, fontWeight:700, letterSpacing:"-0.02em", color:"#fff",
            opacity:0, transform:"translateY(8px)",
            animation:"hg-login-title-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.35s forwards",
          }}>{bizName}</h1>

          <p style={{
            margin:0, fontSize:11.5, color:"rgba(255,255,255,0.55)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            opacity:0, animation:"hg-login-sub-in 0.7s ease 0.55s forwards",
          }}>{recuperando ? "Recuperar contraseña" : "Panel de gestión"}</p>

          {/* Form casi imperceptible */}
          <form onSubmit={recuperando ? recuperar : handle} style={{
            marginTop:28, display:"flex", flexDirection:"column", gap:10,
            padding:"18px 16px",
            background:"rgba(255,255,255,0.03)",
            border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:16,
            backdropFilter:"blur(6px)",
            WebkitBackdropFilter:"blur(6px)",
            opacity: stage === "intro" ? 0 : 1,
            transform: stage === "intro" ? "translateY(12px)" : "translateY(0)",
            transition:"opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
            pointerEvents: stage === "intro" ? "none" : "auto",
          }}>
            <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"
              style={estiloInput} onFocus={alEnfocar} onBlur={alSalir} />

            {!recuperando && (
              <input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} required autoComplete="current-password"
                style={estiloInput} onFocus={alEnfocar} onBlur={alSalir} />
            )}

            {!recuperando && (
              <label style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px", fontSize:12, color:"rgba(255,255,255,0.65)", cursor:"pointer", userSelect:"none", textAlign:"left" }}>
                <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}
                  style={{ width:14, height:14, accentColor:GOLD, cursor:"pointer" }} />
                Recordar sesión
              </label>
            )}

            {recuperando && (
              <p style={{ margin:"2px 4px 0", fontSize:12, lineHeight:1.5, color:"rgba(255,255,255,0.6)", textAlign:"left" }}>
                Te mandamos un mail con un link para elegir una contraseña nueva.
              </p>
            )}

            {err && (
              <div role="alert" style={{ padding:"10px 12px", borderRadius:10, background:"rgba(239,68,68,0.12)", color:"#fca5a5", fontSize:12, border:"1px solid rgba(239,68,68,0.25)", textAlign:"left" }}>
                {err}
              </div>
            )}

            {aviso && (
              <div role="status" style={{ padding:"10px 12px", borderRadius:10, background:"rgba(96,165,250,0.12)", color:"#bfdbfe", fontSize:12, border:"1px solid rgba(96,165,250,0.28)", textAlign:"left" }}>
                {aviso}
              </div>
            )}

            {/* El botón es ORO: es la acción, y el oro es acción. Tinta oscura
                encima, que es lo que el sistema pide sobre el sólido dorado —
                el blanco sobre oro no llega al contraste mínimo. */}
            <button type="submit" disabled={loading}
              style={{ marginTop:6, padding:"13px", borderRadius:12, border:0,
                background: loading ? `${GOLD}99` : GOLD, color:"#1a1a1a",
                fontSize:14, fontWeight:700, fontFamily:"inherit",
                cursor: loading ? "wait" : "pointer",
                transition:"background 0.2s, transform 0.1s",
                boxShadow:`0 4px 14px ${GOLD}44` }}
              onMouseDown={e=>{ e.currentTarget.style.transform="scale(0.98)"; }}
              onMouseUp={e=>{ e.currentTarget.style.transform="scale(1)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform="scale(1)"; }}>
              {loading
                ? (recuperando ? "Enviando…" : "Entrando…")
                : (recuperando ? "Enviarme el mail" : "Entrar")}
            </button>

            <button type="button" onClick={() => irA(recuperando ? "login" : "recuperar")}
              style={{ marginTop:2, padding:"8px", background:"none", border:0,
                color:"rgba(255,255,255,0.55)", fontSize:12, fontFamily:"inherit",
                cursor:"pointer", textDecoration:"underline", textUnderlineOffset:3 }}>
              {recuperando ? "Volver a entrar" : "¿Olvidaste tu contraseña?"}
            </button>
          </form>

          <div style={{
            marginTop:28, fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:"0.05em",
            opacity: stage === "intro" ? 0 : 1,
            transition:"opacity 0.6s ease 0.4s",
          }}>
            {business.legal?.copyrightYear ? `© ${business.legal.copyrightYear}` : ""} Divianco
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hg-login-logo-in { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
        @keyframes hg-login-title-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes hg-login-sub-in { from { opacity:0; } to { opacity:1; } }
        @keyframes hg-halo-pulse {
          0%, 100% { opacity:0.5; transform:scale(0.92); }
          50%      { opacity:1;   transform:scale(1.08); }
        }
        @keyframes hg-splash-in {
          from { opacity:0; transform:scale(0.88); }
          to   { opacity:1; transform:scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
