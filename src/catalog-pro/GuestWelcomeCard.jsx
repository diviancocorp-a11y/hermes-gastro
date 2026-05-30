// src/catalog-pro/GuestWelcomeCard.jsx
// Vista de bienvenida para visitantes guest en /mi-cuenta.
//
// Se muestra cuando:
//   - El visitante NO está logueado con Supabase Auth
//   - PERO tiene identidad guest (al menos 1 pedido previo)
//
// Muestra:
//   - Saludo con su nombre
//   - Sus puntos semanales (si tiene)
//   - CTA para "verificar identidad" → upgrade a magic link
//
// Si no hay guest, este componente NO renderiza nada (return null).

import { useGuestUser } from "../lib/guestUser.js";
import { useMyRanking } from "./useTopCustomers";

export default function GuestWelcomeCard({ onLoginClick }) {
  const guest = useGuestUser();
  const { ranking } = useMyRanking({
    email: guest?.email,
    phone: guest?.phone,
  });

  if (!guest) return null;

  const firstName = guest.name ? guest.name.trim().split(/\s+/)[0] : "";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 360,
        margin: "0 auto 24px",
        padding: "20px 22px",
        background: "var(--b2, #FBF7F2)",
        border: "1px solid var(--line, rgba(0,0,0,0.08))",
        borderRadius: 18,
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
              fontSize: 18,
              color: "var(--tx, #2D1B0E)",
              lineHeight: 1.2,
            }}
          >
            {firstName ? `Hola ${firstName} 👋` : "¡Hola!"}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12.5,
              color: "var(--t2, #B5A98E)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {guest.phone || guest.email || "Visitante"}
          </div>
        </div>

        {ranking && ranking.my_points > 0 && (
          <div
            style={{
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--ac, #C45D3E)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {ranking.my_points}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--t2, #B5A98E)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginTop: 2,
              }}
            >
              {ranking.my_points === 1 ? "punto" : "puntos"}
            </div>
          </div>
        )}
      </div>

      {ranking && ranking.my_position && (
        <div
          style={{
            padding: "10px 12px",
            background: "var(--bg, #fff)",
            border: "1px solid var(--line, rgba(0,0,0,0.08))",
            borderRadius: 12,
            fontSize: 12.5,
            color: "var(--t2, #B5A98E)",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          📍 Estás en el puesto <strong style={{ color: "var(--tx, #2D1B0E)" }}>#{ranking.my_position}</strong> esta semana
          {ranking.my_position <= 5 ? " — 🎉 estás en el podio." : ""}
        </div>
      )}

      <div
        style={{
          fontSize: 12.5,
          color: "var(--t2, #B5A98E)",
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        Para ver tu historial de pedidos, guardar direcciones y acceder a tus datos, verificá tu identidad con tu email.
      </div>

      <button
        onClick={onLoginClick}
        type="button"
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "var(--ac, #C45D3E)",
          color: "#fff",
          border: 0,
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Verificar mi identidad
      </button>
    </div>
  );
}
