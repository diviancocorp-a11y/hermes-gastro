// src/services/storage.js
import { supabase } from '../lib/supabase';

// ─── STORAGE: IMAGE UPLOAD (con validación) ──────────
export const ALLOWED_IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
export const MAX_IMG_SIZE = 5 * 1024 * 1024; // 5MB

function validateImageFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_IMG_EXTS.includes(ext)) return 'Extensión no permitida. Usá JPG, PNG o WebP.';
  if (!ALLOWED_IMG_TYPES.includes(file.type)) return 'Tipo de archivo no permitido.';
  if (file.size > MAX_IMG_SIZE) return `Archivo muy grande (${(file.size/1024/1024).toFixed(1)}MB). Máximo 5MB.`;
  return null;
}

export async function uploadCoverImage(file) {
  const err = validateImageFile(file);
  if (err) { console.error('uploadCoverImage:', err); return { __error: err }; }
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `cover-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadCoverImage:', error.message); return null; }
  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadLogoImage(file) {
  const err = validateImageFile(file);
  if (err) { console.error('uploadLogoImage:', err); return { __error: err }; }
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `logo-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadLogoImage:', error.message); return null; }
  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadCatImage(file, catName) {
  const err = validateImageFile(file);
  if (err) { console.error('uploadCatImage:', err); return { __error: err }; }
  const ext = file.name.split('.').pop().toLowerCase();
  const slug = catName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const path = `cat-${slug}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadCatImage:', error.message); return null; }
  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadRecipeImage(file) {
  const err = validateImageFile(file);
  if (err) { console.error('uploadRecipeImage:', err); return { __error: err }; }
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadRecipeImage:', error.message); return null; }
  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}
