// src/catalog-pro/CatalogFooter.jsx
// Footer corporativo del catálogo público.
//
// Estructura:
//   1. Bloque del NEGOCIO (cliente de Hermes): FAQ, T&C, cookies,
//      libro de quejas, contacto, trabajá con nosotros.
//   2. Banda Hermes (logo + CTA "para tu negocio") — pequeño y claro
//      de que es la plataforma, no el negocio.

import { useState } from "react";
import HermesMark from "../components/HermesMark";

const HERMES = {
  whatsapp: "5491100000000",          // TODO: número real Hermes
  email: "hola@hermesgastro.com",     // TODO: dominio real Hermes
  instagram: "hermesgastro",          // TODO: handle real Hermes
};

const DEFENSA_CONSUMIDOR_AR = "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario";

function bizCopy(biz) {
  const bizName = biz?.biz_name || "el negocio";
  return {
    terms: `Estos términos rigen el uso del catálogo público de ${bizName}.

Al hacer un pedido aceptás que tus datos (nombre, teléfono, dirección, email) se usen para procesar tu compra y mantener contacto comercial con ${bizName}. No se ceden a terceros con fines publicitarios.

${bizName} es responsable por la calidad, entrega y condiciones del producto/servicio ofrecido. Para reclamos contactanos por WhatsApp o email.

La plataforma técnica del catálogo está provista por Hermes Gastro, que actúa como proveedor de infraestructura y no es parte de la relación comercial entre vos y ${bizName}.

Última actualización: 2026`,

    cookies: `${bizName} usa cookies y almacenamiento local del navegador para:
· Recordar tu carrito y datos de contacto entre visitas.
· Mantener tu sesión activa cuando volvés a la página.
· Estadísticas anónimas de uso para mejorar el servicio.

No usamos cookies de terceros para publicidad dirigida. No vendemos tu información.

Podés borrar las cookies desde la configuración de tu navegador en cualquier momento.`,

    faq: [
      { q: "¿Cómo hago un pedido?", a: "Elegí los productos del catálogo, sumalos al carrito y completá tus datos en el checkout. Te llega un resumen por WhatsApp." },
      { q: "¿Cómo pago?", a: `Los métodos disponibles en ${bizName} aparecen en el checkout (efectivo, transferencia, MercadoPago, tarjeta — según corresponda).` },
      { q: "¿Cuánto tarda mi pedido?", a: "El tiempo estimado depende del tipo de pedido. Te avisamos cuando entra a preparación y cuando sale." },
      { q: "¿Puedo cancelar un pedido?", a: "Sí, hasta que entre a preparación. Después contactanos por WhatsApp para coordinar." },
      { q: "¿Mis datos están seguros?", a: "Sí. Los datos personales no se ceden a terceros y se usan solo para procesar tu pedido." },
      { q: "¿Tengo que registrarme?", a: "No. Completás tus datos en el primer pedido y la próxima vez te reconocemos automáticamente." },
    ],

    worksWithUs: `${bizName} busca sumar gente al equipo. Si te interesa trabajar con nosotros, contactanos por WhatsApp o email y contanos tu experiencia.`,
  };
}

const HERMES_BUSINESS_COPY = `Hermes Gastro es la plataforma todo-en-uno para tu local gastronómico. Catálogo público, gestión de pedidos, stock, gastos, recetas, reportes USAR P&L y mucho más. Sin instalaciones, sin servidores, sin dolor de cabeza.

Escribinos por WhatsApp o email y agendamos una demo gratuita para tu negocio.`;

function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520,
          maxHeight: "85vh", overflowY: "auto",
          background: "var(--b2, #1A1A1A)", color: "var(--tx, #F4EAD0)",
          borderRadius: 18, padding: "22px 22px 18px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          border: "1px solid var(--line, rgba(255,255,255,0.08))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 400 }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            style={{
              width: 32, height: 32, borderRadius: 999,
              background: "transparent", border: "1px solid var(--line)",
              color: "var(--t2)", cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--t2, #B5A98E)", whiteSpace: "pre-line" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FaqList({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: "100%", padding: "12px 14px",
                background: "transparent", border: 0, color: "var(--tx)",
                fontFamily: "inherit", fontSize: 13, fontWeight: 700, textAlign: "left",
                cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span>{item.q}</span>
              <span style={{ color: "var(--ac, #F59E0B)", fontWeight: 800 }}>{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 14px 14px", fontSize: 12.5, color: "var(--t2)", lineHeight: 1.5 }}>
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CatalogFooter({ settings = {} }) {
  const [modal, setModal] = useState(null);
  const year = new Date().getFullYear();
  const open = (k) => setModal(k);
  const close = () => setModal(null);
  const copy = bizCopy(settings);

  const bizName = settings.biz_name || "Negocio";
  const bizWhatsapp = (settings.whatsapp || "").replace(/\D/g, "");
  const bizInstagram = settings.instagram || "";

  return (
    <>
      <footer
        style={{
          marginTop: 32,
          padding: "32px 22px 24px",
          background: "var(--bg, #fafaf7)",
          color: "var(--tx, #2D1B0E)",
          borderTop: "1px solid var(--line, rgba(0,0,0,0.06))",
        }}
      >
        {/* ─── BLOQUE DEL NEGOCIO ─── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 22, marginBottom: 28,
        }}>
          <FooterCol title="Legal" items={[
            { label: "Términos y condiciones", onClick: () => open("terms") },
            { label: "Política de cookies", onClick: () => open("cookies") },
            { label: "Libro de quejas", href: DEFENSA_CONSUMIDOR_AR, external: true },
          ]} />

          <FooterCol title="Ayuda" items={[
            { label: "Preguntas frecuentes", onClick: () => open("faq") },
          ]} />

          <FooterCol title={bizName} items={[
            { label: "Trabajá con nosotros", onClick: () => open("worksWithUs") },
          ]} />

          <FooterCol title="Contacto" items={[
            ...(bizWhatsapp ? [{ label: "WhatsApp", href: `https://wa.me/${bizWhatsapp}`, external: true }] : []),
            ...(bizInstagram ? [{ label: "Instagram", href: `https://instagram.com/${bizInstagram}`, external: true }] : []),
          ]} />
        </div>

        {/* Copyright del negocio */}
        <div style={{
          paddingTop: 14, paddingBottom: 22,
          borderTop: "1px solid var(--line)",
          fontSize: 10.5, color: "var(--t3)", letterSpacing: "0.04em",
          textAlign: "center",
        }}>
          © {year} {bizName}. Todos los derechos reservados.
        </div>

        {/* ─── BANDA HERMES (plataforma) ─── */}
        <div
          onClick={() => open("forBusiness")}
          style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 16px",
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.20)",
            borderRadius: 14,
            cursor: "pointer",
          }}
        >
          {/* Logo Hermes a la izquierda, fondo claro */}
          <div style={{ flexShrink: 0 }}>
            <HermesMark as="logo" size={56} fallback="H" theme="light" color="#000" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx, #2D1B0E)", lineHeight: 1.3 }}>
              ¿Tenés un negocio? Hermes Gastro para tu local
            </div>
            <div style={{ fontSize: 11, color: "var(--t2, #5B5552)", marginTop: 2, lineHeight: 1.35 }}>
              Catálogo, pedidos, stock, recetas y reportes. Tocá para conocer más.
            </div>
          </div>
          <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>→</div>
        </div>
      </footer>

      {/* ─── MODALES ─── */}
      {modal === "terms" && <Modal title="Términos y condiciones" onClose={close}>{copy.terms}</Modal>}
      {modal === "cookies" && <Modal title="Política de cookies" onClose={close}>{copy.cookies}</Modal>}
      {modal === "faq" && <Modal title="Preguntas frecuentes" onClose={close}><FaqList items={copy.faq} /></Modal>}
      {modal === "worksWithUs" && <Modal title="Trabajá con nosotros" onClose={close}>{copy.worksWithUs}</Modal>}
      {modal === "forBusiness" && (
        <Modal title="Hermes para tu negocio" onClose={close}>
          <div style={{ whiteSpace: "pre-line", marginBottom: 18 }}>{HERMES_BUSINESS_COPY}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a
              href={`https://wa.me/${HERMES.whatsapp}?text=${encodeURIComponent("Hola! Tengo un local gastronómico y me interesa Hermes Gastro.")}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                padding: "12px 16px", background: "#25D366", color: "#fff",
                borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 14,
                textAlign: "center", display: "block",
              }}
            >📱 Hablar por WhatsApp</a>
            <a
              href={`mailto:${HERMES.email}?subject=${encodeURIComponent("Hermes para mi negocio")}`}
              style={{
                padding: "12px 16px", background: "#F59E0B", color: "#000",
                borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 14,
                textAlign: "center", display: "block",
              }}
            >📧 Enviar email</a>
          </div>
        </Modal>
      )}
    </>
  );
}

function FooterCol({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
        textTransform: "uppercase", color: "#F59E0B", marginBottom: 10,
      }}>
        {title}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <li key={i}>
            {it.href ? (
              <a
                href={it.href}
                target={it.external ? "_blank" : undefined}
                rel={it.external ? "noopener noreferrer" : undefined}
                style={{ color: "var(--t2)", textDecoration: "none", fontSize: 12.5, display: "inline-block", lineHeight: 1.4 }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--tx)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--t2)"}
              >
                {it.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={it.onClick}
                style={{
                  background: "transparent", border: 0, padding: 0,
                  color: "var(--t2)", fontSize: 12.5, lineHeight: 1.4,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--tx)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--t2)"}
              >
                {it.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
