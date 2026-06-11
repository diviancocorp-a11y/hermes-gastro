// src/catalog-pro/PromoCarousel.jsx
// Carrusel de promos del catalogo (adaptacion del FeatureCarousel TSX que
// paso el user: chips + panel con auto-play). SIN motion/Tailwind/hugeicons:
// CSS transitions + tokens del tema + emojis. Va al final del home, antes
// del footer.
//
// Slides actuales:
//   - Ranking semanal  → abre el podio (LeaderboardModal, estilo leaderboard-card)
//   - Regalo de cumple → CTA a Mi cuenta para cargar la fecha
//   - Pedidos programados → informativo
// Ruleta y encuesta de sabores: anotadas en TAREAS-MANUALES (backend pendiente).
//
// Datos reales: useWeeklyTop / useMyRanking (RPCs publicas con nombres
// anonimizados server-side). El slide de ranking se oculta si no hay data.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGuestUser } from "../lib/guestUser.js";
import { useWeeklyTop, useMyRanking } from "./useTopCustomers";
import { SectionHeader } from "./atoms";

const AUTO_PLAY_MS = 4500;
const PAUSE_AFTER_TOUCH_MS = 8000;
const MEDALS = ["🥇", "🥈", "🥉"];

/* ---------- Podio + lista (adaptacion del leaderboard-card) ---------- */
function LeaderboardModal({ top, onClose }) {
  const { user, profile } = useAuth();
  const guest = useGuestUser();
  const myEmail = user?.email || guest?.email || "";
  const myPhone = profile?.phone || guest?.phone || "";
  const { ranking } = useMyRanking({ email: myEmail, phone: myPhone });

  const podium = top.slice(0, 3);
  // Orden visual del podio: 2do | 1ro | 3ro (alturas escalonadas)
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

        {/* Podio */}
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

        {/* Resto del top */}
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

        {/* Tu posicion */}
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

/* ---------- Carrusel ---------- */
export default function PromoCarousel({ onOpenAccount }) {
  const { top, loading: topLoading } = useWeeklyTop();
  const [showBoard, setShowBoard] = useState(false);
  const [idx, setIdx] = useState(0);
  const pausedUntil = useRef(0);

  const slides = [];
  if (topLoading || top.length > 0) {
    slides.push({
      id: "ranking", emoji: "🏆", chip: "Ranking",
      title: "Ranking semanal",
      desc: "Cada $10.000 en pedidos suma 1 punto. Los lunes premiamos al podio de la semana.",
      cta: "Ver ranking", onCta: () => setShowBoard(true),
    });
  }
  slides.push({
    id: "cumple", emoji: "🎂", chip: "Cumpleaños",
    title: "Regalo de cumpleaños",
    desc: "Contanos tu fecha de nacimiento y el día de tu cumple te espera un cupón de regalo.",
    cta: "Completar mi perfil", onCta: () => onOpenAccount?.(),
  });
  slides.push({
    id: "programados", emoji: "📅", chip: "Programados",
    title: "Pedidos programados",
    desc: "Elegí día y horario en el checkout y tu pedido sale justo para ese momento.",
  });

  // Auto-play con pausa tras interaccion
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => {
      if (Date.now() < pausedUntil.current || showBoard) return;
      setIdx((i) => (i + 1) % slides.length);
    }, AUTO_PLAY_MS);
    return () => clearInterval(t);
  }, [slides.length, showBoard]);

  const goTo = (i) => {
    pausedUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
    setIdx(i);
  };

  if (slides.length === 0) return null;
  const safeIdx = idx % slides.length;

  return (
    <div style={{ padding: "8px 0 26px" }}>
      <SectionHeader kicker="Promos" title="Para vos" em="esta semana" />

      <div style={{
        margin: "0 22px", borderRadius: 22, overflow: "hidden",
        border: "1px solid var(--line, #E8DFD2)",
      }}>
        {/* Panel del slide activo */}
        <div style={{
          position: "relative", minHeight: 190,
          background: "color-mix(in srgb, var(--ac, #D97706) 10%, var(--bg, #FBF7F2))",
        }}>
          {slides.map((s, i) => {
            const active = i === safeIdx;
            return (
              <div key={s.id} aria-hidden={!active} style={{
                position: "absolute", inset: 0, padding: "20px 22px",
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
                opacity: active ? 1 : 0,
                transform: active ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 450ms ease, transform 450ms ease",
                pointerEvents: active ? "auto" : "none",
              }}>
                {/* Emoji gigante de fondo */}
                <div aria-hidden style={{
                  position: "absolute", top: -8, right: 2, fontSize: 96,
                  opacity: 0.16, transform: "rotate(8deg)", pointerEvents: "none",
                  filter: "saturate(0.9)",
                }}>{s.emoji}</div>

                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.18em",
                  textTransform: "uppercase", color: "var(--ac, #D97706)", marginBottom: 6,
                }}>
                  {i + 1} / {slides.length} · {s.chip}
                </div>
                <div style={{
                  fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
                  fontSize: 24, lineHeight: 1.15, color: "var(--tx, #2D2418)", marginBottom: 6,
                }}>{s.title}</div>
                <p style={{ fontSize: 13, color: "var(--t2, #8A7A66)", margin: 0, lineHeight: 1.5, maxWidth: 420 }}>
                  {s.desc}
                </p>
                {s.cta && (
                  <button onClick={s.onCta} style={{
                    marginTop: 12, alignSelf: "flex-start",
                    padding: "9px 18px", borderRadius: 99, border: "none",
                    background: "var(--ac, #D97706)", color: "#fff",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>{s.cta}</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Chips (adaptacion de la columna de chips del FeatureCarousel) */}
        <div className="cp-no-scrollbar" style={{
          display: "flex", gap: 8, padding: "12px 14px",
          overflowX: "auto", background: "var(--bg, #FBF7F2)",
          borderTop: "1px solid var(--line, #E8DFD2)",
        }}>
          {slides.map((s, i) => {
            const active = i === safeIdx;
            return (
              <button key={s.id} onClick={() => goTo(i)} style={{
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                padding: "8px 14px", borderRadius: 99, cursor: "pointer",
                fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
                border: active ? "1px solid var(--ac, #D97706)" : "1px solid var(--line, #E8DFD2)",
                background: active ? "var(--ac, #D97706)" : "transparent",
                color: active ? "#fff" : "var(--t2, #8A7A66)",
                transition: "background 300ms ease, color 300ms ease, border-color 300ms ease",
              }}>
                <span aria-hidden>{s.emoji}</span>{s.chip}
              </button>
            );
          })}
        </div>
      </div>

      {showBoard && <LeaderboardModal top={top} onClose={() => setShowBoard(false)} />}

      <style>{`
        @keyframes cp-promo-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cp-promo-pop { from { opacity: 0; transform: scale(0.9) translateY(14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          [style*="cp-promo"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
