// src/catalog-pro/FamilyScreen.jsx
// Pantalla de familia: el cliente elige cantidad por sabor (cada sabor es un
// producto propio) con atajo de media docena / docena si la familia tiene pack.
// Al confirmar llama onAddToCart(producto, qty) una vez por sabor, igual que
// el detalle de producto, y despues onConfirm(unidades) una sola vez; no cambia
// pedidos, carrito ni stock.
//
// Props:
//   family { name, members, pack, image }, hasDeal(p), dealPrice(p), prepDefault,
//   soldOutIds (Set), onBack(), onAddToCart(product, qty), onConfirm(units)

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { fmtAR } from "./format";
import { ProductPhoto, Stepper, SoldOutBadge } from "./atoms";
import { mapProduct, toneFor } from "./homeHelpers";
import { familyTotal, packSummary, packTexts, shortNames } from "../lib/catalogFamilies";
import "./family.css";

export default function FamilyScreen({
  family, hasDeal, dealPrice, prepDefault, soldOutIds, onBack, onAddToCart, onConfirm,
}) {
  const { name, members = [], pack = null, image = null } = family || {};
  const [qtys, setQtys] = useState({});
  const backRef = useRef(null);
  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; });

  // Foco: al abrir va al boton Volver, Escape cierra y al cerrar vuelve a donde estaba.
  useEffect(() => {
    const previo = document.activeElement;
    backRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onBackRef.current?.(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previo && typeof previo.focus === "function" && document.contains(previo)) previo.focus();
    };
  }, []);

  const cortos = shortNames(members);
  const rows = members.map((m, i) => ({
    ...mapProduct(m, { hasDeal, dealPrice, prepDefault, soldOutIds }),
    short: cortos[i],
  }));
  const precioPorId = {};
  // Un sabor que se agota en vivo cuenta como 0: no entra en contador, total ni pedido.
  const efectivas = {};
  rows.forEach(r => {
    precioPorId[r.id] = r.price;
    efectivas[r.id] = r.soldOut ? 0 : (qtys[r.id] || 0);
  });

  const { units, amount } = familyTotal(members, efectivas, m => precioPorId[m.id]);
  const resumen = packSummary(units, pack);
  const hayPack = !!pack && pack >= 2;
  const t = hayPack ? packTexts(pack) : null;
  const mitad = hayPack && t.halfEven ? pack / 2 : 0;

  const sumar = (id, n) => setQtys(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + n) }));
  const fijar = (id, v) => setQtys(prev => ({ ...prev, [id]: Math.max(0, v) }));

  const agregar = () => {
    if (units === 0) return;
    rows.forEach(r => {
      const q = efectivas[r.id];
      if (q > 0) onAddToCart?.(r._raw, q);
    });
    onConfirm?.(units);
  };

  return (
    <div className="cp-root cp-surface cp-no-scrollbar cp-fam" role="dialog" aria-modal="true" aria-label={name}>
      <div className="cp-fam-hero">
        <ProductPhoto src={image} height={220} radius={0} tone={toneFor(name || "")} />
        <div className="cp-fam-hero-fade" />
      </div>

      <button type="button" ref={backRef} className="cp-fam-back" onClick={onBack} aria-label="Volver">
        <Icon name="arrow-left" size={18} />
      </button>

      <div className="cp-fam-head">
        <h2 className="cp-fam-title">{name}</h2>
        <p className="cp-fam-sub">Elegí cuántas querés de cada sabor.</p>
      </div>

      <div className="cp-fam-summary" aria-live="polite">
        <span className="cp-fam-count">Llevás {units}</span>
        {hayPack ? <span className="cp-fam-pack">{resumen.label}</span> : null}
      </div>

      <ul className="cp-fam-list">
        {rows.map(r => {
          const q = efectivas[r.id];
          return (
            <li key={r.id} className="cp-fam-row" data-soldout={r.soldOut ? "true" : "false"}>
              <div className="cp-fam-main">
                <div className="cp-fam-info">
                  <div className="cp-fam-name">
                    <span>{r.short}</span>
                    {r.soldOut && <SoldOutBadge compact />}
                  </div>
                  {r.desc ? <p className="cp-fam-desc">{r.desc}</p> : null}
                  <div className="cp-fam-price">{fmtAR(r.price)}</div>
                </div>
                <Stepper
                  size="lg" value={q} label={r.short}
                  disabled={r.soldOut}
                  onChange={(v) => fijar(r.id, v)}
                />
              </div>
              {hayPack ? (
                <div className="cp-fam-chips">
                  {mitad >= 1 && (
                    <button type="button" className="cp-fam-chip" disabled={r.soldOut}
                      aria-label={`Sumar ${t.half} de ${r.short}`}
                      onClick={() => sumar(r.id, mitad)}>
                      +½ {t.noun}
                    </button>
                  )}
                  <button type="button" className="cp-fam-chip" disabled={r.soldOut}
                    aria-label={`Sumar ${t.one} de ${r.short}`}
                    onClick={() => sumar(r.id, pack)}>
                    + {t.noun}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="cp-fam-bar">
        <button type="button" className="cp-fam-cta" disabled={units === 0} onClick={agregar}>
          <span>Agregar al pedido</span>
          <span className="cp-fam-cta-total">{units === 0 ? "" : `· ${fmtAR(amount)}`}</span>
        </button>
      </div>
    </div>
  );
}
