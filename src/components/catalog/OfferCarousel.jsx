// src/components/catalog/OfferCarousel.jsx
// Carrusel horizontal de promos / daily deals.
// Adaptado del concepto de offer-carousel.tsx (shadcn/tailwind/framer) al stack
// actual: JSX + inline styles con tokens ag-* + CSS transitions nativas.
//
// Props:
//   offers: Array<{
//     id, imageSrc, imageAlt, tag, title, description,
//     accentColor?, brandLogoSrc?, brandName?, promoCode?, onClick? | href?
//   }>
//
// Si no hay offers, no renderiza nada.

import { useRef } from "react";
import { optimizeImage, originalImageUrl, disableImageTransforms } from "../../lib/utils";

export default function OfferCarousel({ offers = [], title = "Ofertas del día" }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!offers || offers.length === 0) return null;

  return (
    <div style={{ padding: "16px 0 8px", position: "relative" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px 10px",
      }}>
        <h2 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 17, fontWeight: 700,
          margin: 0, color: "var(--ag-ink, #2D1B0E)",
          letterSpacing: "-0.01em",
        }}>
          {title}
        </h2>
        {offers.length > 2 && (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => scroll("left")}
              aria-label="Anterior"
              style={chevronStyle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Siguiente"
              style={chevronStyle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        style={{
          display: "flex", gap: 12,
          overflowX: "auto", overflowY: "hidden",
          padding: "4px 16px 14px",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        <style>{`
          .hg-offer-scroll::-webkit-scrollbar { display: none; }
          .hg-offer-card { transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease; }
          .hg-offer-card:hover { transform: translateY(-4px); box-shadow: 0 14px 30px rgba(0,0,0,0.12); }
          .hg-offer-card:hover .hg-offer-img { transform: scale(1.06); }
          .hg-offer-img { transition: transform 0.45s ease; }
          .hg-offer-arrow { transition: transform 0.25s ease, background 0.25s ease, color 0.25s ease; }
          .hg-offer-card:hover .hg-offer-arrow { transform: rotate(-45deg); background: var(--ag-c-terra, #C45D3E); color: #fff; }
        `}</style>

        {offers.map((o) => {
          const accent = o.accentColor || "var(--ag-c-terra, #C45D3E)";
          const Wrapper = o.href ? "a" : "button";
          const wrapperProps = o.href
            ? { href: o.href }
            : { type: "button", onClick: o.onClick };

          return (
            <Wrapper
              key={o.id}
              {...wrapperProps}
              className="hg-offer-card"
              style={{
                position: "relative",
                flexShrink: 0, scrollSnapAlign: "start",
                width: 260, height: 320,
                borderRadius: 18, overflow: "hidden",
                background: "var(--ag-bg-soft, #fff)",
                border: "1px solid var(--ag-line, rgba(0,0,0,0.06))",
                boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                cursor: "pointer",
                textDecoration: "none",
                textAlign: "left",
                fontFamily: "inherit",
                padding: 0,
              }}
            >
              {/* Imagen top (50% altura) */}
              <div style={{
                position: "relative",
                height: "50%",
                overflow: "hidden",
                background: o.imageSrc ? "var(--ag-bg-soft)" : accent,
              }}>
                {o.imageSrc ? (
                  <img
                    src={optimizeImage(o.imageSrc, { width: 520, quality: 65 })}
                    alt={o.imageAlt || o.title}
                    className="hg-offer-img"
                    loading="lazy" decoding="async"
                    style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      display: "block",
                    }}
                    onError={e => {
                      const orig = originalImageUrl(e.target.src) || o.imageSrc;
                      if (orig !== e.target.src) { disableImageTransforms(); e.target.src = orig; return; }
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 48,
                  }}>
                    🏷️
                  </div>
                )}
              </div>

              {/* Contenido bottom (50% altura) */}
              <div style={{
                height: "50%",
                padding: "14px 16px",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}>
                <div>
                  {/* Tag */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 10, fontWeight: 800,
                    color: accent, textTransform: "uppercase", letterSpacing: "0.07em",
                    marginBottom: 6,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                      <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                    {o.tag || "Promoción"}
                  </div>

                  {/* Title */}
                  <h3 style={{
                    margin: "0 0 4px",
                    fontSize: 16, fontWeight: 800,
                    color: "var(--ag-ink, #2D1B0E)",
                    lineHeight: 1.2, letterSpacing: "-0.01em",
                  }}>
                    {o.title}
                  </h3>

                  {/* Description */}
                  {o.description && (
                    <p style={{
                      margin: 0,
                      fontSize: 11.5,
                      color: "var(--ag-ink-3, #9C8B7A)",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {o.description}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingTop: 10,
                  borderTop: "1px solid var(--ag-line, rgba(0,0,0,0.06))",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {o.brandLogoSrc && (
                      <img
                        src={o.brandLogoSrc} alt={o.brandName || ""}
                        width={26} height={26}
                        style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, objectFit: "cover", background: "var(--ag-bg-soft)" }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      {o.brandName && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink, #2D1B0E)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {o.brandName}
                        </div>
                      )}
                      {o.promoCode && (
                        <div style={{ fontSize: 10, color: "var(--ag-ink-3, #9C8B7A)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.02em" }}>
                          {o.promoCode}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hg-offer-arrow" style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: "var(--ag-bg-soft, #f3ede4)",
                    color: "var(--ag-ink, #2D1B0E)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}

const chevronStyle = {
  width: 30, height: 30, borderRadius: "50%",
  background: "var(--ag-bg-soft, #f3ede4)",
  border: "1px solid var(--ag-line, rgba(0,0,0,0.06))",
  color: "var(--ag-ink, #2D1B0E)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", fontFamily: "inherit",
  transition: "background 0.15s ease",
};
