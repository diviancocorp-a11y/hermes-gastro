// src/catalog-pro/WhatsAppFloat.jsx
// Boton flotante de WhatsApp del negocio. Solo aparece si settings.whatsapp
// tiene un numero. Abre wa.me con mensaje pre-llenado.
import { useEffect, useRef, useState } from "react";

// Con `etiqueta` (plantillas de marca) el boton se expande a "icono + etiqueta" al
// pasar el cursor o enfocarlo. En pantallas tactiles el primer toque lo expande y
// el segundo abre el chat; se cierra solo a los 4 s o al tocar fuera.
export default function WhatsAppFloat({ whatsapp, bizName, etiqueta }) {
  const [expandido, setExpandido] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!expandido) return undefined;
    const t = setTimeout(() => setExpandido(false), 4000);
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setExpandido(false); };
    document.addEventListener("pointerdown", fuera);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", fuera); };
  }, [expandido]);
  const sinHover = () => { try { return window.matchMedia("(hover: none)").matches; } catch { return false; } };
  const sinMovimiento = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const alTocar = (e) => { if (etiqueta && sinHover() && !expandido) { e.preventDefault(); setExpandido(true); } };

  const phone = (whatsapp || "").replace(/\D/g, "");
  if (!phone) return null;

  const msg = encodeURIComponent(`Hola${bizName ? " " + bizName : ""}! Tengo una consulta.`);
  const href = `https://wa.me/${phone}?text=${msg}`;

  return (
    <a
      ref={ref}
      href={href}
      onClick={alTocar}
      onMouseEnter={etiqueta ? () => setExpandido(true) : undefined}
      onMouseLeave={etiqueta ? () => setExpandido(false) : undefined}
      onFocus={etiqueta ? () => setExpandido(true) : undefined}
      onBlur={etiqueta ? () => setExpandido(false) : undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      style={{
        position: "fixed",
        bottom: 88,
        right: 16,
        minWidth: 54,
        height: 54,
        padding: etiqueta && expandido ? "0 18px 0 15px" : 0,
        gap: etiqueta && expandido ? 8 : 0,
        transition: etiqueta && !sinMovimiento() ? "padding 180ms ease, gap 180ms ease" : undefined,
        borderRadius: 999,
        background: "#25D366",
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        textDecoration: "none",
        color: "#fff",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      {etiqueta && (
        <span style={{ maxWidth: expandido ? 90 : 0, opacity: expandido ? 1 : 0, overflow: "hidden", whiteSpace: "nowrap", fontSize: 15, fontWeight: 800, transition: sinMovimiento() ? undefined : "max-width 180ms ease, opacity 180ms ease" }}>{etiqueta}</span>
      )}
    </a>
  );
}
