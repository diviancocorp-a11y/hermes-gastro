// src/catalog-pro/PromoCarousel.jsx
// Carrusel de promos — recreacion FIEL del FeatureCarousel TSX que paso el
// user (split panel: izquierda color acento con rueda vertical de chips,
// derecha panel oscuro con cards apiladas 4/5 que rotan), pero en el stack
// propio: JS puro + CSS con tokens, sin motion/Tailwind/hugeicons.
//
// Slides: Ranking semanal (abre podio), Regalo de cumple (CTA perfil),
// Pedidos programados. Las fotos salen de los productos del tenant
// (fallback: panel tintado con emoji gigante).
//
// Ruleta y encuesta de sabores: en TAREAS-MANUALES (backend pendiente).
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGuestUser } from "../lib/guestUser.js";
import { useWeeklyTop, useMyRanking } from "./useTopCustomers";

const AUTO_PLAY_MS = 4000;
const ITEM_H = 58; // alto de cada chip en la rueda (equivale al ITEM_HEIGHT=65 del original)
const MEDALS = ["🥇", "🥈", "🥉"];

// wrap() del original: distancia circular para la rueda de chips
const wrap = (min, max, v) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

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

/* ---------- Carrusel (recreacion fiel del FeatureCarousel) ---------- */
export default function PromoCarousel({ onOpenAccount, products = [] }) {
  const { top, loading: topLoading } = useWeeklyTop();
  const [showBoard, setShowBoard] = useState(false);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchPause = useRef(0);

  // Fotos reales del tenant para las cards (distintas por slide)
  const imgs = products.filter((p) => p.image_url).map((p) => p.image_url);

  const slides = [];
  if (topLoading || top.length > 0) {
    slides.push({
      id: "ranking", emoji: "🏆", label: "Ranking semanal", live: true,
      img: imgs[0] || null,
      desc: "Cada $10.000 en pedidos suma 1 punto. Los lunes premiamos al podio.",
      cta: "Ver ranking", onCta: () => setShowBoard(true),
    });
  }
  slides.push({
    id: "cumple", emoji: "🎂", label: "Regalo de cumple",
    img: imgs[1] || null,
    desc: "Contanos tu fecha de nacimiento y el día de tu cumple te espera un regalo.",
    cta: "Completar mi perfil", onCta: () => onOpenAccount?.(),
  });
  slides.push({
    id: "programados", emoji: "📅", label: "Pedidos programados",
    img: imgs[2] || null,
    desc: "Elegí día y horario en el checkout y tu pedido sale justo a tiempo.",
  });

  const len = slides.length;
  const currentIndex = ((step % len) + len) % len;

  useEffect(() => {
    if (len < 2) return;
    const t = setInterval(() => {
      if (paused || showBoard || Date.now() < touchPause.current) return;
      setStep((s) => s + 1);
    }, AUTO_PLAY_MS);
    return () => clearInterval(t);
  }, [len, paused, showBoard]);

  // Mismo comportamiento que el original: el click avanza hacia adelante
  const handleChipClick = (index) => {
    touchPause.current = Date.now() + 8000;
    const diff = (index - currentIndex + len) % len;
    if (diff > 0) setStep((s) => s + diff);
  };

  // Estado de cada card en la pila (active / prev / next / hidden)
  const getCardStatus = (index) => {
    let d = index - currentIndex;
    if (d > len / 2) d -= len;
    if (d < -len / 2) d += len;
    if (d === 0) return "active";
    if (d === -1) return "prev";
    if (d === 1) return "next";
    return "hidden";
  };

  if (len === 0) return null;

  return (
    <div style={{ padding: "18px 16px 26px" }}>
      <div className="cp-pc2-wrap">
        {/* ===== Panel izquierdo: rueda vertical de chips sobre color acento ===== */}
        <div className="cp-pc2-left">
          <div className="cp-pc2-fade cp-pc2-fade-top" />
          <div className="cp-pc2-fade cp-pc2-fade-bottom" />
          <div className="cp-pc2-wheel">
            {slides.map((s, index) => {
              const isActive = index === currentIndex;
              const wd = wrap(-(len / 2), len / 2, index - currentIndex);
              return (
                <div key={s.id} className="cp-pc2-chip-slot" style={{
                  height: ITEM_H,
                  transform: `translateY(${wd * ITEM_H}px)`,
                  opacity: 1 - Math.abs(wd) * 0.3,
                  zIndex: isActive ? 10 : 1,
                }}>
                  <button
                    onClick={() => handleChipClick(index)}
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    className={"cp-pc2-chip" + (isActive ? " is-active" : "")}
                  >
                    <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>{s.emoji}</span>
                    <span className="cp-pc2-chip-label">{s.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== Panel derecho: pila de cards 4/5 ===== */}
        <div className="cp-pc2-right">
          <div className="cp-pc2-stage">
            {slides.map((s, index) => {
              const status = getCardStatus(index);
              const isActive = status === "active";
              const isPrev = status === "prev";
              const isNext = status === "next";
              return (
                <div key={s.id} className="cp-pc2-card" style={{
                  transform: `translateX(${isActive ? 0 : isPrev ? -70 : isNext ? 70 : 0}px) scale(${isActive ? 1 : isPrev || isNext ? 0.85 : 0.7}) rotate(${isPrev ? -3 : isNext ? 3 : 0}deg)`,
                  opacity: isActive ? 1 : isPrev || isNext ? 0.4 : 0,
                  zIndex: isActive ? 20 : isPrev || isNext ? 10 : 0,
                  pointerEvents: isActive ? "auto" : "none",
                }}>
                  {/* Foto del tenant o fallback tintado con emoji */}
                  {s.img ? (
                    <img src={s.img} alt={s.label} loading="lazy" className="cp-pc2-img" style={{
                      filter: isActive ? "none" : "grayscale(1) blur(2px) brightness(0.75)",
                    }} />
                  ) : (
                    <div className="cp-pc2-img" style={{
                      background: "linear-gradient(160deg, color-mix(in srgb, var(--ac, #D97706) 55%, #1a1611), #1a1611)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      filter: isActive ? "none" : "grayscale(1) blur(2px) brightness(0.75)",
                    }}>
                      <span style={{ fontSize: 110, opacity: 0.9 }} aria-hidden>{s.emoji}</span>
                    </div>
                  )}

                  {/* Punto "en vivo" arriba a la izquierda (como el original) */}
                  <div style={{
                    position: "absolute", top: 22, left: 22, display: "flex", alignItems: "center", gap: 8,
                    opacity: isActive && s.live ? 1 : 0, transition: "opacity 300ms ease",
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: "#fff", boxShadow: "0 0 10px #fff" }} />
                    <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.3em", fontFamily: "monospace" }}>
                      Esta semana
                    </span>
                  </div>

                  {/* Caption inferior con gradiente, badge y descripcion */}
                  <div className="cp-pc2-caption" style={{ opacity: isActive ? 1 : 0, transform: isActive ? "translateY(0)" : "translateY(12px)" }}>
                    <div className="cp-pc2-badge">{index + 1} • {s.label}</div>
                    <p className="cp-pc2-desc">{s.desc}</p>
                    {s.cta && (
                      <button onClick={s.onCta} className="cp-pc2-cta">{s.cta} →</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showBoard && <LeaderboardModal top={top} onClose={() => setShowBoard(false)} />}

      <style>{`
        .cp-pc2-wrap {
          position: relative; overflow: hidden; border-radius: 2.5rem;
          display: flex; flex-direction: column;
          border: 1px solid var(--line, #E8DFD2);
        }
        /* --- izquierda --- */
        .cp-pc2-left {
          position: relative; z-index: 30; overflow: hidden;
          background: var(--ac, #D97706);
          min-height: 280px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 28px;
        }
        .cp-pc2-fade { position: absolute; left: 0; right: 0; height: 56px; z-index: 40; pointer-events: none; }
        .cp-pc2-fade-top { top: 0; background: linear-gradient(180deg, var(--ac, #D97706), transparent); }
        .cp-pc2-fade-bottom { bottom: 0; background: linear-gradient(0deg, var(--ac, #D97706), transparent); }
        .cp-pc2-wheel { position: relative; width: 100%; height: 100%; min-height: inherit; display: flex; align-items: center; justify-content: center; z-index: 20; }
        .cp-pc2-chip-slot {
          position: absolute; display: flex; align-items: center; justify-content: flex-start;
          transition: transform 650ms cubic-bezier(0.25, 1, 0.35, 1), opacity 650ms ease;
          will-change: transform;
        }
        .cp-pc2-chip {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 22px; border-radius: 999px; cursor: pointer;
          font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase;
          white-space: nowrap; font-weight: 500; font-family: inherit;
          background: transparent; color: rgba(255,255,255,0.6);
          border: 1px solid rgba(255,255,255,0.25);
          transition: background 600ms ease, color 600ms ease, border-color 600ms ease;
        }
        .cp-pc2-chip:hover { border-color: rgba(255,255,255,0.5); color: #fff; }
        .cp-pc2-chip.is-active { background: #fff; color: var(--ac, #D97706); border-color: #fff; }
        /* --- derecha --- */
        .cp-pc2-right {
          flex: 1; position: relative; overflow: hidden;
          background: color-mix(in srgb, var(--tx, #2D2418) 92%, var(--bg, #FBF7F2));
          display: flex; align-items: center; justify-content: center;
          padding: 44px 24px;
          border-top: 1px solid var(--line, #E8DFD2);
        }
        .cp-pc2-stage { position: relative; width: 100%; max-width: 340px; aspect-ratio: 4 / 5; }
        .cp-pc2-card {
          position: absolute; inset: 0; overflow: hidden;
          border-radius: 2rem; border: 5px solid var(--bg, #FBF7F2);
          background: var(--bg, #FBF7F2); transform-origin: center;
          transition: transform 600ms cubic-bezier(0.25, 1, 0.35, 1), opacity 600ms ease;
          will-change: transform;
        }
        .cp-pc2-img { width: 100%; height: 100%; object-fit: cover; transition: filter 700ms ease; }
        .cp-pc2-caption {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 96px 26px 26px;
          background: linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.4) 55%, transparent);
          display: flex; flex-direction: column; align-items: flex-start;
          transition: opacity 400ms ease, transform 400ms ease;
        }
        .cp-pc2-badge {
          background: var(--bg, #FBF7F2); color: var(--tx, #2D2418);
          padding: 5px 14px; border-radius: 999px;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em;
          margin-bottom: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        }
        .cp-pc2-desc {
          color: #fff; font-size: 19px; line-height: 1.3; margin: 0;
          letter-spacing: -0.01em; text-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .cp-pc2-cta {
          margin-top: 12px; padding: 9px 18px; border-radius: 999px; border: none;
          background: #fff; color: #1a1611; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: inherit;
        }
        /* --- desktop: split 40/60 como el original --- */
        @media (min-width: 900px) {
          .cp-pc2-wrap { flex-direction: row; border-radius: 4rem; min-height: 520px; }
          .cp-pc2-left { width: 40%; min-height: 520px; justify-content: flex-start; padding-left: 56px; }
          .cp-pc2-wheel { justify-content: flex-start; }
          .cp-pc2-right { border-top: none; border-left: 1px solid var(--line, #E8DFD2); padding: 56px 40px; }
          .cp-pc2-stage { max-width: 400px; }
          .cp-pc2-desc { font-size: 22px; }
        }
        @keyframes cp-promo-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cp-promo-pop { from { opacity: 0; transform: scale(0.9) translateY(14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .cp-pc2-chip-slot, .cp-pc2-card, .cp-pc2-img, .cp-pc2-caption { transition: none !important; }
          [style*="cp-promo"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
