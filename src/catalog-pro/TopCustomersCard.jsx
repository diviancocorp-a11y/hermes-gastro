// src/catalog-pro/TopCustomersCard.jsx
// Card de "Top de la semana" en el catálogo público.
//
// Visible para todos. El "Vos sos #N" sólo aparece si el user está logueado.
// Sistema de puntos: 1 pt = $10.000 gastados (semana lunes-domingo).
//
// Props: opcional `user = { email, phone }` para mostrar ranking personal.

import { useAuth } from "../contexts/AuthContext";
import { useGuestUser } from "../lib/guestUser.js";
import { useWeeklyTop, useMyRanking } from "./useTopCustomers";
import { SectionHeader } from "./atoms";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TopCustomersCard() {
  const { user, profile } = useAuth();
  const guest = useGuestUser();
  const { top, loading: topLoading } = useWeeklyTop();

  // Identidad: priorizamos auth user (más fresh) y caemos a guest del primer pedido.
  // El usuario NO necesita estar logueado en Supabase para participar en el ranking.
  const myEmail = user?.email || guest?.email || "";
  const myPhone = profile?.phone || guest?.phone || "";
  const isIdentified = !!(myEmail || myPhone);

  const { ranking } = useMyRanking({ email: myEmail, phone: myPhone });

  // Si no hay data y terminó de cargar, no renderizamos (fallback vacío)
  if (!topLoading && top.length === 0) return null;

  return (
    <div style={{ padding: "8px 0 24px" }}>
      <SectionHeader title="Top de" em="la semana" />
      <p
        style={{
          padding: "0 22px",
          margin: "0 0 14px",
          fontSize: 12.5,
          color: "var(--t2, #B5A98E)",
          lineHeight: 1.4,
        }}
      >
        Los lunes premiamos al podio. Cada $10.000 = 1 punto.
      </p>

      <div
        style={{
          margin: "0 22px",
          padding: "16px 18px",
          background: "var(--b2, rgba(196,93,62,0.06))",
          border: "1px solid var(--line, rgba(0,0,0,0.08))",
          borderRadius: 16,
        }}
      >
        {topLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top.map(row => (
              <RankRow key={row.position} row={row} />
            ))}
          </div>
        )}

        {/* Footer: tu posición (si tiene ranking esta semana) */}
        {isIdentified && ranking && <MyRankingFooter ranking={ranking} />}

        {/* Footer: identificado pero sin actividad esta semana */}
        {isIdentified && !ranking && !topLoading && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--line, rgba(0,0,0,0.08))",
              fontSize: 12,
              color: "var(--t3, #9C8B7A)",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            Aún no sumaste puntos esta semana. Tu próximo pedido te pone en el ranking.
          </div>
        )}

        {/* Footer: CTA para visitantes nuevos (sin identidad guest ni auth) */}
        {!isIdentified && !topLoading && top.length > 0 && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--line, rgba(0,0,0,0.08))",
              fontSize: 12,
              color: "var(--t3, #9C8B7A)",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            ¿Querés aparecer acá? Hacé tu primer pedido y empezás a sumar puntos.
          </div>
        )}
      </div>
    </div>
  );
}

function RankRow({ row }) {
  const isPodium = row.position <= 3;
  const medal = isPodium ? MEDALS[row.position - 1] : `${row.position}.`;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "30px 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "6px 0",
        ...(isPodium && {
          fontWeight: 600,
        }),
      }}
    >
      <span
        style={{
          fontSize: isPodium ? 20 : 14,
          color: isPodium ? "var(--tx, #2D1B0E)" : "var(--t3, #9C8B7A)",
          textAlign: "center",
        }}
      >
        {medal}
      </span>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 15,
          color: "var(--tx, #2D1B0E)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.display_name}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ac, #C45D3E)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {row.points} {row.points === 1 ? "pt" : "pts"}
      </span>
    </div>
  );
}

function MyRankingFooter({ ranking }) {
  const { my_position, my_points, points_to_top5 } = ranking;
  const inTop5 = my_position <= 5;

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid var(--line, rgba(0,0,0,0.08))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--t2, #B5A98E)" }}>
          📍 Vos sos #{my_position}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ac, #C45D3E)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {my_points} {my_points === 1 ? "pt" : "pts"}
        </span>
      </div>
      {!inTop5 && points_to_top5 > 0 && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--t3, #9C8B7A)",
            lineHeight: 1.4,
          }}
        >
          Te {points_to_top5 === 1 ? "falta" : "faltan"} {points_to_top5}{" "}
          {points_to_top5 === 1 ? "punto" : "puntos"} para entrar al top 5
        </div>
      )}
      {inTop5 && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--sales, #2A9D6E)",
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          🎉 Estás en el podio. Premios el lunes
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "30px 1fr auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div style={{ width: 24, height: 24, borderRadius: 12, background: "var(--line, rgba(0,0,0,0.06))" }} />
      <div style={{ height: 14, background: "var(--line, rgba(0,0,0,0.06))", borderRadius: 4 }} />
      <div style={{ width: 50, height: 14, background: "var(--line, rgba(0,0,0,0.06))", borderRadius: 4 }} />
    </div>
  );
}
