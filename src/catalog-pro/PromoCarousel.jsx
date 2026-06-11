// src/catalog-pro/PromoCarousel.jsx
// Carrusel de promos (galeria circular: card cuadrada, reveal clip-path
// circle desde las burbujas-thumbnail) + leaderboard semanal estilo
// "Weekly Leaderboard" (podio con avatares + coronas + columnas, lista con
// posicion/corona/inicial/nombre/puntos, fila del cliente con su posicion
// real). Sin GSAP/Tailwind: CSS + tokens.
//
// El CTA del ranking dice "Saber mas": el modal ademas de mostrar el podio
// explica la mecanica de puntos. Avatares: deterministicos por nombre
// (src/lib/avatars.jsx), el cliente no los elige.
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGuestUser } from "../lib/guestUser.js";
import { useWeeklyTop, useMyRanking } from "./useTopCustomers";
import { Avatar } from "../lib/avatars.jsx";

const AUTO_PLAY_MS = 4500;
const TOUCH_HOLD_MS = 15000; // si alguien toco, esta leyendo: pausa larga
const REVEAL_MS = 650;
const DOT_SIZE = 30;
const DOT_GAP = 10;
const DOT_BOTTOM = 24;

/* ---------- Corona (oro / plata / bronce) ---------- */
function Crown({ color = "#E8A33D", size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M3 8 L7.5 12 L12 5 L16.5 12 L21 8 L19 18 Q12 20 5 18 Z" />
    </svg>
  );
}
const CROWN_COLORS = { 1: "#E8A33D", 2: "#9CA3AF", 3: "#B0763B" };

/* ---------- Rango de la semana actual (lunes a domingo, es-AR) ---------- */
function weekRangeLabel() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const f = (d) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  return `${f(mon)} - ${f(sun)} · los lunes premiamos al podio`;
}

/* Fila de la lista: posicion · corona · inicial · nombre · puntos */
function LeaderRow({ pos, name, pts, mine, placeholder }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "24px 22px 36px 1fr auto",
      alignItems: "center", gap: 10, padding: "12px 14px",
      background: mine ? "color-mix(in srgb, var(--ac, #D97706) 10%, transparent)" : "transparent",
      borderRadius: mine ? 12 : 0,
    }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: "var(--tx, #2D2418)" }}>{pos ?? "—"}</span>
      <span style={{ display: "flex", alignItems: "center" }}>
        {pos && pos <= 3 ? <Crown color={CROWN_COLORS[pos]} /> : <span style={{ width: 16 }} />}
      </span>
      <span style={{
        width: 36, height: 36, borderRadius: 999,
        background: "var(--b2, #F4EDE3)", color: "var(--t2, #8A7A66)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 800,
      }}>{(name || "?").charAt(0).toUpperCase()}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--tx, #2D2418)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{name}{mine ? " (vos)" : ""}</span>
        {placeholder && (
          <span style={{ display: "block", fontSize: 11, color: "var(--t3, #B0A48F)" }}>{placeholder}</span>
        )}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--tx, #2D2418)" }}>
        {pts !== null ? `${pts} pts` : ""}
      </span>
    </div>
  );
}

/* ---------- Modal: leaderboard + explicacion ---------- */
function LeaderboardModal({ top, onClose }) {
  const { user, profile, session } = useAuth();
  const guest = useGuestUser();
  const myEmail = user?.email || guest?.email || "";
  const myPhone = profile?.phone || guest?.phone || "";
  const isIdentified = !!(myEmail || myPhone);
  const { ranking } = useMyRanking({ email: myEmail, phone: myPhone });

  const podium = top.slice(0, 3);
  // Orden visual: 2do | 1ro | 3ro
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
  const colHeight = { 1: 110, 2: 78, 3: 62 };
  const colBg = {
    1: "var(--ac, #D97706)",
    2: "color-mix(in srgb, var(--tx, #2D2418) 28%, var(--bg, #FBF7F2))",
    3: "color-mix(in srgb, #B0763B 75%, var(--bg, #FBF7F2))",
  };

  const myFirst = session?.firstName || (profile?.name || guest?.name || "").trim().split(/\s+/)[0] || null;
  const myPos = ranking?.my_position ?? null;

  // Fila destacada del cliente: su posicion REAL (si esta en top 3 se
  // resalta esa fila; si no, se agrega 4ta fila con su distancia al podio)
  const showMyRow = myPos === null || myPos > 3;

  return (
    <div className="cp-root" onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 8000,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      animation: "cp-promo-fade 250ms ease both",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto",
        background: "var(--bg, #FBF7F2)", borderRadius: 24,
        border: "1px solid var(--line, #E8DFD2)", padding: "22px 18px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: "cp-promo-pop 350ms cubic-bezier(0.34,1.56,0.64,1) both",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-heading, 'DM Serif Display', serif)", fontSize: 22, margin: 0, color: "var(--tx, #2D2418)" }}>
              Ranking semanal
            </h2>
            <p style={{ fontSize: 12, color: "var(--t2, #8A7A66)", margin: "3px 0 0" }}>{weekRangeLabel()}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{
            width: 32, height: 32, borderRadius: 99, border: "none", flexShrink: 0,
            background: "var(--b2, #F4EDE3)", color: "var(--t2, #8A7A66)",
            fontSize: 15, cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Podio con avatares + coronas + columnas */}
        {podiumOrder.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, margin: "22px 0 18px" }}>
            {podiumOrder.map((row) => {
              const pos = row.rank_position ?? row.position;
              const isFirst = pos === 1;
              return (
                <div key={pos} style={{ flex: 1, maxWidth: 116, textAlign: "center" }}>
                  <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
                    <div style={{
                      width: isFirst ? 64 : 52, height: isFirst ? 64 : 52, borderRadius: 999,
                      overflow: "hidden", border: "2px solid var(--line, #E8DFD2)",
                      background: "#fff",
                    }}>
                      <Avatar name={row.display_name} size={isFirst ? 60 : 48} />
                    </div>
                    <span style={{
                      position: "absolute", bottom: -4, right: -6,
                      width: 22, height: 22, borderRadius: 999,
                      background: "var(--tx, #2D2418)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Crown color={CROWN_COLORS[pos]} size={12} />
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12.5, fontWeight: 700, color: "var(--tx, #2D2418)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{row.display_name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--t2, #8A7A66)", marginBottom: 8 }}>{row.points} pts</div>
                  <div style={{
                    height: colHeight[pos], borderRadius: "12px 12px 0 0",
                    background: colBg[pos],
                    display: "flex", alignItems: "flex-start", justifyContent: "center",
                    paddingTop: 10,
                    color: pos === 2 ? "var(--bg, #FBF7F2)" : "#fff",
                    fontSize: 22, fontWeight: 800, fontFamily: "var(--font-heading, serif)",
                  }}>{pos}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lista: posicion · corona · inicial · nombre · puntos */}
        <div style={{ border: "1px solid var(--line, #E8DFD2)", borderRadius: 16, overflow: "hidden" }}>
          {top.slice(0, 3).map((row, i) => {
            const pos = row.rank_position ?? row.position;
            return (
              <div key={pos} style={{ borderTop: i === 0 ? "none" : "1px solid var(--line, #E8DFD2)" }}>
                <LeaderRow pos={pos} name={row.display_name} pts={row.points} mine={myPos === pos} />
              </div>
            );
          })}
          {/* Fila del cliente: su posicion real, para saber a que distancia esta */}
          {showMyRow && (
            <div style={{ borderTop: "1px solid var(--line, #E8DFD2)", padding: 4 }}>
              {ranking ? (
                <LeaderRow pos={myPos} name={myFirst || "Vos"} pts={ranking.my_points} mine
                  placeholder={ranking.points_to_top5 > 0 ? `Te faltan ${ranking.points_to_top5} pts para el top 5` : "¡Estás en el top 5!"} />
              ) : (
                <LeaderRow pos={null} name={myFirst || "Vos"} pts={null} mine
                  placeholder={isIdentified ? "Todavía sin puntos esta semana — tu próximo pedido te suma" : "Hacé tu primer pedido y entrás al ranking"} />
              )}
            </div>
          )}
        </div>

        {/* Como funciona (el CTA del carrusel dice "Saber mas") */}
        <div style={{
          marginTop: 14, padding: "12px 14px", borderRadius: 14,
          background: "var(--b2, #F4EDE3)", fontSize: 12.5,
          color: "var(--t2, #8A7A66)", lineHeight: 1.55,
        }}>
          <strong style={{ color: "var(--tx, #2D2418)" }}>¿Cómo funciona?</strong> Cada $10.000 en pedidos
          suma 1 punto. La semana corre de lunes a domingo y arranca de cero cada lunes, cuando premiamos
          al podio de la semana anterior. No hace falta registrarse: con tu primer pedido ya estás compitiendo.
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
      cta: "Saber más", onCta: () => setShowBoard(true),
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

  const [base, setBase] = useState(0);
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
  const prev = useCallback(() => goTo((base - 1 + len) % len), [base, len, goTo]);
  // Toco algo = esta mirando/analizando → pausa larga, se renueva con cada toque
  const holdAutoplay = () => { pauseUntil.current = Date.now() + TOUCH_HOLD_MS; };
  const userGo = (fn) => { holdAutoplay(); fn(); };

  useEffect(() => {
    if (len < 2) return;
    const t = setInterval(() => {
      // hover (desktop) o toque reciente (mobile) = estatico hasta que suelte/pase el tiempo
      if (busy || showBoard || hovering || Date.now() < pauseUntil.current) return;
      next();
    }, AUTO_PLAY_MS);
    return () => clearInterval(t);
  }, [len, busy, showBoard, hovering, next]);

  if (len === 0) return null;
  const active = incoming ?? base;
  const slide = slides[active];

  const dotOffset = (i) => (i - (len - 1) / 2) * (DOT_SIZE + DOT_GAP);
  const clipFrom = (i) =>
    `circle(${DOT_SIZE / 2}px at calc(50% + ${dotOffset(i)}px) calc(100% - ${DOT_BOTTOM + DOT_SIZE / 2}px))`;
  const clipFull = `circle(135% at 50% 50%)`;

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

        <div style={{
          position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(0,0,0,0.35), transparent 32%, transparent 50%, rgba(0,0,0,0.72))",
        }} />

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
            <button onClick={() => { holdAutoplay(); slide.onCta?.(); }} style={{
              marginTop: 10, padding: "9px 18px", borderRadius: 999, border: "none",
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
                  {s.img
                    ? <img src={s.img} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ width: "100%", height: "100%", background: "color-mix(in srgb, var(--ac, #D97706) 70%, #1a1611)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }} aria-hidden>{s.emoji}</div>}
                </div>
              </button>
            );
          })}
        </div>

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
