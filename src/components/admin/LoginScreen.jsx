// src/components/admin/LoginScreen.jsx
// Login del admin con flow field background.
//   - Esquina sup. izq.: chip Hermes (firma del sistema)
//   - Centro: identidad del negocio (logo + nombre)
//   - Form: caja muy traslúcida, botón ámbar del sistema

import { useState, useEffect } from "react";
import { login } from "../../lib/adminService";
import business from "@business";
import FlowFieldBackground from "./FlowFieldBackground";
import HermesMark from "../HermesMark";

const INTRO_MS = 1400;
const AMBER = "#F59E0B";

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

  const bizLetter = (business.logoLetter || business.name?.charAt(0) || "A").toUpperCase();
  const bizColor = business.branding?.primary || AMBER;

  return (
    <div style={{ position:"fixed", inset:0, fontFamily:"system-ui,-apple-system,sans-serif", color:"#fff", overflow:"hidden" }}>
      <FlowFieldBackground color="#f59e0b" trailOpacity={0.08} particleCount={500} speed={0.7} bgColor="10,10,10" />
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.45) 100%)", pointerEvents:"none" }} />

      {/* ───── Chip Hermes · esquina sup. izq. ───── */}
      <div style={{
        position:"absolute", top:14, left:14, zIndex:3,
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        width:60, height:60, padding:6,
        borderRadius:14,
        background:"rgba(255,255,255,0.06)",
        border:"1px solid rgba(255,255,255,0.08)",
        backdropFilter:"blur(6px)",
        WebkitBackdropFilter:"blur(6px)",
        opacity: stage === "intro" ? 0 : 1,
        transform: stage === "intro" ? "translateY(-6px)" : "translateY(0)",
        transition:"opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s",
      }}>
        <HermesMark as="logo" size={48} fallback="H" color={AMBER} />
      </div>

      {/* ───── Centro: identidad del negocio + form ───── */}
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

          {/* Logo del negocio (avatar inicial o imagen) */}
          <div style={{
            width:84, height:84, margin:"0 auto", borderRadius:22,
            background: bizColor, color:"#fff",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:42, fontWeight:800,
            boxShadow:`0 12px 32px ${bizColor}55`,
            overflow:"hidden",
            opacity:0, transform:"scale(0.85)",
            animation:"hg-login-logo-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s forwards",
          }}>
            {business.branding?.logoUrl
              ? <img src={business.branding.logoUrl} alt={business.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : bizLetter}
          </div>

          <h1 style={{
            margin:"18px 0 4px",
            fontSize:22, fontWeight:700, letterSpacing:"-0.02em", color:"#fff",
            opacity:0, transform:"translateY(8px)",
            animation:"hg-login-title-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.35s forwards",
          }}>{business.name || "Panel de gestión"}</h1>

          <p style={{
            margin:0, fontSize:11.5, color:"rgba(255,255,255,0.55)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            opacity:0, animation:"hg-login-sub-in 0.7s ease 0.55s forwards",
          }}>Panel de gestión</p>

          {/* Form casi imperceptible */}
          <form onSubmit={handle} style={{
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
              style={{ padding:"13px 16px", borderRadius:12, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.04)", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", transition:"border-color 0.2s, background 0.2s" }}
              onFocus={e=>{ e.target.style.borderColor=AMBER; e.target.style.background="rgba(255,255,255,0.07)"; }}
              onBlur={e=>{ e.target.style.borderColor="rgba(255,255,255,0.12)"; e.target.style.background="rgba(255,255,255,0.04)"; }} />

            <input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} required autoComplete="current-password"
              style={{ padding:"13px 16px", borderRadius:12, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.04)", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", transition:"border-color 0.2s, background 0.2s" }}
              onFocus={e=>{ e.target.style.borderColor=AMBER; e.target.style.background="rgba(255,255,255,0.07)"; }}
              onBlur={e=>{ e.target.style.borderColor="rgba(255,255,255,0.12)"; e.target.style.background="rgba(255,255,255,0.04)"; }} />

            <label style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px", fontSize:12, color:"rgba(255,255,255,0.65)", cursor:"pointer", userSelect:"none", textAlign:"left" }}>
              <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}
                style={{ width:14, height:14, accentColor:AMBER, cursor:"pointer" }} />
              Recordar sesión
            </label>

            {err && (
              <div style={{ padding:"10px 12px", borderRadius:10, background:"rgba(239,68,68,0.12)", color:"#fca5a5", fontSize:12, border:"1px solid rgba(239,68,68,0.25)", textAlign:"left" }}>
                {err}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ marginTop:6, padding:"13px", borderRadius:12, border:0,
                background: loading ? `${AMBER}88` : AMBER, color:"#fff",
                fontSize:14, fontWeight:700, fontFamily:"inherit",
                cursor: loading ? "wait" : "pointer",
                transition:"background 0.2s, transform 0.1s",
                boxShadow:`0 4px 14px ${AMBER}55` }}
              onMouseDown={e=>{ e.currentTarget.style.transform="scale(0.98)"; }}
              onMouseUp={e=>{ e.currentTarget.style.transform="scale(1)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform="scale(1)"; }}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div style={{
            marginTop:28, fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:"0.05em",
            opacity: stage === "intro" ? 0 : 1,
            transition:"opacity 0.6s ease 0.4s",
          }}>
            {business.legal?.copyrightYear ? `© ${business.legal.copyrightYear}` : ""} Hermes Gastro
          </div>
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
