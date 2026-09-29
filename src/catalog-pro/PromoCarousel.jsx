// src/catalog-pro/PromoCarousel.jsx
// Carrusel de promos (galeria circular: card 4/5, reveal clip-path circle
// desde las burbujas-thumbnail). Sin GSAP/Tailwind: CSS + tokens.
//
// Hasta el 29/sep tenia ademas un slide de RANKING semanal (podio + posicion
// del cliente) sobre get_weekly_top/get_my_ranking, RPC del legacy que el
// edificio no tiene: el slide nunca aparecia y cada visita mandaba un 404 a
// Sentry. Si vuelve, vuelve con sus RPC en platform/migrations.
import { useEffect, useRef, useState, useCallback } from "react";
import useMediaQuery from "../lib/useMediaQuery";

const AUTO_PLAY_MS = 4500;
const TOUCH_HOLD_MS = 15000; // si alguien toco, esta leyendo: pausa larga
const REVEAL_MS = 650;
const DOT_SIZE = 30;
const DOT_GAP = 10;
const DOT_BOTTOM = 20;

/* ---------- Fondo de gradientes animados (adaptacion del
   BackgroundGradientAnimation de aceternity, sin Tailwind: blobs radiales
   con mix-blend-mode + keyframes CSS, colores derivados del acento) ---------- */
function GradientBackdrop() {
  const blob = (color, anim, origin, opacity = 1) => (
    <div aria-hidden style={{
      position: "absolute", width: "80%", height: "80%",
      top: "10%", left: "10%", borderRadius: "50%",
      background: `radial-gradient(circle at center, ${color} 0, transparent 50%)`,
      mixBlendMode: "hard-light", transformOrigin: origin, opacity,
      animation: anim,
    }} />
  );
  return (
    <div style={{
      position: "absolute", inset: 0, overflow: "hidden",
      background: "linear-gradient(40deg, color-mix(in srgb, var(--ac, #D97706) 40%, #14100c), #14100c)",
    }}>
      <div style={{ position: "absolute", inset: 0, filter: "blur(36px)" }}>
        {blob("color-mix(in srgb, var(--ac, #D97706) 85%, transparent)", "cp-pcg-vert 30s ease infinite", "center center")}
        {blob("rgba(232, 93, 117, 0.7)", "cp-pcg-circle 20s reverse infinite", "calc(50% - 200px)")}
        {blob("rgba(242, 193, 78, 0.7)", "cp-pcg-circle 40s linear infinite", "calc(50% + 200px)")}
        {blob("rgba(160, 106, 51, 0.75)", "cp-pcg-horiz 40s ease infinite", "calc(50% - 100px)", 0.7)}
        {blob("color-mix(in srgb, var(--ac, #D97706) 65%, #fff)", "cp-pcg-circle 24s ease infinite", "calc(50% - 300px) calc(50% + 300px)", 0.8)}
      </div>
    </div>
  );
}

/* ---------- Visual de un slide: fondo animado + emoji ---------- */
function SlideVisual({ slide }) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <GradientBackdrop />
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 120, filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))" }} aria-hidden>
          {slide.emoji}
        </span>
      </div>
    </div>
  );
}

/* ---------- Carrusel circular ---------- */
export default function PromoCarousel({ onOpenAccount }) {
  const slides = [
    {
      id: "cumple", emoji: "🎂", label: "Regalo de cumple",
      desc: "Contanos tu fecha de nacimiento y tu cumple llega con regalo.",
      cta: "Completar mi perfil", onCta: () => onOpenAccount?.(),
    },
    {
      id: "programados", emoji: "📅", label: "Pedidos programados",
      desc: "Elegí día y horario en el checkout. Tu pedido sale justo a tiempo.",
    },
  ];
  const len = slides.length;

  // El slide actual se recuerda por ID, no por indice: si la lista cambia, el
  // indice 0 pasa a ser otro slide y quien estaba mirando uno se encontraba
  // con otro sin haber tocado nada.
  const [baseId, setBaseId] = useState(null);
  const base = Math.max(0, slides.findIndex((s) => s.id === baseId));
  const setBase = useCallback((indice) => {
    setBaseId((previo) => {
      const destino = slides[indice];
      return destino ? destino.id : previo;
    });
  }, [slides]);
  const [incoming, setIncoming] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const busy = incoming !== null;
  const pauseUntil = useRef(0);

  const goTo = useCallback((index) => {
    setIncoming((cur) => (cur !== null ? cur : index));
  }, []);

  useEffect(() => {
    if (incoming === null) return;
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setRevealed(true)); });
    const t = setTimeout(() => {
      setBase(incoming);
      setIncoming(null);
      setRevealed(false);
    }, REVEAL_MS + 80);
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); clearTimeout(t); };
  }, [incoming]);

  const next = useCallback(() => goTo((base + 1) % len), [base, len, goTo]);
  // Toco algo = esta mirando/analizando → pausa larga, renovable con cada toque
  const holdAutoplay = () => { pauseUntil.current = Date.now() + TOUCH_HOLD_MS; };
  const userGo = (fn) => { holdAutoplay(); fn(); };

  // El CSS de mas abajo apagaba las transiciones con reduced motion, pero el
  // carrusel SEGUIA avanzando solo cada 4,5s: contenido que se actualiza sin
  // que el usuario pueda pararlo, que es justo lo que WCAG 2.2.2 pide evitar.
  //
  // Y de paso arregla un nondeterminismo real del gate: el avance es un
  // `setInterval`, o sea un timer de JS que el harness no puede congelar —el
  // mismo caso que el verbo rotante del home—, asi que dos corridas del MISMO
  // commit podian fotografiar el carrusel con la capa de transicion montada o
  // sin ella. Los pixeles daban identicos y el DOM no.
  const menosMovimiento = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    if (len < 2 || menosMovimiento) return;
    const t = setInterval(() => {
      if (busy || hovering || Date.now() < pauseUntil.current) return;
      next();
    }, AUTO_PLAY_MS);
    return () => clearInterval(t);
  }, [len, busy, hovering, next, menosMovimiento]);

  const active = incoming ?? base;
  const slide = slides[active];

  const dotOffset = (i) => (i - (len - 1) / 2) * (DOT_SIZE + DOT_GAP);
  const clipFrom = (i) =>
    `circle(${DOT_SIZE / 2}px at calc(50% + ${dotOffset(i)}px) calc(100% - ${DOT_BOTTOM + DOT_SIZE / 2}px))`;
  const clipFull = `circle(140% at 50% 50%)`;

  return (
    <div style={{ padding: "18px 16px 26px", display: "flex", justifyContent: "center" }}>
      <div className="cp-pcg-card"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onTouchStart={holdAutoplay}
      >
        <div style={{ position: "absolute", inset: 0 }}>
          <SlideVisual slide={slides[base]} />
        </div>

        {incoming !== null && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 5,
            clipPath: revealed ? clipFull : clipFrom(incoming),
            WebkitClipPath: revealed ? clipFull : clipFrom(incoming),
            transition: `clip-path ${REVEAL_MS}ms cubic-bezier(0.5, 0, 0.15, 1), -webkit-clip-path ${REVEAL_MS}ms cubic-bezier(0.5, 0, 0.15, 1)`,
          }}>
            <SlideVisual slide={slides[incoming]} />
          </div>
        )}

        {/* Velo inferior para el texto sobre el fondo */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(0,0,0,0.35), transparent 32%, transparent 50%, rgba(0,0,0,0.72))",
        }} />

        <div key={slide.id} style={{
          position: "absolute", left: 18, right: 18, top: 16, zIndex: 20,
          animation: "cp-pcg-rise 450ms ease both",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.92)", color: "#1a1611",
            padding: "5px 13px", borderRadius: 999,
            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em",
          }}>
            <span aria-hidden>{slide.emoji}</span> {active + 1} • {slide.label}
          </div>
        </div>

        <div key={slide.id + "-b"} style={{
          position: "absolute", left: 18, right: 18, zIndex: 20,
          bottom: DOT_BOTTOM + DOT_SIZE + 14,
          animation: "cp-pcg-rise 450ms ease 80ms both",
        }}>
          {slide.desc && (
            <p style={{
              color: "#fff", fontSize: 19, lineHeight: 1.3, margin: "0 0 10px",
              letterSpacing: "-0.01em", textShadow: "0 2px 10px rgba(0,0,0,0.5)", maxWidth: 340,
            }}>{slide.desc}</p>
          )}
          {slide.cta && (
            <button onClick={() => { holdAutoplay(); slide.onCta?.(); }} style={{
              padding: "9px 18px", borderRadius: 999, border: "none",
              background: "#fff", color: "#1a1611", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>{slide.cta} →</button>
          )}
        </div>

        <div style={{
          position: "absolute", bottom: DOT_BOTTOM, left: 0, right: 0, zIndex: 30,
          display: "flex", justifyContent: "center", gap: DOT_GAP,
        }}>
          {slides.map((s, i) => {
            const isActive = i === active;
            return (
              <button key={s.id} onClick={() => !busy && userGo(() => goTo(i))}
                aria-label={s.label} disabled={busy}
                style={{
                  width: DOT_SIZE, height: DOT_SIZE, borderRadius: 999, padding: 0,
                  overflow: "hidden", cursor: busy ? "default" : "pointer",
                  border: isActive ? "2px solid #fff" : "2px solid rgba(255,255,255,0.55)",
                  boxShadow: isActive ? "0 0 0 2px rgba(255,255,255,0.25), 0 4px 12px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.3)",
                  transform: isActive ? "scale(1.18)" : "scale(1)",
                  transition: "transform 300ms ease, border-color 300ms ease, box-shadow 300ms ease",
                  background: "transparent",
                }}>
                <div style={{ width: "100%", height: "100%" }}>
                  <div style={{ width: "100%", height: "100%", background: "color-mix(in srgb, var(--ac, #D97706) 70%, #1a1611)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }} aria-hidden>{s.emoji}</div>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      <style>{`
        .cp-pcg-card {
          position: relative; width: 100%; max-width: 440px;
          /* isolation: los z-index internos (badge, burbujas, CTA) quedan
             contenidos en el card y nunca superan al header sticky del home */
          isolation: isolate; z-index: 0;
          /* No pintar/animar fuera de pantalla: los blobs con blur son caros
             en el WebView de Instagram (jank de scroll) */
          content-visibility: auto;
          contain-intrinsic-size: 440px 640px;
          /* Alto fijo heredado del slide de ranking (se borro el 29/sep): se
             deja igual para no mover el layout del home ni los goldens. */
          aspect-ratio: 4 / 5; min-height: 610px;
          overflow: hidden; border-radius: 20px;
          background: #1a1611;
          box-shadow: 0 2.8px 2.2px rgba(0,0,0,0.02), 0 6.7px 5.3px rgba(0,0,0,0.028),
            0 12.5px 10px rgba(0,0,0,0.035), 0 22.3px 17.9px rgba(0,0,0,0.042),
            0 41.8px 33.4px rgba(0,0,0,0.05), 0 100px 80px rgba(0,0,0,0.07);
        }
        @keyframes cp-pcg-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        /* keyframes de los blobs (adaptados del BackgroundGradientAnimation) */
        @keyframes cp-pcg-vert {
          0% { transform: translateY(-50%); }
          50% { transform: translateY(50%); }
          100% { transform: translateY(-50%); }
        }
        @keyframes cp-pcg-horiz {
          0% { transform: translateX(-50%) translateY(-10%); }
          50% { transform: translateX(50%) translateY(10%); }
          100% { transform: translateX(-50%) translateY(-10%); }
        }
        @keyframes cp-pcg-circle {
          0% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cp-pcg-card * { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  );
}
