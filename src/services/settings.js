// src/services/settings.js
import { supabase } from '../lib/supabase';
import { SettingsInputSchema, validateInput } from '../lib/schemas/index.js';

export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error) { console.error('fetchSettings:', error.message); return null; }
  return data?.[0] || null;
}

// Columnas válidas de la tabla settings (evita enviar campos desconocidos).
// IMPORTANTE: agregar acá cualquier columna nueva del schema, sino el upsert
// la descarta silenciosamente y el cambio nunca persiste.
export const SETTINGS_COLS = [
  // Base
  'id', 'biz_name', 'logo_letter', 'logo_color', 'logo_url',
  'cover_url', 'cat_images', 'hidden_cats', 'cat_names',
  'banner_text', 'banner_color', 'store_open', 'store_hours',
  'exp_cats', 'ing_cats',
  // Finanzas — costos proyectados (Configuración → Finanzas)
  'waste_pct', 'expense_pct',
  // Medios de pago — admin (master) + subset visible en catálogo
  'payment_methods', 'catalog_payment_methods',
  // Identidad social / SEO (migration 20260524_brand_catalog_settings)
  'slogan', 'description', 'whatsapp', 'instagram',
  'og_image_url', 'favicon_url',
  // Catálogo público (migration 20260524_brand_catalog_settings)
  'min_order_amount', 'prep_time_min', 'delivery_time_min',
  'show_hours_on_catalog', 'catalog_font',
  // Grupos de categorías + daily deals (migration 20260524_category_groups_image)
  'cat_groups', 'daily_deals', 'deal_pct',
  // Multi-tenant per-client (edge functions)
  'store_name', 'app_url',
];

export async function updateSettings(settings) {
  // Filtrar solo columnas conocidas para evitar errores de Supabase
  const clean = {};
  for (const k of SETTINGS_COLS) {
    if (k in settings) clean[k] = settings[k];
  }
  const validation = validateInput(SettingsInputSchema, clean, 'updateSettings');
  if (!validation.ok) { console.error('updateSettings validation:', validation.errors); return null; }
  const { data, error } = await supabase.from('settings').upsert(validation.data).select().single();
  if (error) { console.error('updateSettings:', error.message); return null; }
  return data;
}
