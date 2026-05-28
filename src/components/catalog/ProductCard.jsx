// src/components/catalog/ProductCard.jsx
// Card de producto del catálogo público. Layout horizontal: img izq + content der.
// Sistema visual v2 (tokens ag-*), todas las clases legacy reemplazadas por inline.

import { memo } from "react";
import { Icon, formatInt } from "../../lib/utils";
import { avatarColors, DEAL_PCT } from "../../constants/catalogConstants";
import OptimizedImage from "../ui/OptimizedImage";

const ProductCard = memo(function ProductCard({
  p, qty, hasDeal, dealPrice, originalPrice,
  onAdd, onUpdate, isFav, onToggleFav, isLoggedIn,
  priority = false,
}) {
  const initial = (p.name || "?").charAt(0).toUpperCase();
  const avatarBg = avatarColors[(p.name || "A").charCodeAt(0) % avatarColors.length];

  return (
    <div
      data-testid="product-card"
      style={{
        position: "relative",
        display: "flex",
        gap: 12,
        padding: 12,
        background: "var(--ag-bg-soft, #fff)",
        borderRadius: 14,
        border: "1px solid var(--ag-line, rgba(0,0,0,0.06))",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        minHeight: 104,
      }}
    >
      {/* Favorito (sólo si logueado) */}
      {isLoggedIn && (
        <button
          aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
          onClick={(e) => { e.stopPropagation(); onToggleFav(p.id); }}
          style={{
            position: "absolute", top: 8, right: 8, zIndex: 5,
            background: "rgba(255,255,255,0.92)",
            border: "none", borderRadius: "50%",
            width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 15,
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            backdropFilter: "blur(4px)",
          }}
        >
          {isFav ? "❤️" : "🤍"}
        </button>
      )}

      {/* Imagen / avatar */}
      <div
        style={{
          width: 88, height: 88, borderRadius: 12,
          flexShrink: 0, overflow: "hidden",
          background: avatarBg,
          color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, fontWeight: 800,
          fontFamily: "'DM Serif Display', serif",
          position: "relative",
        }}
      >
        {p.image_url ? (
          <OptimizedImage
            src={p.image_url}
            alt={p.name}
            width={120}
            height={120}
            quality={65}
            priority={priority}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initial
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div
            style={{
              fontSize: 14, fontWeight: 700,
              color: "var(--ag-ink, #2D1B0E)",
              lineHeight: 1.25,
              marginBottom: 2,
              paddingRight: isLoggedIn ? 28 : 0,   // espacio para el corazón
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {p.name}
          </div>
          {p.description && (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ag-ink-3, #9C8B7A)",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {p.description}
            </div>
          )}
        </div>

        {/* Bottom: precio + add/qty */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            {hasDeal ? (
              <>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ag-ink-3, #9C8B7A)",
                    textDecoration: "line-through",
                    fontWeight: 600,
                  }}
                >
                  ${formatInt(originalPrice)}
                </span>
                <span
                  style={{
                    fontSize: 16, fontWeight: 800,
                    color: "var(--ag-c-terra, #C45D3E)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  ${formatInt(dealPrice)}
                </span>
                <span
                  style={{
                    padding: "1px 6px", borderRadius: 999,
                    background: "var(--ag-c-stock, #f59e0b)",
                    color: "#000",
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.04em",
                  }}
                >
                  -{DEAL_PCT}%
                </span>
              </>
            ) : (
              <span
                style={{
                  fontSize: 16, fontWeight: 800,
                  color: "var(--ag-ink, #2D1B0E)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ${formatInt(originalPrice)}
              </span>
            )}
          </div>

          {qty > 0 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex", alignItems: "center", gap: 2,
                background: "var(--ag-c-terra, #C45D3E)",
                borderRadius: 999, padding: "2px",
              }}
            >
              <button
                aria-label={qty <= 1 ? "Quitar del carrito" : "Reducir cantidad"}
                onClick={() => onUpdate(p.id, qty - 1)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "transparent", color: "#fff",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "inherit",
                }}
              >
                {qty <= 1 ? <span style={{ fontSize: 13 }}>🗑</span> : Icon.minus({ size: 14 })}
              </button>
              <span
                aria-label={`Cantidad: ${qty}`}
                style={{
                  minWidth: 18, textAlign: "center",
                  fontSize: 13, fontWeight: 800, color: "#fff",
                }}
              >
                {qty}
              </span>
              <button
                aria-label="Agregar uno más"
                onClick={(e) => onAdd(p, e)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "transparent", color: "#fff",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "inherit",
                }}
              >
                {Icon.plus({ size: 14 })}
              </button>
            </div>
          ) : (
            <button
              data-testid="cart-add"
              aria-label={`Agregar ${p.name} al carrito`}
              onClick={(e) => onAdd(p, e)}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "var(--ag-c-terra, #C45D3E)",
                color: "#fff", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 12px rgba(196,93,62,0.35)",
                transition: "transform 0.12s ease",
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.92)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {Icon.plus({ size: 18 })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProductCard;
