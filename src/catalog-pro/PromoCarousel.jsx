// src/catalog-pro/PromoCarousel.jsx
// Carrusel de promos — adaptacion del "circular image gallery" que paso el
// user (card cuadrada, burbujas-thumbnail abajo, la imagen nueva entra como
// un circulo que se expande desde su burbuja). El original usa GSAP +
// MotionPath; aca el mismo efecto se logra con clip-path: circle() animado
// por CSS — cero dependencias, fiel al stack (JS puro + tokens).
//
// Slides: Ranking semanal (abre podio), Regalo de cumple (CTA perfil),
// Pedidos programados. Fotos reales del tenant (fallback: gradiente + emoji).
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGuestUser } from "../lib/guestUser.js";
import { useWeeklyTop, useMyRanking } from "./useTopCustomers";

const AUTO_PLAY_MS = 4500;
const REVEAL_MS = 650;
const DOT_SIZE = 30;   // diametro de las burbujas-thumbnail
const DOT_GAP = 10;
const DOT_BOTTOM = 24; // distancia de las burbujas al borde inferior
const MEDALS = ["🥇", "🥈", "🥉"];

/* ---------- Podio + lista (adaptacion del leaderboard-card) ---------- */
function LeaderboardModal({ top, onClose }) {
  const { user, profile } = useAuth();
  const guest = useGuestUser();
  const myEmail = user?.email || guest?.email || "";
  const myPhone = profile?.phone || guest?.phone || "";
  const { ranking } = useMyRanking({ email: myEmail, phone: myPhone });

  const podium = top.slice(0, 3);
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
  const heights = { 1: 92, 2: 66, 3: 50 };
  const rest = top.slice(3);

  return (
    <div className="cp-root" onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 8000,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      animation: "cp-promo-fade 250ms ease both",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto",
        background: "var(--bg, #FBF7F2)", borderRadius: 24,
        border: "1px solid var(--line, #E8DFD2)", padding: "22px 20px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: "cp-promo-pop 350ms cubic-bezier(0.34,1.56,0.64,1) both",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-heading, 'DM Serif Display', serif)", fontSize: 22, margin: 0, color: "var(--tx, #2D2418)" }}>
              Ranking semanal
            </h2>
            <p style={{ fontSize: 12, color: "var(--t2, #8A7A66)", margin: "3px 0 0", lineHeight: 1.4 }}>
              Cada $10.000 = 1 punto · los lunes premiamos al podio
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{
            width: 32, height: 32, borderRadius: 99, border: "none", flexShrink: 0,
            background: "var(--b2, #F4EDE3)", color: "var(--t2, #8A7A66)",
            fontSize: 15, cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>

        {podiumOrder.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10, margin: "18px 0 6px" }}>
            {podiumOrder.map((row) => {
              const pos = row.rank_position ?? row.position;
              return (
                <div key={pos} style={{ flex: 1, maxWidth: 110, textAlign: "center" }}>
                  <div style={{ fontSize: pos === 1 ? 30 : 24, marginBottom: 2 }}>{MEDALS[pos - 1]}</div>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: "var(--tx, #2D2418)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6,
                  }}>{row.display_name}</div>
                  <div style={{
                    height: heights[pos] || 50, borderRadius: "10px 10px 0 0",
                    background: pos === 1
                      ? "var(--ac, #D97706)"
                      : "color-mix(in srgb, var(--ac, #D97706) 35%, transparent)",
                    display: "flex", alignItems: "flex-start", justifyContent: "center",
                    paddingTop: 8, color: pos === 1 ? "#fff" : "var(--tx, #2D2418)",
                    fontSize: 13, fontWeight: 800,
                  }}>
                    {row.points} pts
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rest.length > 0 && (
          <div style={{ borderTop: "1px solid var(--line, #E8DFD2)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {rest.map((row) => {
              const pos = row.rank_position ?? row.position;
              return (
                <div key={pos} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ color: "var(--t3, #B0A48F)", fontWeight: 700 }}>{pos}.</span>
                  <span style={{ color: "var(--tx, #2D2418)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.display_name}</span>
                  <span style={{ color: "var(--t2, #8A7A66)", fontWeight: 700 }}>{row.points} pts</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line, #E8DFD2)", fontSize: 12.5, color: "var(--t2, #8A7A66)", textAlign: "center", lineHeight: 1.5 }}>
          {ranking
            ? <>📍 Vos sos <strong style={{ color: "var(--ac, #D97706)" }}>#{ranking.my_position}</strong> con {ranking.my_points} pts{ranking.my_position > 5 && ranking.points_to_top5 > 0 ? ` · te faltan ${ranking.points_to_top5} pts para el top 5` : ""}</>
            : (myEmail || myPhone)
              ? "Aún no sumaste puntos esta semana. Tu próximo pedido te pone en el ranking."
              : "Hacé tu primer pedido y empezás a sumar puntos."}
        </div>
      </div>
    </div>
  );
}

/* ---------- Visual de un slide (foto o gradiente+emoji) ---------- */
function SlideVisual({ slide }) {
  if (slide.img) {
    return <img src={slide.img} alt={slide.label} loading="lazy" draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  }
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(155deg, color-mix(in srgb, var(--ac, #D97706) 60%, #1a1611), #1a1611)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 120, opacity: 0.92 }} aria-hidden>{slide.emoji}</span>
    </div>
  );
}

/* ---------- Carrusel circular ---------- */
export default function PromoCarousel({ onOpenAccount, products = [] }) {
  const { top, loading: topLoading } = useWeeklyTop();
  const [showBoard, setShowBoard] = useState(false);

  const imgs = products.filter((p) => p.image_url).map((p) => p.image_url);
  const slides = [];
  if (topLoading || top.length > 0) {
    slides.push({
      id: "ranking", emoji: "🏆", label: "Ranking semanal", img: imgs[0] || null,
      desc: "Cada $10.000 suma 1 punto. Los lunes premiamos al podio.",
      cta: "Ver ranking", onCta: () => setShowBoard(true),
    });
  }
  slides.push({
    id: "cumple", emoji: "🎂", label: "Regalo de cumple", img: imgs[1] || null,
    desc: "Contanos tu fecha de nacimiento y tu cumple llega con regalo.",
    cta: "Completar mi perfil", onCta: () => onOpenAccount?.(),
  });
  slides.push({
    id: "programados", emoji: "📅", label: "Pedidos programados", img: imgs[2] || null,
    desc: "Elegí día y horario en el checkout. Tu pedido sale justo a tiempo.",
  });
  const len = slides.length;

  // base = slide ya asentado; incoming = el que entra con el circulo
  const [base, setBase] = useState(0);
  const [incoming, setIncoming] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const busy = incoming !== null;
  const pauseUntil = useRef(0);

  const goTo = useCallback((index) => {
    setIncoming((cur) => {
      if (cur !== null) return cur; // animacion en curso: ignorar
      return index;
    });
  }, []);

  // Al montar el incoming: 2 RAF para que el clip chico pinte antes de expandir
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
  const prev = useCallback(() => goTo((base - 1 + len) % len), [base, len, goTo]);
  const userGo = (fn) => { pauseUntil.current = Date.now() + 9000; fn(); };

  // Autoplay
  useEffect(() => {
    if (len < 2) return;
    const t = setInterval(() => {
      if (busy || showBoard || Date.now() < pauseUntil.current) return;
      next();
    }, AUTO_PLAY_MS);
    return () => clearInterval(t);
  }, [len, busy, showBoard, next]);

  if (len === 0) return null;
  const active = incoming ?? base;
  const slide = slides[active];

  // Centro de la burbuja i (el circulo de reveal nace exactamente ahi)
  const dotOffset = (i) => (i - (len - 1) / 2) * (DOT_SIZE + DOT_GAP);
  const clipFrom = (i) =>
    `circle(${DOT_SIZE / 2}px at calc(50% + ${dotOffset(i)}px) calc(100% - ${DOT_BOTTOM + DOT_SIZE / 2}px))`;
  const clipFull = `circle(135% at 50% 50%)`;

  return (
    <div style={{ padding: "18px 16px 26px", display: "flex", justifyContent: "center" }}>
      <div className="cp-pcg-card">
        {/* Capa base (slide asentado) */}
        <div style={{ position: "absolute", inset: 0 }}>
          <SlideVisual slide={slides[base]} />
        </div>

        {/* Capa entrante: circulo que se expande desde su burbuja */}
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

        {/* Velo para legibilidad del texto */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(0,0,0,0.35), transparent 32%, transparent 50%, rgba(0,0,0,0.72))",
        }} />

        {/* Texto del slide activo */}
        <div key={slide.id} style={{
          position: "absolute", left: 20, right: 20, top: 18, zIndex: 20,
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
          position: "absolute", left: 20, right: 20, zIndex: 20,
          bottom: DOT_BOTTOM + DOT_SIZE + 16,
          animation: "cp-pcg-rise 450ms ease 80ms both",
        }}>
          <p style={{
            color: "#fff", fontSize: 19, lineHeight: 1.3, margin: 0,
            letterSpacing: "-0.01em", textShadow: "0 2px 10px rgba(0,0,0,0.5)", maxWidth: 340,
          }}>{slide.desc}</p>
          {slide.cta && (
            <button onClick={slide.onCta} style={{
              marginTop: 10, padding: "9px 18px", borderRadius: 999, border: "none",
              background: "#fff", color: "#1a1611", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>{slide.cta} →</button>
          )}
        </div>

        {/* Burbujas-thumbnail (tabs del original) */}
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
                  {s.img
                    ? <img src={s.img} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ width: "100%", height: "100%", background: "color-mix(in srgb, var(--ac, #D97706) 70%, #1a1611)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }} aria-hidden>{s.emoji}</div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Flechas (blancas redondas, dentro de la card — mobile friendly) */}
        <button onClick={() => !busy && userGo(prev)} disabled={busy} aria-label="Anterior" className="cp-pcg-arrow" style={{ left: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <button onClick={() => !busy && userGo(next)} disabled={busy} aria-label="Siguiente" className="cp-pcg-arrow" style={{ right: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {showBoard && <LeaderboardModal top={top} onClose={() => setShowBoard(false)} />}

      <style>{`
        .cp-pcg-card {
          position: relative; width: 100%; max-width: 460px;
          aspect-ratio: 1 / 1; overflow: hidden; border-radius: 20px;
          background: #1a1611;
          box-shadow: 0 2.8px 2.2px rgba(0,0,0,0.02), 0 6.7px 5.3px rgba(0,0,0,0.028),
            0 12.5px 10px rgba(0,0,0,0.035), 0 22.3px 17.9px rgba(0,0,0,0.042),
            0 41.8px 33.4px rgba(0,0,0,0.05), 0 100px 80px rgba(0,0,0,0.07);
        }
        .cp-pcg-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 30;
          width: 42px; height: 42px; border-radius: 999px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.92); color: #1a1611;
          border: 2px solid rgba(255,255,255,0.3); cursor: pointer;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          transition: transform 250ms ease, opacity 250ms ease;
        }
        .cp-pcg-arrow:hover { transform: translateY(-50%) scale(1.1); }
        .cp-pcg-arrow:active { transform: translateY(-50%) scale(0.94); }
        .cp-pcg-arrow:disabled { opacity: 0.4; cursor: default; }
        @keyframes cp-pcg-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cp-promo-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cp-promo-pop { from { opacity: 0; transform: scale(0.9) translateY(14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .cp-pcg-card * { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  );
}
