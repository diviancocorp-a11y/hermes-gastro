// src/catalog-pro/HomeScreen.jsx
// Home del Catálogo Pro — conectada a datos reales del Catalog.
// Stories y AI recos usan heurísticas estables (homeHelpers) donde no hay data.
//
// Props:
//   store: { name, isOpen, pickupTime, logoLetter, logoColor }
//   userName?: string
//   products: producto[] (shape DB)
//   categories: [{ name, displayName, subs, deal }]
//   cartCount, cartTotal
//   hasDeal(p), dealPrice(p)  — helpers del Catalog
//   prepDefault?: number
//   onAddToCart(p), onOpenCart(), onSearch(), onSelectCategory(name),
//   onSelectProduct(p), onOpenAccount()

import { useState, useRef, useEffect, useMemo } from "react";
import Icon from "./Icon";
import AccountMenu from "./AccountMenu";
import { fmtAR } from "./format";
import {
  ProductPhoto, PriceTag, Rating, StickyCart, SectionHeader, AddRound,
} from "./atoms";
import { mapProduct, buildStories, buildRecos } from "./homeHelpers";
import HermesMark from "../components/HermesMark";
import CatalogFooter from "./CatalogFooter";
import BadgeTag from "../components/BadgeTag";
import TopCustomersCard from "./TopCustomersCard";

const SEARCH_PHRASES = ["empanadas…", "tortilla de papa…", "algo dulce…", "pasta de hoy…"];

function SearchTyping() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % SEARCH_PHRASES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span key={i} style={{ color: "var(--t2)", animation: "cp-fade-in 280ms var(--ease)", display: "inline-block" }}>
      {SEARCH_PHRASES[i]}
    </span>
  );
}

export default function HomeScreen({
  store = {}, userName, products = [], categories = [],
  cartCount = 0, cartTotal = 0,
  hasDeal, dealPrice, prepDefault,
  onAddToCart, onOpenCart, onSelectProduct, onOpenAccount,
  session, onLogout,
  settings = {},
  searchQuery = "", onSearchChange,
}) {
  const [activeCat, setActiveCat] = useState("Todos");
  const [activeFilter, setActiveFilter] = useState(null);
  const [storyIdx, setStoryIdx] = useState(0);

  const stories = useMemo(() => buildStories(products, hasDeal), [products, hasDeal]);
  // Saludo: viene de la session unificada (phone-only o magic link).
  // session.firstName ya tiene la prioridad correcta (nickname > nombre > email/phone).
  const firstName = session?.firstName || null;
  const recos = useMemo(() => buildRecos(products, hasDeal), [products, hasDeal]);
  const combos = useMemo(
    () => products
      .filter(p => /combo|pack|promo|caja|docena|mesa/i.test(p.category || ""))
      .slice(0, 8)
      .map(p => mapProduct(p, { hasDeal, dealPrice, prepDefault })),
    [products, hasDeal, dealPrice, prepDefault]
  );
  // Grid completo de TODOS los productos del catalogo, filtrados por
  // categoria activa + searchQuery. Antes era solo `popular` (top 6).
  const gridProducts = useMemo(() => {
    let list = products;
    if (activeCat && activeCat !== "Todos") {
      const cat = categories.find(c => c.name === activeCat);
      if (cat) {
        list = list.filter(p =>
          p.category === cat.name || (cat.subs || []).includes(p.category)
        );
      }
    }
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    }
    return list.map(p => mapProduct(p, { hasDeal, dealPrice, prepDefault }));
  }, [products, categories, activeCat, searchQuery, hasDeal, dealPrice, prepDefault]);

  useEffect(() => {
    if (stories.length === 0) return;
    const t = setInterval(() => setStoryIdx(i => (i + 1) % stories.length), 4500);
    return () => clearInterval(t);
  }, [stories.length]);

  const quickFilters = [
    { id: "deal", name: "En oferta" },
    { id: "veg", name: "Vegetariano" },
    { id: "new", name: "Nuevos" },
    { id: "top", name: "Más pedidos" },
  ];

  const totalCount = products.length;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  })();

  const logoLetter = (store.logoLetter || store.name?.charAt(0) || "H").toUpperCase();

  return (
    <div className="cp-root cp-surface cp-no-scrollbar" style={{ paddingBottom: 200, minHeight: "100vh", width: "100%" }}>
      {/* ===== BANNER DE BIENVENIDA (settings.banner_text) ===== */}
      {settings?.banner_text && (
        <div style={{
          padding: "8px 16px", background: "var(--ac)", color: "var(--bg)",
          fontSize: 12.5, fontWeight: 600, textAlign: "center",
          letterSpacing: 0.2,
        }}>
          {settings.banner_text}
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div style={{
        padding: "16px 16px 8px 22px", background: "var(--bg)",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 999,
              background: store.logoColor || "linear-gradient(135deg, var(--ac), var(--ac2))",
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
              color: "#fff", fontFamily: "var(--font-heading)", fontSize: 18, flexShrink: 0,
            }}>
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={store.name || "Logo"} loading="eager"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : logoLetter}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 17, color: "var(--tx)", lineHeight: 1 }}>
                {firstName ? `${greeting}, ${firstName} 👋` : (store.name || "Tienda")}
              </div>
              <div className="body-s" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: store.isOpen ? "var(--ok)" : "var(--err)" }} />
                {firstName
                  ? `${store.name || "Tienda"} · ${store.isOpen ? "Abierto" : "Cerrado"}`
                  : (store.isOpen ? `Abierto${store.pickupTime ? ` · retiro ${store.pickupTime}` : ""}` : "Cerrado · pedidos programados")}
              </div>
              {settings?.slogan && (
                <div style={{
                  marginTop: 4, fontSize: 11.5, color: "var(--ac)",
                  lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap", fontWeight: 600,
                }}>
                  {settings.slogan}
                </div>
              )}
            </div>
          </div>
          <AccountMenu
            session={session}
            onSelect={onOpenAccount}
            onLogout={onLogout}
          />
        </div>
      </div>

      {/* ===== EDITORIAL ===== */}
      <div style={{ padding: "28px 22px 44px" }}>
        <h1 className="h-1" style={{ margin: 0, fontSize: 32 }}>
          ¿Qué te <em style={{ fontStyle: "italic", color: "var(--ac)" }}>tienta</em> hoy?
        </h1>
      </div>

      {/* ===== SMART SEARCH (in-place filter) ===== */}
      <div style={{ padding: "0 22px 18px" }}>
        <div style={{
          width: "100%", height: 50, background: "var(--b2)", borderRadius: 14,
          display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
          border: "1px solid transparent", fontFamily: "var(--font-body)",
        }}>
          <Icon name="search" size={18} style={{ color: "var(--t2)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Buscar productos..."
            style={{
              flex: 1, height: "100%", border: 0, outline: "none",
              background: "transparent", color: "var(--tx)",
              fontFamily: "var(--font-body)", fontSize: 14,
            }}
          />
          {searchQuery ? (
            <button type="button" onClick={() => onSearchChange?.("")} style={{
              width: 28, height: 28, borderRadius: 999, background: "var(--bg)",
              border: "1px solid var(--line)", color: "var(--t2)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }} aria-label="Limpiar busqueda">
              <Icon name="x" size={12} />
            </button>
          ) : (
            <SearchTyping />
          )}
        </div>
      </div>

      {/* ===== STORIES ===== */}
      {stories.length > 0 && (
        <div style={{ paddingBottom: 6 }}>
          <div className="cp-no-scrollbar" style={{ display: "flex", gap: 10, padding: "0 22px", overflowX: "auto" }}>
            {stories.map((s, i) => (
              <div key={s.id} onClick={() => onSelectProduct?.(s._raw)} style={{
                flex: "0 0 100px", height: 140, borderRadius: 16,
                position: "relative", overflow: "hidden", cursor: "pointer",
                border: i === storyIdx ? "2px solid var(--ac)" : "1px solid var(--line)",
                transition: "border 200ms ease",
              }}>
                <ProductPhoto src={s.img} ratio="100/140" radius={0} tone="#5C4A3F" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.65) 100%)" }} />
                <div style={{ position: "absolute", top: 8, left: 8 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "#fff",
                    background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)",
                    padding: "3px 7px", borderRadius: 4, textTransform: "uppercase",
                  }}>{s.tag}</span>
                </div>
                <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, color: "#fff", fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>
                  {s.label}
                </div>
                {i === storyIdx && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.25)" }}>
                    <div style={{ height: "100%", background: "#fff", animation: "cp-story-progress 4500ms linear" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CATEGORÍAS CHIPS ===== */}
      <div style={{ paddingTop: 28 }}>
        <div style={{ padding: "0 22px 12px" }}>
          <div className="caption">Carta · {totalCount} productos</div>
        </div>
        <div className="cp-no-scrollbar" style={{ display: "flex", gap: 6, padding: "0 22px", overflowX: "auto" }}>
          {categories.map(c => {
            const isActive = activeCat === c.name;
            const count = c.name === "Todos"
              ? totalCount
              : products.filter(p => p.category === c.name || (c.subs || []).includes(p.category)).length;
            return (
              <button key={c.name} onClick={() => setActiveCat(c.name)} style={{
                flex: "0 0 auto", height: 36, padding: "0 14px", borderRadius: 999,
                background: isActive ? "var(--tx)" : "transparent",
                color: isActive ? "var(--bg)" : "var(--t2)",
                border: isActive ? "1px solid var(--tx)" : "1px solid var(--line)",
                fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 120ms var(--ease)",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {c.displayName || c.name}
                <span style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.5)" : "var(--t3)", fontWeight: 400 }}>{count}</span>
              </button>
            );
          })}
        </div>
        {/* Quick filters */}
        <div className="cp-no-scrollbar" style={{ display: "flex", gap: 6, padding: "12px 22px 0", overflowX: "auto" }}>
          {quickFilters.map(f => (
            <button key={f.id} onClick={() => setActiveFilter(activeFilter === f.id ? null : f.id)} style={{
              flex: "0 0 auto", height: 28, padding: "0 11px", borderRadius: 6,
              background: activeFilter === f.id ? "color-mix(in oklab, var(--ac) 14%, transparent)" : "transparent",
              color: activeFilter === f.id ? "var(--ac)" : "var(--t2)",
              border: "1px solid " + (activeFilter === f.id ? "var(--ac)" : "var(--line)"),
              fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 120ms var(--ease)",
            }}>{f.name}</button>
          ))}
        </div>
      </div>

      {/* ===== AI RECOS "PARA VOS" — chip plegable ===== */}
      {recos.length > 0 && (
        <AiRecosCollapsible recos={recos} onSelectProduct={onSelectProduct} content={
          <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recos.map(p => (
              <div key={p.id} onClick={() => onSelectProduct?.(p._raw)} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer" }}>
                <ProductPhoto src={p.img} height={64} radius={10} tone={p.tone} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: 16, color: "var(--tx)", marginBottom: 2 }}>{p.name}</div>
                  <div className="body-s" style={{ fontSize: 11, color: "var(--ac)" }}>
                    <Icon name="sparkle" size={10} style={{ verticalAlign: "-1px", marginRight: 3, display: "inline-block" }} />
                    {p.reason}
                  </div>
                  <div style={{ marginTop: 4 }}><PriceTag price={p.price} oldPrice={p.oldPrice} size="sm" /></div>
                </div>
                <AddRound size={32} onClick={(e) => { e?.stopPropagation?.(); onAddToCart?.(p._raw); }} />
              </div>
            ))}
          </div>
          </>
        } />
      )}

      {/* ===== TOP CUSTOMERS ===== */}
      <TopCustomersCard />

      {/* ===== COMBOS ===== */}
      {combos.length > 0 && (
        <>
          <SectionHeader kicker="Combos" title="Para una mesa" em="completa" />
          <div className="cp-no-scrollbar" style={{ display: "flex", gap: 12, padding: "0 22px", overflowX: "auto" }}>
            {combos.map(b => (
              <div key={b.id} onClick={() => onSelectProduct?.(b._raw)} style={{
                flex: "0 0 260px", borderRadius: 16, overflow: "hidden",
                position: "relative", cursor: "pointer", border: "1px solid var(--line)",
              }}>
                <div style={{ position: "relative", height: 140 }}>
                  <ProductPhoto src={b.img} height={140} radius={0} tone={b.tone} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)" }} />
                  {b.oldPrice && (
                    <div style={{
                      position: "absolute", top: 10, right: 10, background: "var(--ac)", color: "#fff",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", padding: "4px 8px", borderRadius: 4,
                    }}>AHORRÁ {fmtAR(b.oldPrice - b.price)}</div>
                  )}
                  <div style={{ position: "absolute", bottom: 12, left: 14, color: "#fff" }}>
                    <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, lineHeight: 1.25 }}>{b.name}</div>
                  </div>
                </div>
                <div style={{ background: "var(--bg)", padding: "12px 14px" }}>
                  {b.desc && (
                    <div className="body-s" style={{ fontSize: 12, marginBottom: 10, color: "var(--t2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 30 }}>{b.desc}</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <PriceTag price={b.price} oldPrice={b.oldPrice} size="md" />
                    <AddRound size={32} onClick={(e) => { e?.stopPropagation?.(); onAddToCart?.(b._raw); }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== CARTA — TODOS los productos filtrados por categoria + busqueda ===== */}
      <SectionHeader title="Nuestra" em="carta" />
      {gridProducts.length === 0 && (
        <div style={{ padding: "20px 22px", color: "var(--t3)", fontSize: 14, textAlign: "center" }}>
          No encontramos productos con ese filtro.
        </div>
      )}
      <div style={{ padding: "0 22px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
        {gridProducts.map(p => (
          <div key={p.id} onClick={() => onSelectProduct?.(p._raw)} style={{ position: "relative", cursor: "pointer", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "relative" }}>
              <ProductPhoto src={p.img} height={140} radius={12} tone={p.tone} />
              {p.badge && (
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", padding: "3px 7px", borderRadius: 4 }}>
                  {p.badge}
                </div>
              )}
              {p.deal && (
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                  <BadgeTag compact label={p.dealLabel} tone={p.dealTone}>{p.dealShort}</BadgeTag>
                </div>
              )}
              <div style={{ position: "absolute", bottom: -10, right: 8 }}>
                <AddRound size={32} onClick={(e) => { e?.stopPropagation?.(); onAddToCart?.(p._raw); }} />
              </div>
            </div>
            <div style={{ paddingTop: 14, paddingRight: 4 }}>
              <div style={{
                fontFamily: "var(--font-heading)", fontSize: 17, color: "var(--tx)", lineHeight: 1.3,
                letterSpacing: "-0.005em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden", minHeight: 44,
              }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Rating value={p.rating} />
                <span className="body-s" style={{ fontSize: 11, color: "var(--t3)" }}>· {p.prepMin} min</span>
              </div>
              <div style={{ marginTop: 6 }}><PriceTag price={p.price} oldPrice={p.oldPrice} size="sm" /></div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== FOOTER CORPORATIVO HERMES =====
           El triple-click oculto al /admin sigue funcionando via el logo grande del footer. */}
      <div
        onClick={() => {
          const now = Date.now();
          if (now - (window.__hgFooterClick?.t || 0) > 700) window.__hgFooterClick = { t: now, n: 1 };
          else window.__hgFooterClick = { t: now, n: (window.__hgFooterClick?.n || 0) + 1 };
          if (window.__hgFooterClick.n >= 3) {
            window.__hgFooterClick = null;
            window.location.assign("/admin");
          }
        }}
      >
        <CatalogFooter settings={settings} />
      </div>

      {/* ===== STICKY CART ===== */}
      {cartCount > 0 && (
        <StickyCart count={cartCount} total={cartTotal} label="Ver pedido" onClick={onOpenCart} />
      )}

      <style>{`
        @keyframes cp-fade-in { from { opacity: 0; transform: translateY(-2px) } to { opacity: 1; transform: none } }
        @keyframes cp-story-progress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  );
}

// ─── AiRecosCollapsible ───────────────────────────────────────
// Bloque "Para vos" como chip plegable. Por default CERRADO para no ocupar
// tanto espacio del inicio. El usuario lo abre con un toque.
function AiRecosCollapsible({ recos, content, onSelectProduct: _ }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      margin: "20px 22px 0", padding: open ? "16px 18px" : "12px 14px",
      background: "linear-gradient(135deg, color-mix(in oklab, var(--ac) 9%, var(--bg)) 0%, var(--bg) 100%)",
      border: "1px solid color-mix(in oklab, var(--ac) 22%, var(--line))", borderRadius: 14,
      transition: "padding 180ms var(--ease)",
    }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "transparent", border: 0, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--ac)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="sparkle" size={12} stroke={2} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ac)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recomendaciones para ti
          </span>
        </span>
        <span style={{ fontSize: 16, color: "var(--ac)", transition: "transform 200ms", transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
      </button>
      {open && (
        <div style={{ marginTop: 14 }}>
          {content}
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  width: 38, height: 38, borderRadius: 999, background: "transparent",
  border: "1px solid var(--line)", display: "flex", alignItems: "center",
  justifyContent: "center", color: "var(--tx)", cursor: "pointer",
};
