// src/components/admin/LoginScreen.jsx
// Login del admin de cada negocio. El casco visual (splash, particulas, placa,
// titulo) vive en `LoginShell`, compartido con la entrada unica /entrar; aca
// queda lo que es del tenant: su logo y nombre, y el submit contra adminService.
//
// El logo + nombre salen de la DB; caen a `business` (config compilada) si
// todavía no respondió.
//
// No se puede leer `settings`: desde la migración 0025 tiene RLS por tenant,
// y acá justamente no hay sesión todavía. El resultado era que
// todos los tenants mostraban la marca del build — tienda-nueva.divianco.app
// decía "Cochi", con el logo y el color de Cochi. Por eso va por el RPC
// público get_tenant_brand(slug), que devuelve sólo identidad visible.

import { useState, useEffect, useCallback } from "react";
import { login } from "../../lib/adminService";
import business from "@business";
import { getTenantSlugSync } from "../../lib/activeTenant";
import { fetchTenantBrand } from "../../services/platformSettings";
import { pedirResetPassword } from "../../services/signup";
import LoginShell from "./LoginShell";
import {
  GOLD, estiloInput, alEnfocar, alSalir, estiloCaja, estiloBotonOro,
  estiloEnlace, estiloAlerta, estiloAviso,
} from "./loginEstilos";

export default function LoginScreen({ onLogin }) {
  const [modo, setModo] = useState("login");   // 'login' | 'recuperar'
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbSet, setDbSet] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Subdominio -> slug sincrónico, sin red. En un host desconocido (local,
    // preview) cae al slug del build, que es el comportamiento deseado en dev.
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

    return () => { mounted = false; };
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

  return (
    <LoginShell
      pastilla="Sistema administrativo"
      titulo={bizName}
      subtitulo={recuperando ? "Recuperar contraseña" : "Panel de gestión"}
      logoUrl={logoUrl}
      bizColor={bizColor}
    >
      {(stage) => (
        <form onSubmit={recuperando ? recuperar : handle} style={estiloCaja(stage)}>
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

          {err && <div role="alert" style={estiloAlerta}>{err}</div>}
          {aviso && <div role="status" style={estiloAviso}>{aviso}</div>}

          {/* El botón es ORO: es la acción, y el oro es acción. Tinta oscura
              encima, que es lo que el sistema pide sobre el sólido dorado —
              el blanco sobre oro no llega al contraste mínimo. */}
          <button type="submit" disabled={loading}
            style={estiloBotonOro(loading)}
            onMouseDown={e=>{ e.currentTarget.style.transform="scale(0.98)"; }}
            onMouseUp={e=>{ e.currentTarget.style.transform="scale(1)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform="scale(1)"; }}>
            {loading
              ? (recuperando ? "Enviando…" : "Entrando…")
              : (recuperando ? "Enviarme el mail" : "Entrar")}
          </button>

          <button type="button" onClick={() => irA(recuperando ? "login" : "recuperar")}
            style={estiloEnlace()}>
            {recuperando ? "Volver a entrar" : "¿Olvidaste tu contraseña?"}
          </button>
        </form>
      )}
    </LoginShell>
  );
}
