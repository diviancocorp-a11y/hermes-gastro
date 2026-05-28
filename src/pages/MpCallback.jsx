// src/pages/MpCallback.jsx
// Ruta /mp-callback — termina el OAuth flow de MercadoPago.
//
// Flow:
//   1. Admin clickeó "Conectar MercadoPago" en Settings → fue a MP authorization
//   2. MP redirige aquí con ?code=XXX&state=YYY
//   3. Llamamos a la edge function mp-oauth-callback con el code
//   4. La edge function intercambia code → access_token y persiste en payment_integrations
//   5. Volvemos al admin (Settings → Pasarelas) con badge "Conectado ✓"
//
// Si llega con ?error=... (denegado/expired), mostramos el error y un botón "Volver a Pasarelas".

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { completeMercadoPagoOAuth } from "../services/paymentIntegrations";

export default function MpCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing"); // processing | ok | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = params.get("code");
    const err = params.get("error");
    const errDesc = params.get("error_description");

    if (err) {
      setStatus("error");
      setErrorMsg(errDesc || err);
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMsg("No se recibió código de autorización de MercadoPago.");
      return;
    }

    const redirectUri = `${window.location.origin}/mp-callback`;
    completeMercadoPagoOAuth({ code, redirectUri })
      .then((res) => {
        if (res?.ok) {
          setStatus("ok");
          // Redirigir a Settings → Pasarelas después de 1.5s
          setTimeout(() => {
            navigate("/admin?settings=gateways", { replace: true });
          }, 1500);
        } else {
          setStatus("error");
          setErrorMsg(res?.error || "No se pudo completar la conexión.");
        }
      })
      .catch((e) => {
        setStatus("error");
        setErrorMsg(String(e?.message || e));
      });
  }, [params, navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 16,
      background: "var(--ag-bg, #fafaf7)",
    }}>
      {status === "processing" && (
        <>
          <div style={{ fontSize: 48 }}>⏳</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ag-text, #1a1a1a)" }}>
            Conectando MercadoPago...
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ag-muted, #6b6b6b)", textAlign: "center" }}>
            Estamos terminando la autorización. Esto toma unos segundos.
          </p>
        </>
      )}
      {status === "ok" && (
        <>
          <div style={{ fontSize: 48 }}>✓</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#10b981" }}>
            ¡MercadoPago conectado!
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ag-muted, #6b6b6b)", textAlign: "center" }}>
            Redirigiendo a Configuración...
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <div style={{ fontSize: 48 }}>✕</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#ef4444" }}>
            No se pudo conectar
          </h2>
          <p style={{
            margin: 0,
            fontSize: 14,
            color: "var(--ag-muted, #6b6b6b)",
            textAlign: "center",
            maxWidth: 420,
          }}>
            {errorMsg}
          </p>
          <button
            onClick={() => navigate("/admin?settings=gateways", { replace: true })}
            style={{
              marginTop: 12,
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#009EE3",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Volver a Pasarelas
          </button>
        </>
      )}
    </div>
  );
}
