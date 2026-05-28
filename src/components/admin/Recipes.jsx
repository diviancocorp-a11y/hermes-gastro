/**
 * Recipes.jsx — Editor de productos del menú (sistema visual v2).
 *
 * Vista principal:
 *   - Header con título "Recetas" + KPI activas/archivadas
 *   - Toggle "Ver archivadas" inline
 *   - Búsqueda
 *   - CTA "Agregar receta" arriba (no FAB flotante)
 *   - Lista con barra de rentabilidad por receta:
 *     · verde (sales)   = ≥50% margen
 *     · amarillo (stock) = 30-50%
 *     · rojo (orders)   = <30%
 *
 * Modales (ag-page-over):
 *   - RecDet: ver receta + stats grid + tabla ingredientes + archivar/restaurar
 *   - RecForm: crear/editar con upload de imagen, combos y sugerencias upselling
 */
import { useState, useRef, useMemo } from "react";
import { useConfirm } from "../ConfirmSlideProvider";
import { formatInt, formatMoney } from "../../lib/utils";
import {
  fetchRecipeIngredients,
  saveRecipeIngredients,
  fetchComboItems,
  saveComboItems,
  upsertRecipe,
  toggleRecipeVisibility,
  archiveRecipe,
  unarchiveRecipe,
  uploadRecipeImage,
} from "../../lib/adminService";

// Color de rentabilidad según margen
function marginColor(m) {
  if (m >= 50) return { fg: "var(--ag-c-sales)",  soft: "var(--ag-c-sales-soft)",  label: "Alta" };
  if (m >= 30) return { fg: "var(--ag-c-stock)",  soft: "var(--ag-c-stock-soft)",  label: "Media" };
  return        { fg: "var(--ag-c-orders)", soft: "var(--ag-c-orders-soft)", label: "Baja" };
}

function Recipes({ recipes, setRecipes, ingredients, calculateRecipeCost, overlay, setOverlay, showToast, loadAll, settings }) {
  const confirmSlide = useConfirm();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const active = useMemo(() => recipes.filter(r => !r.is_archived), [recipes]);
  const archived = useMemo(() => recipes.filter(r => r.is_archived), [recipes]);
  const base = showArchived ? archived : active;

  // Filtrar por búsqueda y ordenar por rentabilidad descendente (alta → baja).
  // Las que tienen precio 0 (sin venta configurada) van al final.
  const filt = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? base.filter(r => (r.name || "").toLowerCase().includes(q)) : base;
    return [...filtered].sort((a, b) => {
      const cA = calculateRecipeCost(a);
      const cB = calculateRecipeCost(b);
      const mA = a.sale_price > 0 ? ((a.sale_price - cA) / a.sale_price * 100) : -Infinity;
      const mB = b.sale_price > 0 ? ((b.sale_price - cB) / b.sale_price * 100) : -Infinity;
      return mB - mA; // desc
    });
  }, [base, search, calculateRecipeCost]);

  return (
    <>
      <div style={{ padding: "12px 16px 6px", position: "relative", zIndex: 2 }}>
        {/* Header: título + KPI */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 22,
              margin: 0, color: "var(--ag-ink)", letterSpacing: "-0.01em", lineHeight: 1.1,
            }}>Recetas</h1>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--ag-ink-3)" }}>
              {active.length} activa{active.length !== 1 ? "s" : ""}{archived.length > 0 && ` · ${archived.length} archivada${archived.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {archived.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(p => !p)}
              style={{
                padding: "8px 12px",
                background: showArchived ? "var(--ag-c-stock)" : "var(--ag-bg-card)",
                border: `1.5px solid ${showArchived ? "var(--ag-c-stock)" : "var(--ag-line)"}`,
                color: showArchived ? "#fff" : "var(--ag-ink-2)",
                borderRadius: 12,
                fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              📦 {showArchived ? "Ver activas" : `Archivadas (${archived.length})`}
            </button>
          )}
        </div>

        {/* Banner si está viendo archivadas */}
        {showArchived && (
          <div style={{
            padding: "8px 12px", marginBottom: 12,
            background: "var(--ag-bg-card)",
            border: "1px solid var(--ag-c-stock)",
            borderRadius: 10,
            fontSize: 12, color: "var(--ag-ink-2)",
          }}>
            <strong style={{ color: "var(--ag-c-stock)" }}>📦 Archivadas.</strong> No aparecen en el catálogo público pero su historial se conserva.
          </div>
        )}

        {/* Buscador */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ag-ink-3)", pointerEvents: "none" }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="ag-field-input"
            placeholder="Buscar receta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>

        {/* CTA agregar receta (arriba para acceso rápido) */}
        {!showArchived && (
          <button
            type="button"
            onClick={() => setOverlay({ type: "editR", data: null })}
            className="ag-btn-primary"
            style={{ width: "100%", padding: "12px", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar receta
          </button>
        )}

        {/* Lista de recetas */}
        {filt.length === 0 ? (
          <div className="ag-card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ color: "var(--ag-ink-3)", fontSize: 13 }}>
              {search ? `Sin resultados para "${search}"` :
               showArchived ? "Sin recetas archivadas" :
               "Aún no creaste recetas"}
            </div>
          </div>
        ) : (
          filt.map(r => {
            const c = calculateRecipeCost(r);
            const m = r.sale_price > 0 ? ((r.sale_price - c) / r.sale_price * 100) : 0;
            const mc = marginColor(m);
            const visible = r.visible !== false;
            return (
              <div
                key={r.id}
                className="ag-card"
                style={{
                  marginBottom: 8, padding: "12px 14px",
                  opacity: r.is_archived ? 0.7 : 1,
                  cursor: "pointer",
                  borderTop: `3px solid ${mc.fg}`,
                }}
                onClick={() => setOverlay({ type: "viewR", data: r })}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ag-ink)" }}>{r.name}</span>
                      {r.is_archived && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 800,
                          padding: "1px 6px", borderRadius: 6,
                          background: "var(--ag-c-orders-soft)", color: "var(--ag-c-orders)",
                          letterSpacing: "0.04em",
                        }}>ARCHIVADA</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ag-ink-3)" }}>
                      {r.category || "Sin categoría"} · {(r.ingredients || []).length} insumo{(r.ingredients || []).length !== 1 ? "s" : ""}
                      {r.is_combo && " · 🍱 combo"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ag-ink)" }}>${formatInt(r.sale_price)}</div>
                      <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)" }}>costo ${formatMoney(c)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const nv = !visible;
                        const ok = await toggleRecipeVisibility(r.id, nv);
                        if (ok) {
                          setRecipes(p => p.map(x => x.id === r.id ? { ...x, visible: nv } : x));
                          showToast(nv ? "Visible en catálogo ✓" : "Oculta del catálogo");
                        } else { showToast("Error al cambiar visibilidad"); }
                      }}
                      aria-label={visible ? "Ocultar del catálogo" : "Mostrar en catálogo"}
                      style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: visible ? "var(--ag-c-sales-soft)" : "var(--ag-bg-soft)",
                        color: visible ? "var(--ag-c-sales)" : "var(--ag-ink-3)",
                        border: 0, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {visible ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {/* Barra de rentabilidad */}
                <div style={{
                  height: 6, background: "var(--ag-bg-soft)",
                  borderRadius: 999, overflow: "hidden",
                }}>
                  <div style={{
                    width: `${Math.max(0, Math.min(m, 100))}%`,
                    height: "100%", background: mc.fg,
                    transition: "width 0.3s",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: mc.fg, fontWeight: 800 }}>
                    Rent {mc.label}: {m.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--ag-c-sales)", fontWeight: 800 }}>
                    Ganancia ${formatMoney(r.sale_price - c)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modales */}
      {overlay?.type === "viewR" && (
        <RecDet
          r={overlay.data}
          ingredients={ingredients}
          calculateRecipeCost={calculateRecipeCost}
          settings={settings}
          onClose={() => setOverlay(null)}
          onEdit={async () => {
            let d = { ...overlay.data };
            if (d.id) {
              const ri = await fetchRecipeIngredients(d.id);
              d.ingredients = (ri || []).map(x => ({ ...x, quantity: x.qty || x.quantity || 0, qty: x.qty || x.quantity || 0 }));
            }
            if (d.is_combo && d.id) {
              const ci = await fetchComboItems(d.id);
              d.comboItems = ci.map(x => ({ sub_recipe_id: x.sub_recipe_id, qty: x.qty }));
            }
            setOverlay({ type: "editR", data: d });
          }}
          onArchive={async (id) => {
            const rec = (recipes || []).find(x => x.id === id);
            const ok = await confirmSlide({
              title: `Archivar "${rec?.name || "receta"}"`,
              body: "Deja de aparecer en el catálogo público y en pedidos nuevos. Las ventas históricas se preservan. Podés restaurarla después.",
              label: "Deslizá para archivar",
              loadingLabel: "Archivando…",
              successLabel: "Archivada ✓",
            });
            if (!ok) return;
            await archiveRecipe(id);
            setRecipes(p => p.map(x => x.id === id ? { ...x, is_archived: true } : x));
            setOverlay(null);
            showToast("Receta archivada · historial conservado");
          }}
          onUnarchive={async (id) => {
            const rec = (recipes || []).find(x => x.id === id);
            const ok = await confirmSlide({
              title: `Restaurar "${rec?.name || "receta"}"`,
              body: "Volverá a aparecer en el catálogo público y los clientes podrán pedirla otra vez.",
              label: "Deslizá para restaurar",
              loadingLabel: "Restaurando…",
              successLabel: "Restaurada ✓",
            });
            if (!ok) return;
            await unarchiveRecipe(id);
            setRecipes(p => p.map(x => x.id === id ? { ...x, is_archived: false } : x));
            setOverlay(null);
            showToast("Receta restaurada");
          }}
        />
      )}
      {overlay?.type === "editR" && (
        <RecForm
          data={overlay.data}
          ingredients={ingredients}
          recipes={recipes}
          onClose={() => setOverlay(null)}
          onSave={async (r) => {
            const saved = await upsertRecipe({
              id: r.id, name: r.name, category: r.category,
              sale_price: r.sale_price, visible: r.visible,
              image_url: r.image_url, description: r.description,
              related_ids: r.related_ids || [], is_combo: r.is_combo || false,
            });
            if (saved?.__error === "duplicate") {
              showToast("⚠ Ya existe una receta activa con ese nombre");
              return;
            }
            if (saved) {
              await saveRecipeIngredients(saved.id, (r.ingredients || []).map(ri => ({
                ingredient_id: ri.ingredient_id, qty: ri.qty || ri.quantity,
              })));
              if (r.is_combo) {
                await saveComboItems(saved.id, (r.comboItems || []).filter(ci => ci.sub_recipe_id && ci.qty > 0));
              }
              await loadAll();
              setOverlay(null);
              showToast(r.id ? "Actualizada ✓" : "Creada ✓");
            }
          }}
        />
      )}
    </>
  );
}

/* ─── RecDet: ver receta ────────────────────────────────────── */
function RecDet({ r, ingredients, calculateRecipeCost, settings, onClose, onEdit, onArchive, onUnarchive }) {
  const wastePct = Number(settings?.waste_pct ?? 5);
  const expensePct = Number(settings?.expense_pct ?? 0);
  // Derivo el costo base sin ajustes a partir del costo total con ajustes,
  // así puedo mostrar el monto en $ que cada % representa.
  // costoTotal = costoBase × (1 + wastePct/100 + expensePct/100)
  // → costoBase = costoTotal / (1 + wastePct/100 + expensePct/100)
  const _costFactor = 1 + (wastePct + expensePct) / 100;
  const c = calculateRecipeCost(r);
  const m = r.sale_price > 0 ? ((r.sale_price - c) / r.sale_price * 100) : 0;
  const mc = marginColor(m);
  const [confirmArch, setConfirmArch] = useState(false);
  const visible = r.visible !== false;

  return (
    <div className="ag-page-over">
      <div className="ag-page-over-head">
        <button type="button" className="ag-subpage-back" onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Atrás</span>
        </button>
        <h2 className="ag-page-over-title">{r.name}</h2>
      </div>

      <div className="ag-page-over-body">
        {/* Fila: badges de estado (izq) + pill Editar (der) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap", minWidth: 0 }}>
            <span style={{
              padding: "3px 10px", borderRadius: 999,
              background: visible ? "var(--ag-c-sales-soft)" : "var(--ag-c-orders-soft)",
              color: visible ? "var(--ag-c-sales)" : "var(--ag-c-orders)",
              fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em",
            }}>
              {visible ? "VISIBLE" : "OCULTA"}
            </span>
            {r.is_combo && (
              <span style={{
                padding: "3px 10px", borderRadius: 999,
                background: "var(--ag-c-recipes-soft)", color: "var(--ag-c-recipes)",
                fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em",
              }}>🍱 COMBO</span>
            )}
            {r.is_archived && (
              <span style={{
                padding: "3px 10px", borderRadius: 999,
                background: "var(--ag-c-orders-soft)", color: "var(--ag-c-orders)",
                fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em",
              }}>📦 ARCHIVADA</span>
            )}
          </div>

          {/* Pill Editar — mismo estilo que la badge VISIBLE (soft bg + texto verde) */}
          {!r.is_archived && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Editar receta"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 10px",
                borderRadius: 999,
                background: "var(--ag-c-sales-soft)",
                color: "var(--ag-c-sales)",
                border: 0, cursor: "pointer",
                fontFamily: "inherit", fontSize: 10.5, fontWeight: 800,
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              EDITAR
            </button>
          )}
        </div>

        {/* Stats grid 3x2 — IZQ: Venta · Ganancia · Rentabilidad | DER: Gastos · Merma · Costo */}
        {(() => {
          const baseCost = _costFactor > 0 ? c / _costFactor : c;
          const montoMerma = baseCost * (wastePct / 100);
          const montoGastos = baseCost * (expensePct / 100);
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              {/* Fila 1: Venta | Gastos */}
              <div className="ag-card" style={{ padding: "12px 14px", borderTop: "3px solid var(--ag-c-sales)" }}>
                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Venta</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ag-ink)" }}>${formatInt(r.sale_price)}</div>
              </div>
              <div className="ag-card" style={{ padding: "12px 14px", borderTop: "3px solid var(--ag-c-orders)" }}>
                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Gastos {expensePct}%</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ag-c-orders)" }}>+${formatMoney(montoGastos)}</div>
              </div>
              {/* Fila 2: Ganancia | Merma */}
              <div className="ag-card" style={{ padding: "12px 14px", borderTop: "3px solid var(--ag-c-sales)" }}>
                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ganancia</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ag-c-sales)" }}>${formatMoney(r.sale_price - c)}</div>
              </div>
              <div className="ag-card" style={{ padding: "12px 14px", borderTop: "3px solid var(--ag-c-stock)" }}>
                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Merma {wastePct}%</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ag-c-stock)" }}>+${formatMoney(montoMerma)}</div>
              </div>
              {/* Fila 3: Rentabilidad | Costo */}
              <div className="ag-card" style={{ padding: "12px 14px", borderTop: "3px solid " + mc.fg }}>
                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rentabilidad</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: mc.fg }}>{m.toFixed(1)}%</div>
              </div>
              <div className="ag-card" style={{ padding: "12px 14px", borderTop: "3px solid var(--ag-c-terra)" }}>
                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Costo</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ag-c-terra)" }}>${formatMoney(c)}</div>
              </div>
            </div>
          );
        })()}

        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Ingredientes ({(r.ingredients || []).length})
        </div>
        <div className="ag-card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
          {(r.ingredients || []).length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12 }}>
              Sin ingredientes configurados
            </div>
          ) : (
            <>
              {(r.ingredients || []).map((ri, i) => {
                const ig = ingredients.find(x => x.id === ri.ingredient_id);
                if (!ig) return null;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--ag-line)" }}>
                    <div style={{ flex: 1, fontSize: 13, color: "var(--ag-ink)", fontWeight: 600 }}>{ig.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ag-ink-2)" }}>{ri.quantity} {ig.unit}</div>
                    <div style={{ fontSize: 13, color: "var(--ag-ink)", fontWeight: 700, minWidth: 60, textAlign: "right" }}>
                      ${formatMoney((ig.cost || 0) * ri.quantity)}
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderTop: "2px solid var(--ag-c-terra)", background: "var(--ag-bg-soft)" }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: "var(--ag-ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ag-c-terra)" }}>${formatMoney(c)}</div>
              </div>
            </>
          )}
        </div>

        {r.is_archived ? (
          <button type="button" onClick={() => onUnarchive(r.id)} className="ag-btn-primary" style={{ width: "100%", padding: "12px", fontSize: 13 }}>↩ Restaurar receta</button>
        ) : !confirmArch ? (
          <button type="button" onClick={() => setConfirmArch(true)}
            style={{ width: "100%", padding: "12px", background: "transparent", border: "1px solid var(--ag-c-orders)", color: "var(--ag-c-orders)", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Archivar receta
          </button>
        ) : (
          <div style={{ padding: 12, background: "var(--ag-c-orders-soft)", border: "1px solid var(--ag-c-orders)", borderRadius: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--ag-c-orders)", fontWeight: 700, marginBottom: 6 }}>
              ¿Archivar "{r.name}"?
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ag-ink-2)", marginBottom: 10 }}>
              No aparecerá en el catálogo, pero el historial de ventas se conserva.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setConfirmArch(false)} className="ag-btn-ghost" style={{ flex: 1, padding: "10px", fontSize: 12 }}>Cancelar</button>
              <button type="button" onClick={() => onArchive(r.id)}
                style={{ flex: 1, padding: "10px", background: "var(--ag-c-orders)", color: "#fff", border: 0, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Sí, archivar
              </button>
            </div>
          </div>
        )}

        <button type="button" className="ag-btn-ghost" onClick={onClose}
          style={{ marginTop: 10, width: "100%", padding: "12px", fontSize: 13 }}>← Volver</button>
      </div>
    </div>
  );
}

function RecForm({ data, ingredients, recipes, onClose, onSave }) {
  const [f, setF] = useState(data || {
    name: "", category: "", sale_price: 0, visible: true,
    image_url: "", description: "", ingredients: [], related_ids: [], is_combo: false,
  });
  const [ad, setAd] = useState(false);
  const [si, setSi] = useState("");
  const [sq, setSq] = useState("");
  const [showRel, setShowRel] = useState(false);
  const [comboItems, setComboItems] = useState(data?.comboItems || []);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef();

  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const addI = () => {
    if (!si || !sq) return;
    const n = Number(sq);
    s("ingredients", [...f.ingredients, { ingredient_id: si, quantity: n, qty: n }]);
    setSi(""); setSq(""); setAd(false);
  };
  const toggleRel = (id) => {
    const cur = f.related_ids || [];
    s("related_ids", cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  };
  const otherRecs = (recipes || []).filter(r => r.id !== f.id && !r.is_combo);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(""); setUploading(true);
    const result = await uploadRecipeImage(file);
    setUploading(false);
    if (result?.__error) { setUploadErr(result.__error); return; }
    if (result) s("image_url", result);
  };

  const addComboItem = () => setComboItems(p => [...p, { sub_recipe_id: "", qty: 1 }]);
  const updCombo = (i, k, v) => setComboItems(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delCombo = (i) => setComboItems(p => p.filter((_, j) => j !== i));

  const totalCost = useMemo(
    () => (f.ingredients || []).reduce((sum, ri) => {
      const ig = ingredients.find(x => x.id === ri.ingredient_id);
      return sum + (ig ? (ig.cost || 0) * (ri.quantity || 0) : 0);
    }, 0),
    [f.ingredients, ingredients]
  );
  const profitNeg = !f.is_combo && totalCost > 0 && totalCost > (f.sale_price || 0);
  const isExisting = !!f.id;
  const canSave = f.name && (f.sale_price || 0) > 0 && (isExisting || f.is_combo || (f.ingredients || []).length > 0);

  return (
    <div className="ag-page-over">
      <div className="ag-page-over-head">
        <button type="button" className="ag-subpage-back" onClick={onClose} aria-label="Cancelar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Atrás</span>
        </button>
        <h2 className="ag-page-over-title">{data ? "Editar receta" : "Nueva receta"}</h2>
      </div>

      <div className="ag-page-over-body">
        <label className="ag-field-lbl">Nombre *</label>
        <input className="ag-field-input" value={f.name} onChange={e => s("name", e.target.value)} placeholder="Ej: Torta de chocolate" style={{ marginBottom: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label className="ag-field-lbl">Categoría</label>
            <input className="ag-field-input" value={f.category} onChange={e => s("category", e.target.value)} placeholder="Ej: Tortas" />
          </div>
          <div>
            <label className="ag-field-lbl">Precio venta *</label>
            <input className="ag-field-input" type="number" min="0" value={f.sale_price || ""} onChange={e => s("sale_price", Number(e.target.value))} placeholder="0" />
          </div>
        </div>

        <label className="ag-field-lbl">Descripción</label>
        <textarea className="ag-field-input" value={f.description || ""} onChange={e => s("description", e.target.value)} rows={2}
          style={{ resize: "vertical", marginBottom: 12, fontFamily: "inherit" }}
          placeholder="Descripción que verá el cliente..." />

        <label className="ag-field-lbl">Imagen del catálogo</label>
        <div style={{ marginBottom: 14 }}>
          {f.image_url && (
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 8, background: "var(--ag-bg-card)", border: "1px solid var(--ag-line)" }}>
              <img src={f.image_url} alt="" loading="lazy" onError={e => { e.target.style.display = "none"; }}
                style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }} />
              <button type="button" onClick={() => s("image_url", "")} aria-label="Quitar imagen"
                style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 999, background: "rgba(20,18,16,0.7)", color: "#fff", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ width: "100%", padding: "12px", background: "var(--ag-bg-card)", border: "1.5px solid var(--ag-c-terra)", color: "var(--ag-c-terra)", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: uploading ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {uploading ? "Subiendo…" : f.image_url ? "Cambiar foto" : "Subir foto"}
          </button>
          {uploadErr && <div style={{ fontSize: 11.5, color: "var(--ag-c-orders)", marginTop: 6 }}>{uploadErr}</div>}
        </div>

        <div className="ag-card" style={{ padding: "4px 12px", marginBottom: 14 }}>
          <ToggleRow label="Visible en catálogo" hint="Los clientes pueden verla y pedirla"
            checked={f.visible !== false} onChange={v => s("visible", v)} />
          <div style={{ borderTop: "1px solid var(--ag-line)" }} />
          <ToggleRow label="Es un combo" hint="Compuesto por otras recetas"
            checked={!!f.is_combo} onChange={v => s("is_combo", v)} />
        </div>

        {f.is_combo && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Sub-recetas ({comboItems.length})
              </div>
              <button type="button" onClick={addComboItem} className="ag-btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>+ Sub-receta</button>
            </div>
            {comboItems.length === 0 ? (
              <div className="ag-card" style={{ padding: 18, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12 }}>
                Agregá las recetas que forman este combo
              </div>
            ) : (
              <div className="ag-card" style={{ padding: 0, overflow: "hidden" }}>
                {comboItems.map((ci, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderTop: i === 0 ? "none" : "1px solid var(--ag-line)" }}>
                    <select className="ag-field-input" style={{ flex: 2 }} value={ci.sub_recipe_id} onChange={e => updCombo(i, "sub_recipe_id", e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {(recipes || []).filter(r => r.id !== f.id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <input className="ag-field-input" style={{ flex: 1 }} type="number" min="1" value={ci.qty} onChange={e => updCombo(i, "qty", Number(e.target.value))} placeholder="Cant" />
                    <button type="button" onClick={() => delCombo(i)} aria-label="Quitar"
                      style={{ width: 30, height: 30, borderRadius: 8, background: "var(--ag-c-orders-soft)", color: "var(--ag-c-orders)", border: 0, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Ingredientes ({(f.ingredients || []).length})
          </div>
          <button type="button" onClick={() => setAd(true)} className="ag-btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>+ Ingrediente</button>
        </div>

        {ad && (
          <div className="ag-card" style={{ padding: 12, marginBottom: 10, background: "var(--ag-bg-card)", border: "1.5px solid var(--ag-c-prep)" }}>
            <label className="ag-field-lbl">Insumo</label>
            <select className="ag-field-input" value={si} onChange={e => setSi(e.target.value)} style={{ marginBottom: 8 }}>
              <option value="">Seleccionar insumo...</option>
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="ag-field-input" type="number" placeholder="Cantidad" value={sq} onChange={e => setSq(e.target.value)} style={{ flex: 1 }} />
              <button type="button" onClick={addI} className="ag-btn-primary" style={{ padding: "10px 16px", fontSize: 13 }} disabled={!si || !sq}>✓</button>
              <button type="button" onClick={() => { setAd(false); setSi(""); setSq(""); }} className="ag-btn-ghost" style={{ padding: "10px 14px", fontSize: 13 }}>×</button>
            </div>
          </div>
        )}

        <div className="ag-card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
          {(f.ingredients || []).length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12 }}>Sin ingredientes</div>
          ) : (
            (f.ingredients || []).map((ri, i) => {
              const ig = ingredients.find(x => x.id === ri.ingredient_id);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--ag-line)" }}>
                  <div style={{ flex: 1, fontSize: 13, color: "var(--ag-ink)", fontWeight: 600 }}>{ig?.name || "?"}</div>
                  <div style={{ fontSize: 12, color: "var(--ag-ink-2)" }}>{ri.quantity} {ig?.unit || ""}</div>
                  <button type="button" onClick={() => s("ingredients", f.ingredients.filter((_, j) => j !== i))} aria-label="Quitar"
                    style={{ width: 28, height: 28, borderRadius: 8, background: "var(--ag-c-orders-soft)", color: "var(--ag-c-orders)", border: 0, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🎯 Sugerencias de venta ({(f.related_ids || []).length})
            </div>
            <button type="button" onClick={() => setShowRel(p => !p)} className="ag-btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>
              {showRel ? "Ocultar" : "Elegir"}
            </button>
          </div>
          {showRel && (
            <div className="ag-card" style={{ padding: 0, maxHeight: 220, overflowY: "auto" }}>
              {otherRecs.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12 }}>No hay otras recetas</div>
              ) : otherRecs.map((r, i) => {
                const sel = (f.related_ids || []).includes(r.id);
                return (
                  <div key={r.id} onClick={() => toggleRel(r.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--ag-line)", cursor: "pointer" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: "2px solid " + (sel ? "var(--ag-c-terra)" : "var(--ag-line)"), background: sel ? "var(--ag-c-terra)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      {sel && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--ag-ink)" }}>{r.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--ag-ink-3)" }}>${formatInt(r.sale_price)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {profitNeg && (
          <div style={{ padding: 12, marginBottom: 12, background: "var(--ag-bg-card)", border: "1px solid var(--ag-c-stock)", borderRadius: 12, display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, color: "var(--ag-ink-2)" }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>⚠</span>
            <div>
              <strong style={{ color: "var(--ag-c-stock)" }}>Precio por debajo del costo.</strong> Ingredientes ${formatMoney(totalCost)} vs venta ${formatInt(f.sale_price || 0)}. Podés guardar igual.
            </div>
          </div>
        )}

        {!canSave && (
          <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", margin: "8px 0 0", textAlign: "center" }}>
            {!f.name ? "Ingresá un nombre" :
             !(f.sale_price > 0) ? "Ingresá un precio mayor a 0" :
             !isExisting && !f.is_combo && (f.ingredients || []).length === 0 ? "Agregá al menos un ingrediente" : ""}
          </div>
        )}

        <button type="button" className="ag-btn-primary" disabled={!canSave}
          onClick={() => canSave && onSave({ ...f, comboItems })}
          style={{ marginTop: 14, width: "100%", padding: "14px", fontSize: 15, opacity: canSave ? 1 : 0.5 }}>
          ✓ {data ? "Guardar cambios" : "Crear receta"}
        </button>

        <button type="button" className="ag-btn-ghost" onClick={onClose}
          style={{ marginTop: 10, width: "100%", padding: "12px", fontSize: 13 }}>← Volver</button>
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--ag-ink)", fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginTop: 1 }}>{hint}</div>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} aria-label={label} aria-pressed={checked}
        style={{
          width: 44, height: 26, borderRadius: 999,
          background: checked ? "var(--ag-c-terra)" : "var(--ag-bg-soft)",
          border: "1px solid " + (checked ? "var(--ag-c-terra)" : "var(--ag-line)"),
          cursor: "pointer", position: "relative", padding: 0, transition: "background 0.15s", flexShrink: 0,
        }}>
        <span style={{
          display: "block", width: 20, height: 20, borderRadius: 999, background: "#fff",
          position: "absolute", top: 2, left: checked ? 21 : 2,
          transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

export default Recipes;
