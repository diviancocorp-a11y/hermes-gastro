// src/services/settings.js
//
// Fuente unica de verdad para que campos van al upsert: SettingsInputSchema (Zod).
// safeParse con z.object() hace strip por default -> campos no declarados se
// descartan. Sin allowlist manual paralela (antes habia SETTINGS_COLS hardcoded
// que causo 3 bugs por divergencia con el schema: food_category #54/#56,
// catalog_theme #96).
//
// Para agregar una columna nueva al settings:
//   1. ALTER TABLE en supabase/migrations/
//   2. Agregar el campo a SettingsInputSchema en src/lib/schemas/index.js
//   Listo. No hay un tercer lugar que actualizar.

import { supabase } from '../lib/supabase';
import { SettingsInputSchema, validateInput } from '../lib/schemas/index.js';

export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error) { console.error('fetchSettings:', error.message); return null; }
  return data?.[0] || null;
}

export async function updateSettings(settings) {
  // Zod strip-mode descarta campos no declarados en el schema. Si un campo
  // no aparece en el upsert despues de validar, agregalo a SettingsInputSchema.
  const validation = validateInput(SettingsInputSchema, settings, 'updateSettings');
  if (!validation.ok) { console.error('updateSettings validation:', validation.errors); return null; }
  const { data, error } = await supabase.from('settings').upsert(validation.data).select().single();
  if (error) { console.error('updateSettings:', error.message); return null; }
  return data;
}
