// Perfiles del catálogo: clasificación por rubro, independiente de cada negocio.
const commercialFilters = [
  { id: 'deal', name: 'En oferta' },
  { id: 'new', name: 'Nuevos' },
  { id: 'top', name: 'Más pedidos' },
];

export const CATALOG_PROFILES = {
  gastro: {
    id: 'gastro', label: 'Gastronomía', facets: [],
    features: ['vegetarian', 'vegan', 'gluten_free'],
    quickFilters: [commercialFilters[0], { id: 'veg', name: 'Vegetariano' }, ...commercialFilters.slice(1)],
  },
  beverages: {
    id: 'beverages', label: 'Bebidas y licorería',
    facets: [
      { key: 'brand', label: 'Bodega o marca' },
      { key: 'line', label: 'Línea' },
      { key: 'varietal', label: 'Cepa' },
      { key: 'presentation', label: 'Presentación' },
    ],
    features: ['vegan', 'gluten_free'], quickFilters: commercialFilters,
  },
  retail: {
    id: 'retail', label: 'Comercio',
    facets: [{ key: 'brand', label: 'Marca' }, { key: 'line', label: 'Línea' }, { key: 'presentation', label: 'Presentación' }],
    features: [], quickFilters: commercialFilters,
  },
  barber: {
    id: 'barber', label: 'Barbería', facets: [], features: [], quickFilters: commercialFilters,
  },
};

export function resolveCatalogProfile(settings = {}) {
  return CATALOG_PROFILES[settings.catalog_profile] || CATALOG_PROFILES[settings.vertical] || CATALOG_PROFILES.gastro;
}
