// src/catalog-pro/OpcionesProducto.jsx
// Grupos de opciones de un producto en la ficha (0135: products.option_groups).
// single -> radios; multiple -> casillas, con cantidad si la opcion admite mas
// de una. Mismo lenguaje que el selector de tamanos de ProductDetailScreen.
//
// Props:
//   grupos   [{id,name,type,required,min,max,choices:[{id,label,price,max_qty}]}]
//   estado   { [groupId]: { [choiceId]: qty } }
//   onChange(nuevoEstado)
//   formato(n)  texto de un precio ("+$1,5")
//   faltan   Set de groupId sin completar, para marcar el grupo (solo despues de intentar)
import { limitesDeGrupo } from "../lib/opcionesPedido";

const RAIZ = { padding: "20px 22px 0", display: "flex", flexDirection: "column", gap: 24 };

function Cantidad({ valor, max, etiqueta, onMenos, onMas }) {
  const boton = {
    width: 44, height: 44, border: "1px solid var(--line)", borderRadius: 12,
    background: "var(--bg)", color: "var(--tx)", fontSize: 20, lineHeight: 1,
    cursor: "pointer", fontFamily: "var(--font-body)",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button type="button" style={boton} aria-label={`Quitar ${etiqueta}`} onClick={onMenos}>−</button>
      <output style={{ minWidth: 24, textAlign: "center", fontWeight: 700, color: "var(--tx)" }}>{valor}</output>
      <button type="button" style={{ ...boton, opacity: valor >= max ? 0.4 : 1 }} aria-label={`Sumar ${etiqueta}`}
        disabled={valor >= max} onClick={onMas}>+</button>
    </div>
  );
}

export default function OpcionesProducto({ grupos, estado, onChange, formato, faltan = new Set() }) {
  const poner = (groupId, choiceId, qty, g) => {
    const actual = { ...(estado[groupId] || {}) };
    if (g.type === "single") {
      onChange({ ...estado, [groupId]: { [choiceId]: 1 } });
      return;
    }
    if (qty <= 0) delete actual[choiceId]; else actual[choiceId] = qty;
    // Con el tope de elecciones alcanzado, las demas casillas quedan deshabilitadas.
    onChange({ ...estado, [groupId]: actual });
  };

  return (
    <div style={RAIZ}>
      {grupos.map((g) => {
        const { min, max } = limitesDeGrupo(g);
        const elegidas = Object.keys(estado[g.id] || {}).length;
        const pendiente = faltan.has(g.id);
        const regla = g.required || min > 0
          ? "Obligatorio"
          : "Opcional";
        const tope = g.type === "multiple" && max < g.choices.length ? ` · hasta ${max}` : "";
        return (
          <fieldset key={g.id} id={`opt-${g.id}`} aria-invalid={pendiente || undefined} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <legend style={{ padding: 0, width: "100%" }}>
              <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, color: "var(--tx)" }}>{g.name}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
                  color: pendiente ? "var(--tx)" : g.required || min > 0 ? "var(--ac)" : "var(--t2)",
                  textDecoration: pendiente ? "underline wavy var(--err, #C0392B)" : "none",
                }} role={pendiente ? "alert" : undefined}>{pendiente ? "Falta elegir" : regla}{tope}</span>
              </span>
            </legend>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.choices.map((c) => {
                const qty = (estado[g.id] || {})[c.id] || 0;
                const activa = qty > 0;
                const tipoSingle = g.type === "single";
                const maxQty = c.max_qty || 1;
                const llena = !activa && elegidas >= max && !tipoSingle;
                const precio = Number(c.price) || 0;
                return (
                  <label key={c.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", minHeight: 52,
                    border: `1.5px solid ${activa ? "var(--ac)" : "var(--line)"}`,
                    background: activa ? "var(--ac-soft, var(--b2))" : "var(--bg)",
                    borderRadius: 14, cursor: llena ? "not-allowed" : "pointer", opacity: llena ? 0.5 : 1,
                    transition: "border-color 150ms, background 150ms",
                  }}>
                    <input
                      type={tipoSingle ? "radio" : "checkbox"} name={`opt-${g.id}`} checked={activa} disabled={llena}
                      onChange={() => poner(g.id, c.id, activa && !tipoSingle ? 0 : 1, g)}
                      style={{ accentColor: "var(--ac)", width: 20, height: 20, cursor: "inherit", flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14.5, color: "var(--tx)" }}>{c.label}</span>
                    {precio > 0 && (
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--t2)", flexShrink: 0 }}>+{formato(precio)}</span>
                    )}
                    {activa && !tipoSingle && maxQty > 1 && (
                      <Cantidad
                        valor={qty} max={maxQty} etiqueta={c.label}
                        onMenos={(e) => { e.preventDefault(); e.stopPropagation(); poner(g.id, c.id, qty - 1, g); }}
                        onMas={(e) => { e.preventDefault(); e.stopPropagation(); poner(g.id, c.id, qty + 1, g); }}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
