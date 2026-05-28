// src/components/ConfirmSlideProvider.jsx
// Provider + hook para confirmaciones deslizables a nivel global.
// Reemplaza window.confirm() con UX de deslizar (acciones peligrosas).
//
// Setup:
//   En Admin.jsx (o App.jsx) envolvé el árbol con <ConfirmSlideProvider>...</ConfirmSlideProvider>
//
// Uso desde cualquier componente hijo:
//   const confirm = useConfirm();
//   const ok = await confirm({
//     title: "Eliminar proveedor",
//     body: "Sus gastos históricos se preservan.",
//     label: "Deslizá para eliminar",
//   });
//   if (!ok) return;
//   // proceder con la acción destructiva

import { createContext, useContext, useState, useCallback, useRef } from "react";
import SlideToConfirm from "./SlideToConfirm";

const ConfirmCtx = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) {
    // Fallback: si no hay provider en árbol, usar confirm() nativo para no romper.
    return async (opts) => window.confirm(opts?.body || opts?.title || "¿Continuar?");
  }
  return ctx;
}

export default function ConfirmSlideProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: opts.title || "Confirmar acción",
        body: opts.body || "",
        label: opts.label || "Deslizá para confirmar",
        loadingLabel: opts.loadingLabel || "Procesando…",
        successLabel: opts.successLabel || "Listo ✓",
      });
    });
  }, []);

  const close = useCallback((result) => {
    setState(null);
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(result);
  }, []);

  const handleConfirm = useCallback(async () => {
    // SlideToConfirm muestra ✓ por unos ms; pequeño delay y cerramos con true.
    setTimeout(() => close(true), 400);
  }, [close]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div
          onClick={() => close(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420,
              background: "var(--ag-bg-card)",
              borderRadius: 16,
              padding: "20px 18px",
              boxShadow: "var(--ag-sh-lg)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ag-ink)", marginBottom: 6 }}>
              {state.title}
            </div>
            {state.body && (
              <div style={{ fontSize: 12.5, color: "var(--ag-ink-2)", marginBottom: 16, lineHeight: 1.45 }}>
                {state.body}
              </div>
            )}
            <SlideToConfirm
              danger
              label={state.label}
              loadingLabel={state.loadingLabel}
              successLabel={state.successLabel}
              onConfirm={handleConfirm}
            />
            <button
              type="button"
              onClick={() => close(false)}
              className="ag-btn-ghost"
              style={{ marginTop: 10, width: "100%", padding: "10px", fontSize: 12.5, color: "var(--ag-ink-3)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
