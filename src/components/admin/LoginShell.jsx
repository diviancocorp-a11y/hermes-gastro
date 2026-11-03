// src/components/admin/LoginShell.jsx
// La puerta de entrada, sin saber de quien es: fondo de particulas Volt, placa
// de Dico (o logo del negocio), titulo y la ranura del form. El intro del logo
// DICO NO esta aca: es `IntroDico`, y se ve al abrir el negocio, no al loguearse.
// La usan el login del admin de cada tenant (`LoginScreen`, con su marca) y la
// entrada unica `/entrar` (`pages/Login`, con la marca Dico fija).
//
// ─────────────────────────── EL COLOR DICE QUÉ ES ───────────────────────────
//
// El fondo de partículas es VOLT, que en el sistema significa "actividad
// interna, nunca protagonista": es literalmente el flujo de la máquina
// trabajando detrás. El ORO aparece sólo donde hay presencia o acción — unas
// pocas partículas, el aro de Dico y el botón de entrar. Es la misma regla que
// gobierna el panel, aplicada a la puerta de entrada.
//
// `children` es una funcion que recibe el `stage`, siempre 'form': el form se
// puede tocar enseguida.

import { useState } from "react";
import business from "@business";
import FlowFieldBackground from "./FlowFieldBackground";
import DicoNative from "../dico/DicoNative";
import { GOLD, VOLT, ZINC } from "./loginEstilos";

export default function LoginShell({
  pastilla, titulo, subtitulo, children,
  logoUrl = null, bizColor = GOLD,
  fontFamily = "system-ui,-apple-system,sans-serif",
  colorPie = "rgba(255,255,255,0.3)",
}) {
  const stage = "form";
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [saluda, setSaluda] = useState(false);

  /* El aro de Dico en la placa. Dos estados, y el hover manda.
   *
   * En reposo GIRA: la puerta de entrada es la unica pantalla donde el sistema
   * no tiene un trabajo concreto que mostrar, y el aro girando dice que del
   * otro lado hay algo encendido esperando. Es una decision de esta pantalla,
   * no la regla general — adentro del panel `processing` sigue significando
   * trabajo en curso y no se usa de adorno.
   *
   * Al pasarle el mouse LATE: Dico deja de trabajar y te contesta, junto con
   * el cambio de cara. Es la respuesta al gesto, y por eso le gana al giro. */
  const actividadDelAro = saluda ? "active" : "processing";
  const nombre = titulo || "";

  return (
    <div style={{ position:"fixed", inset:0, fontFamily, color:"#fff", overflow:"hidden" }}>
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

      {/* Centro: identidad + ranura del form. Si el contenido es mas alto que
          la pantalla (selector con muchos negocios, teclado abierto en el
          movil) la columna scrollea en vez de desbordar. */}
      <div style={{ position:"relative", zIndex:2, width:"100%", height:"100%", display:"flex", overflowY:"auto" }}>
        <div style={{ width:"100%", maxWidth:380, margin:"auto", padding:"24px", textAlign:"center", boxSizing:"border-box" }}>

          <div style={{
            display:"inline-block", padding:"5px 14px",
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:999, color:"rgba(255,255,255,0.65)",
            fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
            marginBottom:24, backdropFilter:"blur(4px)",
          }}>
            {pastilla}
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
                    alt={nombre}
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
                      {nombre.charAt(0).toUpperCase()}
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
                    activity={actividadDelAro}
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
          }}>{titulo}</h1>

          <p style={{
            margin:0, fontSize:11.5, color:"rgba(255,255,255,0.55)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            opacity:0, animation:"hg-login-sub-in 0.7s ease 0.55s forwards",
          }}>{subtitulo}</p>

          {children(stage)}

          <div style={{
            marginTop:28, fontSize:10, color:colorPie, letterSpacing:"0.05em",
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
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
