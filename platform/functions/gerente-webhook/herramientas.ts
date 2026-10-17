// Lo que GerenteDico puede consultar, y la logica pura que lo resume.
//
// Todo es de SOLO LECTURA: ninguna herramienta escribe en la base. Se le pasan
// a OpenAI como `tools` (function calling); el modelo elige cual llamar y con
// que argumentos, y index.ts las ejecuta con la service role.
//
// Lo que sale de aca no lleva datos personales de los clientes de cada negocio
// (nombre, telefono, direccion): solo conteos, montos y estados.

export const HERRAMIENTAS = [
  {
    type: "function",
    function: {
      name: "negocios",
      description: "Lista los negocios (tenants) de Dico con su estado, plan, productos activos y "
        + "pedidos y facturacion de los ultimos 7 dias. Usala para saber que slugs existen.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "pedidos",
      description: "Resumen de los pedidos de UN negocio en los ultimos N dias: cantidad, total "
        + "facturado (sin cancelados), por estado, por canal y fecha del ultimo pedido.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "slug del negocio, por ejemplo crazy-miga" },
          dias: { type: "integer", description: "cuantos dias hacia atras, de 1 a 31 (default 7)" },
        },
        required: ["slug"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "productos",
      description: "Productos de UN negocio: nombre, categoria, precio, stock y si estan activos.",
      parameters: {
        type: "object",
        properties: { slug: { type: "string", description: "slug del negocio" } },
        required: ["slug"],
        additionalProperties: false,
      },
    },
  },
] as const;

export const PROMPT_SISTEMA = [
  "Sos GerenteDico, el gerente de Dico: una plataforma de catalogos y pedidos para negocios.",
  "Cada negocio vive en <slug>.divianco.app. Le contestas a Ricky, el dueno de Divianco, por Telegram.",
  "Espanol argentino, breve y directo, sin Markdown (Telegram lo muestra crudo).",
  "Solo afirmas lo que sale de las herramientas. Si para responder necesitas un dato que ninguna",
  "herramienta da, decilo y no lo inventes. No podes cambiar nada: solo consultar.",
  "Montos en pesos argentinos, con separador de miles (ej: $ 59.000).",
].join(" ");

const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function slugValido(s: unknown): string | null {
  const v = String(s ?? "").trim().toLowerCase();
  return SLUG.test(v) ? v : null;
}

/** 1..31, default 7. */
export function diasValidos(d: unknown): number {
  const n = Math.trunc(Number(d));
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(n, 31);
}

type Pedido = { status: string | null; channel: string | null; total: number | string | null; created_at: string };

export function resumirPedidos(filas: Pedido[], dias: number) {
  const porEstado: Record<string, number> = {};
  const porCanal: Record<string, number> = {};
  let facturado = 0;
  let ultimo: string | null = null;
  for (const p of filas) {
    const estado = p.status || "sin_estado";
    porEstado[estado] = (porEstado[estado] || 0) + 1;
    const canal = p.channel || "sin_canal";
    porCanal[canal] = (porCanal[canal] || 0) + 1;
    if (estado !== "cancelled") facturado += Number(p.total) || 0;
    if (!ultimo || p.created_at > ultimo) ultimo = p.created_at;
  }
  return {
    dias,
    pedidos: filas.length,
    facturado_sin_cancelados: Math.round(facturado),
    por_estado: porEstado,
    por_canal: porCanal,
    ultimo_pedido: ultimo,
  };
}

/** Telegram corta en 4096 caracteres. */
export function cortar(texto: string, max = 4000): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`;
}
