// Logica pura de suscripcion-alta: sin red ni base, para poder probarla con
// vitest (src/test/suscripcionMp.test.js).

export const DIAS_DE_PRUEBA = 14;
const MS_DIA = 86400000;

export type Plan = {
  id: string;
  nombre: string;
  precio_mensual: number | string | null;
  precio_anual_por_mes: number | string | null;
  disponible: boolean;
};

export type Ciclo = "mensual" | "anual";

/**
 * Lo que eligio en el registro, leido del user_metadata (no del body: el
 * browser no decide que plan se le cobra). Paris no tiene anual.
 */
export function eleccionDelAlta(meta: Record<string, unknown> | null | undefined):
  { planId: string; ciclo: Ciclo } | null {
  const planId = String(meta?.requested_plan ?? "");
  if (!["digital", "local", "cadena"].includes(planId)) return null;
  const ciclo: Ciclo = planId !== "digital" && meta?.requested_billing_period === "anual"
    ? "anual" : "mensual";
  return { planId, ciclo };
}

/**
 * Lo que se debita por ciclo y cada cuanto. El anual se cobra por adelantado:
 * 12 x precio_anual_por_mes, una vez cada 12 meses (decision del 6/nov).
 */
export function cobroDelCiclo(plan: Plan | null | undefined, ciclo: Ciclo):
  { monto: number; frecuencia: number } | null {
  if (!plan || !plan.disponible) return null;
  if (ciclo === "anual") {
    const porMes = Number(plan.precio_anual_por_mes);
    if (!(porMes > 0)) return null;
    return { monto: Math.round(porMes * 12 * 100) / 100, frecuencia: 12 };
  }
  const mensual = Number(plan.precio_mensual);
  if (!(mensual > 0)) return null;
  return { monto: mensual, frecuencia: 1 };
}

/**
 * Cuando sale el primer debito.
 *  - Alta nueva: al terminar los 14 dias de prueba.
 *  - Negocio que ya existe con la prueba vigente: el dia que termina.
 *  - Negocio que ya existe sin prueba: enseguida (MP lo cobra dentro de la hora).
 */
export function primerDebito(
  ahora: Date,
  negocio: { prueba_hasta?: string | null } | null,
): Date {
  if (!negocio) return new Date(ahora.getTime() + DIAS_DE_PRUEBA * MS_DIA);
  const fin = negocio.prueba_hasta ? new Date(negocio.prueba_hasta) : null;
  if (fin && !Number.isNaN(fin.getTime()) && fin.getTime() > ahora.getTime()) return fin;
  return new Date(ahora.getTime() + 5 * 60 * 1000);
}

/** Lo que se muestra de la tarjeta. Cualquier otra cosa se descarta. */
export function datosVisiblesDeTarjeta(b: Record<string, unknown> | null | undefined) {
  const ultimos4 = String(b?.ultimos4 ?? "");
  const marca = String(b?.marca ?? "").trim().slice(0, 30);
  return {
    tarjeta_ultimos4: /^[0-9]{4}$/.test(ultimos4) ? ultimos4 : null,
    tarjeta_marca: /^[a-z0-9 _-]+$/i.test(marca) ? marca : null,
  };
}

/** El body del POST /preapproval (suscripcion sin plan, pago autorizado). */
export function armarPreapproval(p: {
  planNombre: string;
  ciclo: Ciclo;
  monto: number;
  frecuencia: number;
  inicio: Date;
  email: string;
  userId: string;
  cardTokenId: string;
  notificationUrl: string;
  backUrl: string;
}) {
  return {
    reason: `Dico ${p.planNombre} (${p.ciclo})`,
    external_reference: p.userId,
    payer_email: p.email,
    card_token_id: p.cardTokenId,
    status: "authorized",
    back_url: p.backUrl,
    notification_url: p.notificationUrl,
    auto_recurring: {
      frequency: p.frecuencia,
      frequency_type: "months",
      start_date: p.inicio.toISOString(),
      transaction_amount: p.monto,
      currency_id: "ARS",
    },
  };
}
