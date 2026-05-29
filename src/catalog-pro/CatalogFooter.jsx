// src/catalog-pro/CatalogFooter.jsx
// Footer corporativo del catálogo público.
//   - Logo Hermes destacado
//   - CTA "Hermes para tu negocio"
//   - Legales, FAQ, libro de quejas, trabaja con nosotros, cookies
//   - Contactos (WhatsApp, IG, email)
//   - Copyright al pie

import { useState } from "react";
import HermesMark from "../components/HermesMark";

const HERMES_INFO = {
  whatsapp: "5491100000000",        // TODO: número real
  email: "hola@hermesgastro.com",   // TODO: dominio real
  instagram: "hermesgastro",        // TODO: handle real
  defensaConsumidorAR: "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario",
};

const COPY = {
  terms: `Hermes Gastro es una plataforma SaaS que provee infraestructura de catálogo, pedidos y gestión a comercios gastronómicos. Cada negocio adherido es el responsable legal del producto/servicio que ofrece a través de su catálogo público. Hermes Gastro no es vendedor ni intermediario en las transacciones entre el consumidor y el negocio.

Al utilizar esta plataforma aceptás que los datos provistos (nombre, teléfono, dirección, email) se usen únicamente para procesar tu pedido y mantener contacto comercial con el negocio. No se ceden a terceros con fines publicitarios.

Para reclamos sobre un pedido contactá directamente al negocio. Para reclamos sobre la plataforma escribinos a ${HERMES_INFO.email}.

Última actualización: 2026`,

  cookies: `Usamos cookies y almacenamiento local del navegador para:
· Recordar tu carrito y datos de contacto entre visitas.
· Mantener tu sesión activa cuando volvés a la página.
· Estadísticas anónimas de uso para mejorar el servicio.

No usamos cookies de terceros para publicidad dirigida. No vendemos tu información.

Podés borrar las cookies desde la configuración de tu navegador en cualquier momento. Si las borrás, vamos a pedirte tus datos de nuevo en el próximo pedido.`,

  faq: [
    { q: "¿Cómo hago un pedido?", a: "Elegí los productos del catálogo, sumalos al carrito y completá tus datos en el checkout. Te llega un resumen por WhatsApp o email." },
    { q: "¿Cómo pago?", a: "Los métodos disponibles los define cada negocio (efectivo, transferencia, MercadoPago, tarjeta). Vas a verlos en el checkout." },
    { q: "¿Cuánto tarda mi pedido?", a: "El tiempo estimado lo define el negocio según el tipo de pedido. Te avisan cuando entra a preparación y cuando sale." },
    { q: "¿Puedo cancelar un pedido?", a: "Sí, hasta que entre a preparación. Después contactá directamente al negocio por WhatsApp." },
    { q: "¿Mis datos están seguros?", a: "Sí. Los datos personales no se ceden a terceros y se usan solo para procesar tu pedido y comunicarnos con vos." },
    { q: "¿Tengo que registrarme?", a: "No. La primera vez completás tus datos en el checkout y la próxima la página te reconoce automáticamente. Sin contraseñas." },
  ],

  worksWithUs: `Estamos creciendo y buscamos talento en desarrollo, diseño UX y atención a comercios. Si te apasiona la gastronomía y la tecnología, escribinos contando tu experiencia a ${HERMES_INFO.email} con asunto "Trabajo Hermes".`,

  forBusiness: `Hermes Gastro es la plataforma todo-en-uno para tu local. Catálogo público, gestión de pedidos, stock, gastos, recetas, USAR P&L, USAR Menu Engineering, integración con MercadoPago y mucho más. Sin instalaciones, sin servidores, sin dolor de cabeza.

Escribinos a ${HERMES_INFO.email} o por WhatsApp y agendamos una demo gratuita para tu negocio.`,
};

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
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 32, height: 32, borderRadius: 999,
              background: "var(--bg, transparent)", border: "1px solid var(--line)",
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

function FaqList() {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {COPY.faq.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
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

export default function CatalogFooter() {
  const [modal, setModal] = useState(null);
  const year = new Date().getFullYear();
  const open = (key) => setModal(key);
  const close = () => setModal(null);

  return (
    <>
      <footer
        style={{
          marginTop: 32,
          padding: "44px 22px 24px",
          background: "var(--b2, #1A1A1A)",
          color: "var(--tx, #F4EAD0)",
          borderTop: "1px solid var(--line, rgba(255,255,255,0.08))",
        }}
      >
        {/* ── Logo Hermes destacado ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingBottom: 28, borderBottom: "1px solid var(--line)",
          marginBottom: 24,
        }}>
          <div style={{
            padding: "18px 24px", borderRadius: 18,
            border: "1px solid rgba(245,158,11,0.18)",
            background: "rgba(245,158,11,0.04)",
          }}>
            <HermesMark as="logo" size={120} fallback="H" color="#F59E0B" />
          </div>
          <div style={{
            marginTop: 14, fontSize: 11.5, color: "var(--t3, #6E6755)",
            letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
          }}>
            Catálogo gestionado con Hermes Gastro
          </div>
        </div>

        {/* ── CTA: ¿Te interesa este sistema? ── */}
        <button
          type="button"
          onClick={() => open("forBusiness")}
          style={{
            display: "block", width: "100%", textAlign: "left",
            padding: "16px 18px", marginBottom: 28,
            background: "linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0.06) 100%)",
            border: "1px solid rgba(245,158,11,0.32)", borderRadius: 14,
            cursor: "pointer", fontFamily: "inherit", color: "var(--tx)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#F59E0B", marginBottom: 4 }}>
            ¿Tenés un local gastronómico?
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            Hermes Gastro para tu negocio
          </div>
          <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.4 }}>
            Catálogo, pedidos, stock, recetas y reportes. Todo en una plataforma. Tocá acá para conocer más.
          </div>
        </button>

        {/* ── Grilla de enlaces ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 22, marginBottom: 28,
        }}>
          <FooterCol title="Legal" items={[
            { label: "Términos y condiciones", onClick: () => open("terms") },
            { label: "Política de cookies", onClick: () => open("cookies") },
            { label: "Libro de quejas", href: HERMES_INFO.defensaConsumidorAR, external: true },
          ]} />

          <FooterCol title="Ayuda" items={[
            { label: "Preguntas frecuentes", onClick: () => open("faq") },
            { label: "Contactar al negocio", href: "#whatsapp-float" },
          ]} />

          <FooterCol title="Hermes" items={[
            { label: "Para tu negocio", onClick: () => open("forBusiness") },
            { label: "Trabajá con nosotros", onClick: () => open("worksWithUs") },
          ]} />

          <FooterCol title="Contacto" items={[
            { label: "WhatsApp", href: `https://wa.me/${HERMES_INFO.whatsapp}`, external: true },
            { label: "Instagram", href: `https://instagram.com/${HERMES_INFO.instagram}`, external: true },
            { label: HERMES_INFO.email, href: `mailto:${HERMES_INFO.email}`, external: true },
          ]} />
        </div>

        {/* ── Bottom band ── */}
        <div style={{
          paddingTop: 18, borderTop: "1px solid var(--line)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          fontSize: 10.5, color: "var(--t3)", letterSpacing: "0.04em",
        }}>
          <div>© {year} Hermes Gastro. Todos los derechos reservados.</div>
          <div style={{ fontStyle: "italic", opacity: 0.8 }}>Hecho en Argentina</div>
        </div>
      </footer>

      {/* ── Modales ── */}
      {modal === "terms" && (
        <Modal title="Términos y condiciones" onClose={close}>
          {COPY.terms}
        </Modal>
      )}
      {modal === "cookies" && (
        <Modal title="Política de cookies" onClose={close}>
          {COPY.cookies}
        </Modal>
      )}
      {modal === "faq" && (
        <Modal title="Preguntas frecuentes" onClose={close}>
          <FaqList />
        </Modal>
      )}
      {modal === "worksWithUs" && (
        <Modal title="Trabajá con nosotros" onClose={close}>
          {COPY.worksWithUs}
        </Modal>
      )}
      {modal === "forBusiness" && (
        <Modal title="Hermes para tu negocio" onClose={close}>
          <div style={{ whiteSpace: "pre-line", marginBottom: 18 }}>{COPY.forBusiness}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a
              href={`https://wa.me/${HERMES_INFO.whatsapp}?text=${encodeURIComponent("Hola! Tengo un local gastronómico y me interesa Hermes Gastro.")}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                padding: "12px 16px", background: "#25D366", color: "#fff",
                borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 14,
                textAlign: "center", display: "block",
              }}
            >📱 Hablar por WhatsApp</a>
            <a
              href={`mailto:${HERMES_INFO.email}?subject=${encodeURIComponent("Hermes para mi negocio")}`}
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
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
        textTransform: "uppercase", color: "var(--ac, #F59E0B)", marginBottom: 10,
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
                style={{
                  color: "var(--t2)", textDecoration: "none", fontSize: 12.5,
                  display: "inline-block", lineHeight: 1.4,
                }}
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
