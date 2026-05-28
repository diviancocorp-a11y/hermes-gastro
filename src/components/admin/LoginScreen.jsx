// src/components/admin/LoginScreen.jsx
// Login del admin con intro animada minimal + flow field background.

import { useState, useEffect } from "react";
import { login } from "../../lib/adminService";
import business from "@business";
import FlowFieldBackground from "./FlowFieldBackground";
import HermesMark from "../HermesMark";

const INTRO_MS = 1400;

export default function LoginScreen({ onLogin }) {
  const [stage, setStage] = useState("intro");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStage("form"), INTRO_MS);
    return () => clearTimeout(t);
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

  const logoLetter = (business.logoLetter || business.name?.charAt(0) || "A").toUpperCase();
  const logoColor = business.branding?.primary || "#c47554";

  return (
    <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"system-ui,-apple-system,sans-serif", color:"#fff", overflow:"hidden" }}>
      <FlowFieldBackground color="#f59e0b" trailOpacity={0.08} particleCount={500} speed={0.7} bgColor="10,10,10" />

      <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.45) 100%)", pointerEvents:"none" }} />

      <div style={{ position:"relative", zIndex:2, width:"100%", maxWidth:380, padding:"0 24px", textAlign:"center" }}>

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

        {/* Logo con chip oscuro traslúcido para destacarlo del fondo */}
        <div style={{
          margin:"0 auto",
          opacity:0, transform:"scale(0.85)",
          animation:"hg-login-logo-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s forwards",
          display:"inline-flex", justifyContent:"center", alignItems:"center",
          padding:"18px 26px",
          borderRadius:24,
          background:"rgba(0,0,0,0.45)",
          border:"1px solid rgba(255,255,255,0.06)",
          backdropFilter:"blur(8px)",
          WebkitBackdropFilter:"blur(8px)",
          boxShadow:`0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(${parseInt(logoColor.slice(1,3),16)},${parseInt(logoColor.slice(3,5),16)},${parseInt(logoColor.slice(5,7),16)},0.08)`,
        }}>
          <HermesMark as="logo" size={180} fallback={logoLetter} color={logoColor} />
        </div>

        <p style={{
          margin:"18px 0 0", fontSize:12, color:"rgba(255,255,255,0.6)",
          letterSpacing:"0.1em", textTransform:"uppercase",
          opacity:0, animation:"hg-login-sub-in 0.7s ease 0.55s forwards",
        }}>Panel de gestión</p>

        {/* Caja sólida del form — para que no se pierda en el fondo */}
        <form onSubmit={handle} style={{
          marginTop:24, display:"flex", flexDirection:"column", gap:10,
          padding:"20px 18px",
          background:"rgba(15, 14, 13, 0.92)",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:16,
          boxShadow:"0 20px 50px rgba(0,0,0,0.55)",
          backdropFilter:"blur(12px)",
          WebkitBackdropFilter:"blur(12px)",
          opacity: stage === "intro" ? 0 : 1,
          transform: stage === "intro" ? "translateY(12px)" : "translateY(0)",
          transition:"opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
          pointerEvents: stage === "intro" ? "none" : "auto",
        }}>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"
            style={{ padding:"13px 16px", borderRadius:12, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.06)", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", transition:"border-color 0.2s, background 0.2s" }}
            onFocus={e=>{ e.target.style.borderColor=logoColor; e.target.style.background="rgba(255,255,255,0.09)"; }}
            onBlur={e=>{ e.target.style.borderColor="rgba(255,255,255,0.12)"; e.target.style.background="rgba(255,255,255,0.06)"; }} />

          <input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} required autoComplete="current-password"
            style={{ padding:"13px 16px", borderRadius:12, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.06)", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", transition:"border-color 0.2s, background 0.2s" }}
            onFocus={e=>{ e.target.style.borderColor=logoColor; e.target.style.background="rgba(255,255,255,0.09)"; }}
            onBlur={e=>{ e.target.style.borderColor="rgba(255,255,255,0.12)"; e.target.style.background="rgba(255,255,255,0.06)"; }} />

          <label style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px", fontSize:12, color:"rgba(255,255,255,0.65)", cursor:"pointer", userSelect:"none", textAlign:"left" }}>
            <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}
              style={{ width:14, height:14, accentColor:logoColor, cursor:"pointer" }} />
            Recordar sesión
          </label>

          {err && (
            <div style={{ padding:"10px 12px", borderRadius:10, background:"rgba(239,68,68,0.12)", color:"#fca5a5", fontSize:12, border:"1px solid rgba(239,68,68,0.25)", textAlign:"left" }}>
              {err}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ marginTop:6, padding:"13px", borderRadius:12, border:0,
              background: loading ? `${logoColor}88` : logoColor, color:"#fff",
              fontSize:14, fontWeight:700, fontFamily:"inherit",
              cursor: loading ? "wait" : "pointer",
              transition:"background 0.2s, transform 0.1s",
              boxShadow:`0 4px 14px ${logoColor}44` }}
            onMouseDown={e=>{ e.currentTarget.style.transform="scale(0.98)"; }}
            onMouseUp={e=>{ e.currentTarget.style.transform="scale(1)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform="scale(1)"; }}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div style={{
          marginTop:32, fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:"0.05em",
          opacity: stage === "intro" ? 0 : 1,
          transition:"opacity 0.6s ease 0.4s",
        }}>
          {business.legal?.copyrightYear ? `© ${business.legal.copyrightYear}` : ""} Hermes Gastro
        </div>
      </div>

      <style>{`
        @keyframes hg-login-logo-in { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
        @keyframes hg-login-title-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes hg-login-sub-in { from { opacity:0; } to { opacity:1; } }
        @media (prefers-reduced-motion: reduce) { [style*="animation"] { animation: none !important; opacity: 1 !important; } }
      `}</style>
    </div>
  );
}
