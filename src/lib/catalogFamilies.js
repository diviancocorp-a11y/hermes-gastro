// Familias del catalogo: presentacion que junta varios productos (sabores) en
// UNA tarjeta. Cada sabor sigue siendo su propio producto (receta, stock,
// costo); la familia solo agrupa. Datos en products.catalog_attributes:
//   family       nombre de la familia ("Empanadas")
//   family_pack  unidades por docena/pack ("12"), opcional
// Logica pura, sin React.

const CONECTORES = /^(de la|de los|de las|del|de|con|y)\s+/i;

function familyOf(product) {
  const attrs = product && product.catalog_attributes;
  const value = attrs && typeof attrs.family === 'string' ? attrs.family.trim() : '';
  return value;
}

function packOf(members) {
  for (const m of members) {
    const raw = m.catalog_attributes && m.catalog_attributes.family_pack;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 2) return n;
  }
  return null;
}

function esMiembro(product) {
  if (!product || familyOf(product) === '') return false;
  if (product.active === false || product.is_active === false) return false;
  // El +18 pide confirmacion por producto: no se mezcla en una tarjeta grupal.
  if (product.requires_age_gate) return false;
  return true;
}

/**
 * Agrupa productos en entradas de lista, conservando el orden.
 * Devuelve [{ type: 'product', product } | { type: 'family', family }].
 * La familia ocupa la posicion de su primer miembro. Con 1 solo miembro, o con
 * `opts.group === false` (busqueda activa), todo queda como producto normal.
 * opts.priceOf(p): precio vigente de un producto (default sale_price).
 * opts.soldOut(p): true si el producto esta agotado. minPrice ignora los
 * agotados, salvo que lo esten todos (entonces allSoldOut = true).
 */
export function groupCatalogItems(products, opts = {}) {
  const list = Array.isArray(products) ? products : [];
  if (opts.group === false) return list.map(product => ({ type: 'product', product }));
  const priceOf = opts.priceOf || (p => Number(p.sale_price) || 0);
  const soldOut = opts.soldOut || (() => false);

  const porFamilia = new Map();
  for (const p of list) {
    if (!esMiembro(p)) continue;
    const key = familyOf(p).toLocaleLowerCase('es');
    if (!porFamilia.has(key)) porFamilia.set(key, []);
    porFamilia.get(key).push(p);
  }

  const out = [];
  const emitidas = new Set();
  for (const p of list) {
    if (!esMiembro(p)) { out.push({ type: 'product', product: p }); continue; }
    const key = familyOf(p).toLocaleLowerCase('es');
    const members = porFamilia.get(key);
    if (members.length < 2) { out.push({ type: 'product', product: p }); continue; }
    if (emitidas.has(key)) continue;
    emitidas.add(key);
    const disponibles = members.filter(m => !soldOut(m));
    const allSoldOut = disponibles.length === 0;
    const prices = (allSoldOut ? members : disponibles).map(priceOf);
    const conFoto = members.find(m => m.image_url);
    out.push({
      type: 'family',
      family: {
        key,
        name: familyOf(members[0]),
        members,
        pack: packOf(members),
        minPrice: Math.min(...prices),
        image: conFoto ? conFoto.image_url : null,
        allSoldOut,
      },
    });
  }
  return out;
}

/**
 * Nombre corto de cada miembro quitando el prefijo comun por palabras
 * ("Empanada de Carne" -> "Carne"). Si no hay prefijo comun, o dejaria algun
 * nombre vacio, devuelve los nombres completos. Devuelve un array paralelo.
 */
export function shortNames(members) {
  const nombres = members.map(m => String(m.name || '').trim());
  const full = nombres;
  if (nombres.length < 2) return full;
  const palabras = nombres.map(n => n.split(/\s+/));
  let comun = 0;
  const min = Math.min(...palabras.map(w => w.length));
  while (comun < min && palabras.every(w => w[comun].toLocaleLowerCase('es') === palabras[0][comun].toLocaleLowerCase('es'))) {
    comun += 1;
  }
  if (comun === 0) return full;
  const cortos = palabras.map(w => {
    const resto = w.slice(comun).join(' ').replace(CONECTORES, '').trim();
    return resto ? resto.charAt(0).toLocaleUpperCase('es') + resto.slice(1) : '';
  });
  if (cortos.some(c => c === '')) return full;
  return cortos;
}

/** Palabra para el pack: 12 es "docena", el resto "pack". */
export function packWord(pack) {
  return pack === 12 ? 'docena' : 'pack';
}

/**
 * Textos con genero correcto: docena es femenino, pack masculino.
 * { noun, the: 'la docena'|'el pack', one: 'una docena'|'un pack',
 *   half: 'media docena'|'medio pack', halfEven }
 * halfEven: la mitad es exacta (pack par); si no, no se ofrece el atajo.
 */
export function packTexts(pack) {
  const docena = pack === 12;
  return {
    noun: docena ? 'docena' : 'pack',
    the: docena ? 'la docena' : 'el pack',
    one: docena ? 'una docena' : 'un pack',
    half: docena ? 'media docena' : 'medio pack',
    halfEven: !!pack && pack % 2 === 0,
  };
}

/**
 * Resumen de unidades vs pack. Sin pack: solo el contador.
 * { total, docenas, resto, faltan, label }
 */
export function packSummary(total, pack) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  if (!pack || pack < 2) return { total: n, docenas: 0, resto: 0, faltan: 0, label: '' };
  const docenas = Math.floor(n / pack);
  const resto = n % pack;
  const palabra = packWord(pack);
  const { the } = packTexts(pack);
  if (docenas >= 1) {
    const plural = docenas === 1 ? palabra : (palabra === 'docena' ? 'docenas' : 'packs');
    return {
      total: n, docenas, resto, faltan: 0,
      label: resto > 0 ? `${docenas} ${plural} + ${resto}` : `${docenas} ${plural}`,
    };
  }
  const faltan = pack - n;
  return { total: n, docenas: 0, resto: n, faltan, label: `Te faltan ${faltan} para ${the}` };
}

/** Total en pesos: suma real unidad por unidad, sin descuentos. */
export function familyTotal(members, quantities, priceOf = p => Number(p.sale_price) || 0) {
  let units = 0;
  let amount = 0;
  for (const m of members) {
    const q = Math.max(0, Math.floor(Number(quantities && quantities[m.id]) || 0));
    units += q;
    amount += q * (Number(priceOf(m)) || 0);
  }
  return { units, amount };
}
