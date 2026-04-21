// src/services/settings.js
import { supabase } from '../lib/supabase';
import { SettingsInputSchema, validateInput } from '../lib/schemas/index.js';

export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error) { console.error('fetchSettings:', error.message); return null; }
  return data?.[0] || null;
}

// Columnas válidas de la tabla settings (evita enviar campos desconocidos)
export const SETTINGS_COLS = [
  'id', 'biz_name', 'logo_letter', 'logo_color', 'logo_url',
  'cover_url', 'cat_images', 'hidden_cats', 'cat_names',
  'banner_text', 'banner_color', 'store_open', 'store_hours',
  'exp_cats', 'ing_cats'
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
