// src/components/ConfirmSlideDialog.jsx
// Modal de confirmación con SlideToConfirm para acciones peligrosas/destructivas.
// Reemplaza el `window.confirm()` nativo con UX deslizable.
//
// Uso típico:
//   const [confirmState, setConfirmState] = useState(null);
//   // disparar:
//   setConfirmState({
//     title: "Eliminar proveedor",
//     body: "Sus gastos históricos se preservan.",
//     label: "Deslizá para eliminar",
//     onConfirm: async () => { await deleteSupplier(...); }
//   });
//   // render:
//   <ConfirmSlideDialog state={confirmState} onClose={() => setConfirmState(null)} />

import SlideToConfirm from "./SlideToConfirm";

export default function ConfirmSlideDialog({ state, onClose }) {
  if (!state) return null;
  const {
    title = "Confirmar acción",
    body = "",
    label = "Deslizá para confirmar",
    loadingLabel = "Procesando…",
    successLabel = "Listo ✓",
    onConfirm,
  } = state;

  const handle = async () => {
    await Promise.resolve(onConfirm?.());
    // pequeño delay para que el usuario vea el ✓ antes de cerrar
    setTimeout(() => onClose?.(), 500);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
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
          {title}
        </div>
        {body && (
          <div style={{ fontSize: 12.5, color: "var(--ag-ink-2)", marginBottom: 16, lineHeight: 1.45 }}>
            {body}
          </div>
        )}
        <SlideToConfirm
          danger
          label={label}
          loadingLabel={loadingLabel}
          successLabel={successLabel}
          onConfirm={handle}
        />
        <button
          type="button"
          onClick={onClose}
          className="ag-btn-ghost"
          style={{ marginTop: 10, width: "100%", padding: "10px", fontSize: 12.5, color: "var(--ag-ink-3)" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
