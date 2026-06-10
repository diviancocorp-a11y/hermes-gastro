// Catálogo Pro — helpers para mapear datos reales → shape que espera la Home.
// Los campos que no existen en la DB (rating, prepMin, tone, badge) se generan
// con heurísticas ESTABLES por id (mismo producto → mismo valor siempre).

import { DEAL_PCT } from "../constants/catalogConstants";
import { fmtAR } from "../lib/format";

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

// Rating fake estable: 4.3 – 4.9
export function ratingFor(id) {
  return 4.3 + (hashStr(id) % 7) / 10;
}

// Reviews fake estable: 12 – 211
export function reviewsFor(id) {
  return 12 + (hashStr(id) % 200);
}

// Prep time fake estable: 12 – 35 min (o usa settings.prep_time_min si viene)
export function prepFor(id, fallback) {
  if (fallback) return fallback;
  return 12 + (hashStr(id) % 24);
}

/**
 * Mapea un producto real (DB) al shape que usan los componentes catalog-pro.
 * @param p producto real {id, name, sale_price, description, image_url, category, related_ids}
 * @param opts { hasDeal, dealPrice, prepDefault, soldOutIds }
 *   soldOutIds: Set de recipe_ids agotados (ver lib/stockAvailability.js)
 */
export function mapProduct(p, opts = {}) {
  const { hasDeal, dealPrice, prepDefault, soldOutIds } = opts;
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
    rating: ratingFor(p.id),
    reviews: reviewsFor(p.id),
    prepMin: prepFor(p.id, prepDefault),
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
    "Bien valorado últimamente",
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
