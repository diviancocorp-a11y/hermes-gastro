// Pantalla de verificación: pato + spinner + countdown
export default function VerificationScreen({ paymentMethod, waitTimer }) {
  const isDigital = paymentMethod === "transferencia" || paymentMethod === "mercadopago";
  return (
    <div className="po" style={{ zIndex: 250, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32, background: "white" }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .duck-spinner {
          position: relative;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }
        .duck-spinner::before {
          content: '';
          position: absolute;
          width: 120px;
          height: 120px;
          border: 4px solid var(--b2, #F3EDE4);
          border-radius: 50%;
          border-top: 4px solid #C45D3E;
          border-right: 4px solid #C45D3E;
          animation: spin 1.2s linear infinite;
        }
        .duck-emoji {
          font-size: 56px;
          z-index: 1;
        }
      `}</style>
      <div className="duck-spinner">
        <div className="duck-emoji">🦆</div>
      </div>
      <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, marginBottom: 8, margin: "0 0 8px 0" }}>Verificando tu pedido...</h2>
      <p style={{ fontSize: 14, color: "var(--t3)", lineHeight: 1.6, maxWidth: 300, marginBottom: 20 }}>
        {isDigital
          ? "La Nona está revisando tu comprobante de pago."
          : "La Nona está confirmando tu pedido."}
      </p>
      <div style={{ marginTop: 0, width: "100%", maxWidth: 280 }}>
        <div style={{ background: "var(--b2)", borderRadius: 20, height: 8, overflow: "hidden" }}>
          <div style={{ background: "var(--ac)", height: "100%", borderRadius: 20, transition: "width 1s linear", width: `${((60 - waitTimer) / 60) * 100}%` }} />
        </div>
        <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 8 }}>Confirmación automática en {waitTimer}s</p>
      </div>
    </div>
  );
}
