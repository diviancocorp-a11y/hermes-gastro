// src/pages/Personalizacion.jsx
// Pagina propia para Personalizacion (antes era modal full-screen abierto
// desde el avatar del admin). Migracion #95: tener URL navegable +
// mejor UX (browser back button + deep-linking).
//
// Internamente reusa BrandModal con open=true. El "onClose" navega al admin
// (preserva la tab anterior con location.state).

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import BrandModal from "../components/admin/shared/BrandModal";
import { fetchSettings, updateSettings } from "../services/settings";
import ConfirmSlideProvider from "../components/ConfirmSlideProvider";
import { supabase } from "../lib/supabase";
import useAdminGate from "../hooks/useAdminGate";
import AccessDenied from "../components/admin/AccessDenied";

export default function Personalizacion() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sett, setSett] = useState(null);
  const [toast, setToast] = useState("");

  // Gate: esta ruta es deep-linkeable -> mismo control que /admin.
  const [authUser, setAuthUser] = useState(undefined); // undefined = cargando
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthUser(data?.session?.user || null));
  }, []);
  const gate = useAdminGate(authUser?.id || null);

  useEffect(() => {
    fetchSettings().then(s => setSett(s || {}));
  }, []);

  // Sin sesion -> al admin (muestra login). Sin rol -> denied.
  useEffect(() => {
    if (authUser === null) navigate("/admin", { replace: true });
  }, [authUser, navigate]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const goBack = () => {
    // Si vino del admin, volver. Sino, ir al home del admin.
    const fromAdmin = location.state?.from === "admin";
    if (fromAdmin) navigate(-1);
    else navigate("/admin");
  };

  // Acceso: cliente de catalogo logueado pero sin fila en admin_users.
  if (authUser && gate.status === "denied") {
    return <AccessDenied email={authUser?.email || ""} />;
  }

  // Loading state mientras carga settings (o la sesion/rol)
  if (!sett || authUser === undefined || (authUser && gate.status === "checking")) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ag-ink-3, #9C8B7A)" }}>
        Cargando...
      </div>
    );
  }

  return (
    <ConfirmSlideProvider>
      <BrandModal
        open={true}
        settings={sett}
        setSettings={async (next) => {
          // Persistir cambios para que el cliente vea actualizado el catalogo
          setSett(next);
          if (typeof next === "object" && next !== null) {
            try { await updateSettings(next); } catch { /* ignore */ }
          }
        }}
        onClose={goBack}
        showToast={showToast}
      />
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          padding: "10px 16px", background: "var(--ag-ink, #2D1B0E)", color: "#fff",
          borderRadius: 12, fontSize: 13, zIndex: 9999, boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
        }}>{toast}</div>
      )}
    </ConfirmSlideProvider>
  );
}
