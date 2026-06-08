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

export default function HomeScreen({
  store = {}, userName, products = [], categories = [],
  cartCount = 0, cartTotal = 0,
  hasDeal, dealPrice, prepDefault,
  onAddToCart, onOpenCart, onSelectProduct, onOpenAccount,
  session, onLogout,
  settings = {},
  searchQuery = "", onSearchChange,
  // Quick reorder: ultimos items pedidos por el user. [{id, name, qty}]
  lastOrderItems = [],
  onReorder,
  // Cart actions (mostrar [-][qty][+] cuando el item ya esta en cart)
  cart = [],
  onDecCart,
  onRemoveCart,
}) {
  const cartQtyById = (id) => {
    const item = (cart || []).find(c => c.id === id || c.product_id === id);
    return item ? item.qty : 0;
  };
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
  // Grid completo de TODOS los productos filtrados por categoria activa +
  // busqueda + quick filter (en oferta / vegetariano / nuevos / mas pedidos).
  const gridProducts = useMemo(() => {
    let list = products;
    if (activeCat && activeCat !== "Todos") {
      const cat = categories.find(c => c.name === activeCat);
      if (cat) {
        // Trim para tolerar trailing spaces en recipe.category (data legacy).
        const catName = (cat.name || "").trim();
        const subs = (cat.subs || []).map(s => (s || "").trim());
        list = list.filter(p => {
          const pc = (p.category || "").trim();
          return pc === catName || subs.includes(pc);
        });
      }
    }
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    }
    // Quick filters
    if (activeFilter === "deal") {
      list = list.filter(p => hasDeal?.(p));
    } else if (activeFilter === "veg") {
      list = list.filter(p => p.is_vegetarian || /veg|vegan|vegetal/i.test(p.tags || p.description || ""));
    } else if (activeFilter === "new") {
      // Nuevos: creados en los ultimos 30 dias
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      list = list.filter(p => p.created_at && new Date(p.created_at).getTime() > cutoff);
    } else if (activeFilter === "top") {
      // Mas pedidos: ordenar por sale_count o veces que aparece en orders.
      list = [...list].sort((a, b) => (b.sale_count || 0) - (a.sale_count || 0));
    }
    return list.map(p => mapProduct(p, { hasDeal, dealPrice, prepDefault }));
  }, [products, categories, activeCat, searchQuery, activeFilter, hasDeal, dealPrice, prepDefault]);

  // Categorias ordenadas por hora del dia (personalizacion).
  // Si una categoria matchea palabras clave del momento, aparece primera.
  const sortedCategories = useMemo(() => {
    const h = new Date().getHours();
    let kws = [];
    if (h >= 6 && h < 11) kws = ["desayuno", "cafe", "café", "merienda", "panaderia", "panadería", "dulce"];
    else if (h >= 11 && h < 16) kws = ["almuerzo", "principal", "mesa", "ensalada", "pasta", "pizza"];
    else if (h >= 16 && h < 19) kws = ["merienda", "cafe", "café", "dulce", "torta", "pasteleria"];
    else kws = ["cena", "pizza", "pasta", "hamburguesa", "sanguche"];
    const matches = (name) => kws.some(k => name.toLowerCase().includes(k));
    const todos = categories.find(c => c.name === "Todos");
    const rest = categories.filter(c => c.name !== "Todos");
    rest.sort((a, b) => Number(matches(b.name)) - Number(matches(a.name)));
    return todos ? [todos, ...rest] : rest;
  }, [categories]);

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
              {settings?.has_physical_store !== false && settings?.store_address && (
                <div style={{
                  marginTop: 3, fontSize: 11, color: "var(--t3)",
                  lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {settings.store_address}
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

      {/* ===== QUICK REORDER (si hay pedido previo) ===== */}
      {lastOrderItems.length > 0 && (
        <div style={{ padding: "20px 22px 0" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, padding: "14px 16px", borderRadius: 14,
            background: "color-mix(in oklab, var(--ac) 10%, var(--bg))",
            border: "1px solid color-mix(in oklab, var(--ac) 30%, var(--line))",
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ac)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                ⚡ Pedi de nuevo
              </div>
              <div style={{ fontSize: 13, color: "var(--tx)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lastOrderItems.map(it => it.name).slice(0, 3).join(", ")}
                {lastOrderItems.length > 3 && ` +${lastOrderItems.length - 3}`}
              </div>
            </div>
            <button onClick={() => onReorder?.(lastOrderItems)} style={{
              flexShrink: 0, padding: "10px 14px", borderRadius: 999,
              background: "var(--ac)", color: "#fff", border: 0,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}>
              Repetir
            </button>
          </div>
        </div>
      )}

      {/* ===== EDITORIAL ===== */}
      <div style={{ padding: "28px 22px 44px" }}>
        <h1 className="h-1" style={{ margin: 0, fontSize: 32 }}>
          ¿Qué te <RotatingVerb words={["tienta", "seduce", "atrae"]} /> hoy?
        </h1>
      </div>

      {/* ===== SMART SEARCH (in-place filter + autocomplete) ===== */}
      <div style={{ padding: "0 22px 18px", position: "relative" }}>
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
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange?.("")} style={{
              width: 28, height: 28, borderRadius: 999, background: "var(--bg)",
              border: "1px solid var(--line)", color: "var(--t2)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }} aria-label="Limpiar busqueda">
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
        {/* Autocomplete: hasta 4 sugerencias cuando hay 2+ caracteres */}
        {searchQuery.trim().length >= 2 && gridProducts.length > 0 && (
          <div style={{
            position: "absolute", left: 22, right: 22, top: 56, zIndex: 30,
            background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12,
            boxShadow: "0 12px 28px rgba(0,0,0,0.10)", overflow: "hidden",
          }}>
            {gridProducts.slice(0, 4).map((p, i) => (
              <button key={p.id} type="button"
                onClick={() => { onSelectProduct?.(p._raw); onSearchChange?.(""); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", background: "transparent",
                  border: 0, borderTop: i === 0 ? 0 : "1px solid var(--line)",
                  cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, overflow: "hidden", background: p.tone || "var(--b2)", flexShrink: 0 }}>
                  {p.img && <img src={p.img} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{fmtAR(p.price)}</div>
                </div>
                <Icon name="arrow-right" size={14} style={{ color: "var(--t3)" }} />
              </button>
            ))}
          </div>
        )}
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
          {sortedCategories.map(c => {
            const isActive = activeCat === c.name;
            const catName = (c.name || "").trim();
            const subs = (c.subs || []).map(s => (s || "").trim());
            const count = c.name === "Todos"
              ? totalCount
              : products.filter(p => {
                  const pc = (p.category || "").trim();
                  return pc === catName || subs.includes(pc);
                }).length;
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
              {p._raw?.requires_age_gate && (
                <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(198,40,40,0.92)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 999, letterSpacing: "0.04em" }}>
                  +18
                </div>
              )}
              <div style={{ position: "absolute", bottom: -10, right: 8 }}>
                {(() => {
                  const qty = cartQtyById(p.id);
                  if (qty === 0) return <AddRound size={32} onClick={(e) => { e?.stopPropagation?.(); onAddToCart?.(p._raw); }} />;
                  return (
                    <div onClick={(e) => e.stopPropagation()} style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "var(--ac)", color: "#fff",
                      borderRadius: 999, padding: "3px 6px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}>
                      <button type="button" onClick={() => onDecCart?.(p.id)} style={qtyBtnStyle} aria-label={qty === 1 ? "eliminar" : "restar"}>−</button>
                      <span style={{ minWidth: 18, textAlign: "center", fontSize: 13, fontWeight: 700 }}>{qty}</span>
                      <button type="button" onClick={() => onAddToCart?.(p._raw)} style={qtyBtnStyle} aria-label="sumar">+</button>
                    </div>
                  );
                })()}
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

      {/* ===== STICKY CART + FOOTER ===== */}
      {cartCount > 0 && <StickyCart count={cartCount} total={cartTotal} onClick={onOpenCart} />}
      <CatalogFooter settings={settings} brand={<HermesMark size={18} />} />
    </div>
  );
}

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

const qtyBtnStyle = {
  width: 22, height: 22, borderRadius: 999, border: 0,
  background: "rgba(255,255,255,0.2)", color: "#fff",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, fontFamily: "inherit",
};

// Verbo rotativo con crossfade suave. Cambia entre sinonimos cada 2.5s.
// Inline aqui para no crear archivo nuevo por un componentito de 20 lineas.
function RotatingVerb({ words = [], intervalMs = 2500, fadeMs = 350 }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (words.length < 2) return;
    const tick = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % words.length);
        setVisible(true);
      }, fadeMs);
    }, intervalMs);
    return () => clearInterval(tick);
  }, [words, intervalMs, fadeMs]);
  return (
    <em style={{
      fontStyle: "italic", color: "var(--ac)",
      display: "inline-block",
      opacity: visible ? 1 : 0,
      transition: `opacity ${fadeMs}ms ease`,
      minWidth: "5ch",
    }}>
      {words[idx] || ""}
    </em>
  );
}
