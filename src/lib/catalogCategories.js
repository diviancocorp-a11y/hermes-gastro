import { getCatalogCategories, matchesCatalogCategory as matchesFacetCategory, resolveCatalogProfile } from './catalogFacets';

const categoryName = value => typeof value === 'string' ? value.trim() : '';

// Los grupos del tenant reemplazan al build; [] deja solo las categorias
// de sus productos. Las categorias sin grupo siguen siendo accesibles.
export function buildCatalogGroups(configured, fallback = [], products = []) {
  const source = Array.isArray(configured) ? configured : fallback;
  const groups = [];
  const names = new Set();
  for (const group of source) {
    const name = categoryName(group?.name);
    if (!name || name === 'Todos' || names.has(name)) continue;
    const rawSubs = Array.isArray(group.subs) ? group.subs : group.subcategories;
    const subs = Array.isArray(rawSubs)
      ? [...new Set(rawSubs.map(categoryName).filter(Boolean))]
      : [];
    groups.push({ name, icon: group.icon, subs });
    names.add(name);
  }
  const covered = new Set(groups.flatMap(group => [group.name, ...group.subs]));
  for (const product of products) {
    const name = categoryName(product.category);
    if (!name || name === 'Todos' || covered.has(name)) continue;
    groups.push({ name, subs: [] });
    covered.add(name);
  }
  return groups;
}

export function matchesCatalogCategory(product, group) {
  if (!group) return false;
  return matchesFacetCategory(product, group.name, [group]);
}

// Solo presentación/navegación: las asociaciones de ofertas siguen usando
// buildCatalogDealParents sobre la configuración original, sin transformarla.
export function buildCatalogDisplayGroups(configured, fallback = [], products = [], settings = {}) {
  const legacy = buildCatalogGroups(configured, fallback, products);
  return getCatalogCategories(products, legacy, resolveCatalogProfile(settings))
    .filter(group => group.name !== 'Todos');
}

// Misma precedencia que submit-order: solo subs, gana el ultimo grupo.
// Para precios se conserva el dato original; normalizarlo solo en el front
// podria mostrar un descuento que el servidor no aplica.
export function buildCatalogDealParents(groups = []) {
  return Object.fromEntries(groups.flatMap(group =>
    (Array.isArray(group?.subs) ? group.subs : []).map(name => [name, group.name]),
  ));
}
