import { resolveCatalogProfile } from '../modules/catalogProfiles';

export { resolveCatalogProfile };
export const FEATURE_LABELS = { vegetarian: 'Vegetariano', vegan: 'Vegano', gluten_free: 'Sin TACC' };
const clean = value => typeof value === 'string' ? value.trim() : '';
const facetKeys = ['brand', 'line', 'varietal', 'presentation'];
export const BOX_PRESENTATION = '__boxes__';

export function getProductFeatures(product = {}) {
  const explicit = Array.isArray(product.catalog_attributes?.features);
  const declared = explicit ? product.catalog_attributes.features : [];
  return Object.keys(FEATURE_LABELS).filter(key => declared.includes(key) || (!explicit && key === 'vegetarian' && product.is_vegetarian === true));
}

export function getProductCategory(product = {}) {
  return clean(product.catalog_attributes?.category) || clean(product.category);
}

export function isBoxPresentation(product) {
  return /^caja\b/i.test(clean(product.catalog_attributes?.presentation));
}

export function matchesCatalogCategory(product, category, categories = []) {
  if (!category || category === 'Todos') return true;
  const explicit = clean(product.catalog_attributes?.category);
  if (explicit) return explicit === category;
  const legacy = clean(product.category);
  const group = categories.find(item => item.name === category);
  return legacy === category || (group?.subs || []).some(sub => clean(sub) === legacy);
}

export function getCatalogCategories(products, categories, profile) {
  if (!products.some(product => clean(product.catalog_attributes?.category))) return categories;
  const names = [...new Set(products.map(getProductCategory).filter(Boolean))];
  // Catalog ya resolvió visibilidad, nombres e imágenes: no recuperar aquí
  // categorías ocultas ni descartar su presentación al consumirlas en Home.
  if (categories.length && categories.every(item => item.name === 'Todos' || names.includes(item.name))) {
    return categories.some(item => item.name === 'Todos') ? categories : [{ name: 'Todos', displayName: 'Todos', subs: [] }, ...categories];
  }
  const declaredCategories = names.map(name => ({ name, displayName: name, subs: [] }));
  // Cuando se clasifica por atributos, las bodegas y presentaciones nunca son categorías.
  if (profile.id === 'beverages') return [{ name: 'Todos', displayName: 'Todos', subs: [] }, ...declaredCategories];
  const merged = categories.filter(item => item.name !== 'Todos' && !names.includes(item.name));
  return [{ name: 'Todos', displayName: 'Todos', subs: [] }, ...declaredCategories, ...merged];
}

export function applyCatalogFacets(products, context = {}) {
  const { category = 'Todos', categories = [], facets = {}, search = '', quickFilter, hasDeal } = context;
  const query = clean(search).toLocaleLowerCase('es');
  let filtered = products.filter(product => {
    if (!matchesCatalogCategory(product, category, categories)) return false;
    if (query && !`${product.name || ''} ${product.description || ''}`.toLocaleLowerCase('es').includes(query)) return false;
    for (const key of facetKeys) {
      if (!facets[key]) continue;
      if (key === 'presentation' && facets[key] === BOX_PRESENTATION) {
        if (!isBoxPresentation(product)) return false;
      } else if (clean(product.catalog_attributes?.[key]) !== facets[key]) return false;
    }
    if ((facets.features || []).some(feature => !getProductFeatures(product).includes(feature))) return false;
    if (quickFilter === 'deal' && !hasDeal?.(product)) return false;
    if (quickFilter === 'veg' && !getProductFeatures(product).some(feature => feature === 'vegetarian' || feature === 'vegan')) return false;
    if (quickFilter === 'new' && !(product.created_at && new Date(product.created_at).getTime() > Date.now() - 30 * 86400000)) return false;
    return true;
  });
  if (quickFilter === 'top') filtered = [...filtered].sort((a, b) => (b.sale_count || 0) - (a.sale_count || 0));
  return filtered;
}

export function getFacetOptions(products, context = {}) {
  const { profile = resolveCatalogProfile(), facets = {} } = context;
  return Object.fromEntries(profile.facets.map(({ key }) => {
    const pool = applyCatalogFacets(products, { ...context, facets: { ...facets, [key]: '' } });
    const values = [...new Set(pool.map(product => clean(product.catalog_attributes?.[key])).filter(Boolean))];
    return [key, values.sort((a, b) => a.localeCompare(b, 'es'))];
  }));
}

// Preserva la última decisión del usuario y descarta solo combinaciones imposibles.
export function normalizeCatalogFacets(products, context = {}, keepKey) {
  const current = context.facets || {};
  const next = {};
  const keys = [...new Set([keepKey, ...facetKeys, 'features'].filter(Boolean))];
  for (const key of keys) {
    const value = current[key];
    if (!value || (Array.isArray(value) && !value.length)) continue;
    if (key === 'features') {
      for (const feature of value) {
        const candidate = { ...next, features: [...(next.features || []), feature] };
        if (applyCatalogFacets(products, { ...context, facets: candidate }).length) next.features = candidate.features;
      }
    } else if (applyCatalogFacets(products, { ...context, facets: { ...next, [key]: value } }).length) next[key] = value;
  }
  return next;
}
