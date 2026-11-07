// Catálogo Pro — helpers para mapear datos reales → shape que espera la Home.
// Los campos visuales que no existen en la DB (tone, badge) se generan con
// heuristicas ESTABLES por id (mismo producto -> mismo valor siempre).
// Nunca se inventan datos que el cliente lee como hechos: no hay estrellas ni
// cantidad de opiniones porque el sistema no guarda resenas de productos
// (service_reviews es la nota del servicio de un pedido, no de un producto).

import { DEAL_PCT } from "../constants/catalogConstants";
import { fmtAR } from "../lib/format";
import { formatearDuracion } from "./reservarHelpers.js";

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Paleta de tones cálidos para fallback de imágenes
const TONES = ["#C9744D", "#A85432", "#B5683C", "#8A4A30", "#C58A5E", "#9C5A3C", "#D08552"];

export function toneFor(name) {
  return TONES[hashStr(name) % TONES.length];
}

// Tiempo que muestra la tarjeta: solo un servicio, que dice cuanto dura el
// turno (products.duration_min). Gastronomia y comercio no muestran tiempo:
// el "30 min" de preparacion era el mismo en todos los productos y no le
// decia nada al cliente. Un servicio sin duracion (un agregado) tampoco.
export function tiempoFor(p) {
  if (p?.type !== "service") return null;
  const min = Number(p.duration_min);
  return min > 0 ? formatearDuracion(min) : null;
}

/**
 * Mapea un producto real (DB) al shape que usan los componentes catalog-pro.
 * @param p producto real {id, name, sale_price, description, image_url, category, related_ids}
 * @param opts { hasDeal, dealPrice, soldOutIds }
 *   soldOutIds: Set de recipe_ids agotados (ver lib/stockAvailability.js)
 */
export function mapProduct(p, opts = {}) {
  const { hasDeal, dealPrice, soldOutIds } = opts;
  const deal = hasDeal ? hasDeal(p) : false;
  const price = deal && dealPrice ? dealPrice(p) : p.sale_price;
  const oldPrice = deal ? p.sale_price : null;

  // Deal metadata centralizada: cuando existan tipos de oferta por producto
  // (2x1, combo, exclusivo, etc) se lee de p.deal_* y se ramifica acá — las
  // pantallas no cambian.
  const savings = oldPrice ? oldPrice - price : 0;
  return {
    id: p.id,
    name: p.name,
    desc: p.description || "",
    price,
    oldPrice,
    img: p.image_url || null,
    cat: p.category,
    tone: toneFor(p.name || p.id),
    tiempo: tiempoFor(p),
    badge: deal ? "Oferta" : null,
    // Sin stock de ingredientes suficiente para 1 unidad
    soldOut: !!(soldOutIds && soldOutIds.has(p.id)),
    // Deal chip (centralizado)
    deal,
    dealLabel:   deal ? `-${DEAL_PCT}%` : null,
    dealTone:    deal ? "promo" : null,
    dealIcon:    deal ? "🔥" : null,
    dealShort:   deal ? "Oferta" : null,
    dealLong:    deal ? `Oferta del día · ahorrá ${fmtAR(savings)}` : null,
    dealSavings: deal ? savings : 0,
    _raw: p,
  };
}

/**
 * Genera "stories" heurísticas: primero productos con deal, después con imagen.
 * Máx 6.
 */
export function buildStories(products, hasDeal) {
  const withImg = products.filter(p => p.image_url);
  const deals = withImg.filter(p => hasDeal?.(p));
  const rest = withImg.filter(p => !hasDeal?.(p));
  const ordered = [...deals, ...rest].slice(0, 6);
  return ordered.map((p, i) => ({
    id: p.id,
    img: p.image_url,
    label: p.name,
    tag: hasDeal?.(p) ? "Oferta" : i < 2 ? "Top" : "Nuevo",
    _raw: p,
  }));
}

/**
 * AI recos heurísticas: 3 productos con razón explicada.
 * Usa productos con más relacionados o random estable.
 */
export function buildRecos(products, hasDeal) {
  const reasons = [
    "Pedido seguido por clientes como vos",
    "Combina con lo que sueles pedir",
    "Nuevo esta semana",
  ];
  const pool = products.filter(p => p.image_url);
  const picked = [...pool]
    .sort((a, b) => hashStr(b.id) - hashStr(a.id))   // orden estable pseudo-random
    .slice(0, 3);
  return picked.map((p, i) => ({
    ...mapProduct(p, { hasDeal }),
    reason: reasons[i % reasons.length],
  }));
}
