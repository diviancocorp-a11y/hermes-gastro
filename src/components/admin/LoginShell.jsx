// src/components/admin/LoginShell.jsx
// La puerta de entrada, sin saber de quien es: fondo de particulas Volt, splash
// del logo DICO, placa de Dico (o logo del negocio), titulo y la ranura del form.
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
// `children` es una funcion que recibe el `stage` ('intro' | 'form'), porque el
// form tiene que esperar a que termine la entrada para poder tocarse.

import { useState, useEffect } from "react";
import business from "@business";
import FlowFieldBackground from "./FlowFieldBackground";
import DicoNative from "../dico/DicoNative";
import DicoPulso from "../dico/DicoPulso";
import { TIEMPOS } from "./tiemposDeEntrada";
import { GOLD, VOLT, ZINC } from "./loginEstilos";

/* ─────────────── EL ARO DEL LOGO NO SE ADIVINA: SE MIDE ───────────────
 *
 * El splash es un PNG de 1368x452 donde la O es Dico. Para que el pulso Volt
 * caiga EXACTAMENTE sobre el aro que ya trae el arte, hay que saber donde esta
 * ese aro. Medido sobre `public/brand/dico/logo/dico-oscuro.png` (los pixeles
 * azules de la O, ajustando centro y radio por iteracion):
 *
 *   centro del aro   1147,4 / 225,3 px
 *   radio            128,2 px      grosor  26,5 px
 *   el personaje     958..1337 en X  ->  380 px de lado
 *
 * El radio sobre el medio-ancho del personaje da 0,675 — el mismo r/R 0,67 que
 * `DicoNative` midio sobre los assets 2D. Son el mismo aro, y eso es lo que
 * confirma que los numeros estan bien y no tanteados.
 *
 * La caja del overlay es CUADRADA y centrada en el aro: el SVG de DicoPulso no
 * declara `preserveAspectRatio`, asi que en una caja no cuadrada el navegador
 * lo encajaria con letterbox y el aro quedaria corrido. */
const ARO_LOGO = {
  izquierda: `${(957.42 / 1368) * 100}%`,
  arriba: `${(35.31 / 452) * 100}%`,
  lado: 380,
  radio: +((128.16 / 380) * 100).toFixed(2),
  grosor: +((26.5 / 380) * 100).toFixed(2),
};

export default function LoginShell({
  pastilla, titulo, subtitulo, children,
  logoUrl = null, bizColor = GOLD,
  fontFamily = "system-ui,-apple-system,sans-serif",
  colorPie = "rgba(255,255,255,0.3)",
}) {
  const [stage, setStage] = useState("intro");
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [saluda, setSaluda] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStage("form"), TIEMPOS.intro);
    return () => clearTimeout(t);
  }, []);

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
          animation:`hg-splash-in ${TIEMPOS.entrada}ms cubic-bezier(0.22,1,0.36,1) forwards`,
          filter:`drop-shadow(0 18px 56px ${GOLD}55)`,
        }}>
          {/* El logo y, encima, el pulso Volt sobre el aro que ya trae la O.
              No se repinta el PNG: la senial es una capa aparte, que es para
              lo que existe `DicoPulso`. Late mientras dura la entrada — el
              sistema se enciende antes de abrirte la puerta. */}
          <div style={{ position:"relative" }}>
            <img
              src="/brand/dico/logo/dico-oscuro.png"
              alt="DICO"
              width="1368"
              height="452"
              style={{ display:"block", width:"100%", height:"auto" }}
            />
            <div style={{
              position:"absolute",
              left: ARO_LOGO.izquierda,
              top: ARO_LOGO.arriba,
              width: `${(ARO_LOGO.lado / 1368) * 100}%`,
              aspectRatio: "1 / 1",
              pointerEvents:"none",
            }}>
              <DicoPulso
                className="hg-splash-aro"
                activity="active"
                radio={ARO_LOGO.radio}
                grosor={ARO_LOGO.grosor}
              />
            </div>
          </div>
        </div>
      </div>

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
            opacity: stage === "intro" ? 0 : 1,
            transform: stage === "intro" ? "translateY(-8px)" : "translateY(0)",
            transition:"opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s",
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
        /* El latido del splash.
           La espera es EXACTAMENTE lo que tarda el logo en asentarse: el aro
           arranca apagado —\`brillo\` nace en opacidad 0 y sin \`fill-mode\` la
           espera lo deja asi— y enciende recien cuando la marca ya esta
           quieta. Asi los dos latidos se ven enteros en vez de empezar
           mientras el logo todavia esta entrando.
           La regla gana por ESPECIFICIDAD y no por orden: \`pulso.css\` se
           importa desde el componente y el orden entre esa hoja y este bloque
           no esta garantizado. */
        .hg-splash-aro.dico-pulso--active .dico-pulso-brillo {
          animation-duration: ${TIEMPOS.latido}ms;
          animation-delay: ${TIEMPOS.entrada}ms;
          animation-iteration-count: ${TIEMPOS.latidos};
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
