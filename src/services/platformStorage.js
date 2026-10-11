// src/services/platformStorage.js
// Imagenes propias del tenant (bucket `tenant-images`, migracion 0034).
//
// Hasta ahora el edificio no tenia Storage: el alta de producto pedia
// "Imagen (URL)" y la foto del ticket estaba apagada. El dueno de una
// panaderia no tiene una URL, tiene una foto en el telefono.
//
// UN bucket para todos, separado por CARPETA `<tenant_id>/`. Esa primera
// carpeta no es cosmetica: es lo que leen las policies de storage.objects.
// Por eso el tenantId es obligatorio y el path se arma SIEMPRE aca — si una
// pantalla pudiera elegir el path, podria escribir en la carpeta de otro.
//
// La validacion de abajo es COMODIDAD, no seguridad: da un mensaje
// inmediato en vez de esperar el round-trip. La barrera real son el
// file_size_limit y los allowed_mime_types del bucket, que un request
// armado a mano no puede saltear.

import { supabase } from '../lib/supabase';

const BUCKET = 'tenant-images';

export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const EXTS_PERMITIDAS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
// El favicon es el unico lugar donde un .ico tiene sentido (0091).
const TIPOS_ICO = ['image/x-icon', 'image/vnd.microsoft.icon'];

// Musica del catalogo (migracion 0094). Mismo bucket y mismo tope que las fotos.
export const TIPOS_AUDIO = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav'];
export const EXTS_AUDIO = ['mp3', 'm4a', 'aac', 'ogg', 'wav'];

export const TAMANO_MAX = 5 * 1024 * 1024; // igual que el bucket

function exigirTenant(tenantId, quien) {
  if (!tenantId) throw new Error(`${quien}: falta tenantId (sin el, la imagen no tiene carpeta)`);
}

/** Devuelve un mensaje de error, o null si el archivo sirve. */
export function validarImagen(file, { permitirIco = false } = {}) {
  if (!file) return 'No se eligió ningún archivo.';
  const ext = (file.name?.split('.').pop() || '').toLowerCase();
  if (permitirIco && ext === 'ico') {
    // Algunos sistemas dejan el type vacio para .ico: se acepta por extension.
    if (file.type && !TIPOS_ICO.includes(file.type)) return 'Ese archivo no parece un .ico.';
    if (file.size > TAMANO_MAX) return 'El archivo pesa más de 5 MB.';
    return null;
  }
  if (!EXTS_PERMITIDAS.includes(ext)) return 'Ese tipo de archivo no se puede usar. Sacá una foto o elegí un JPG o PNG.';
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Ese tipo de archivo no se puede usar. Probá con una foto.';
  if (file.size > TAMANO_MAX) {
    return `La foto pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB. Probá con una más chica.`;
  }
  return null;
}

/**
 * Sube una imagen y devuelve su URL publica, o `{ __error }`.
 *
 * El nombre lleva timestamp + random y nunca se reusa: asi la URL de una
 * imagen vieja no cambia de contenido de golpe (el catalogo y los pedidos ya
 * hechos siguen mostrando lo que mostraban) y se puede cachear fuerte.
 *
 * @param prefix  solo para reconocer el archivo en el panel de Storage:
 *                'producto', 'ticket', 'logo'... no afecta los permisos.
 */
export async function uploadTenantImage(tenantId, file, { prefix = 'img' } = {}) {
  exigirTenant(tenantId, 'uploadTenantImage');

  const limpio = String(prefix).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'img';
  const problema = validarImagen(file, { permitirIco: limpio === 'favicon' });
  if (problema) return { __error: problema };

  const ext = file.name.split('.').pop().toLowerCase();
  // Un .ico sin type se sube con el de siempre: el bucket rechaza el vacio.
  const contentType = file.type || (ext === 'ico' ? 'image/x-icon' : undefined);
  const path = `${tenantId}/${limpio}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, cacheControl: '31536000', upsert: false });

  if (error) {
    console.error('uploadTenantImage:', error.message);
    // El mensaje del server es en ingles y tecnico; el que carga necesita
    // saber que hacer, no que devolvio el gateway.
    const m = error.message.toLowerCase();
    if (m.includes('exceeded') || m.includes('too large')) {
      return { __error: 'La foto es muy pesada. El máximo es 5 MB.' };
    }
    if (m.includes('mime') || m.includes('not allowed')) {
      return { __error: 'Ese tipo de archivo no se puede usar. Probá con una foto JPG o PNG.' };
    }
    return { __error: 'No se pudo subir la foto. Probá de nuevo.' };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/** Devuelve un mensaje de error, o null si el archivo de audio sirve. */
export function validarAudio(file) {
  if (!file) return 'No se eligió ningún archivo.';
  const ext = (file.name?.split('.').pop() || '').toLowerCase();
  if (!EXTS_AUDIO.includes(ext)) return 'Ese tipo de archivo no se puede usar. Subí un MP3, M4A, OGG o WAV.';
  if (file.type && !TIPOS_AUDIO.includes(file.type)) return 'Ese archivo no parece un audio. Probá con un MP3.';
  if (file.size > TAMANO_MAX) {
    return `La canción pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB. Comprimila o recortala.`;
  }
  return null;
}

/** Sube la musica del catalogo y devuelve su URL publica, o `{ __error }`. */
export async function uploadTenantAudio(tenantId, file) {
  exigirTenant(tenantId, 'uploadTenantAudio');
  const problema = validarAudio(file);
  if (problema) return { __error: problema };

  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${tenantId}/musica-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  // Sin type (algunos sistemas lo dejan vacio) el bucket lo rechazaria.
  const tipos = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav' };
  const contentType = file.type || tipos[ext];

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, cacheControl: '31536000', upsert: false });

  if (error) {
    console.error('uploadTenantAudio:', error.message);
    const m = error.message.toLowerCase();
    if (m.includes('exceeded') || m.includes('too large')) return { __error: 'La canción es muy pesada. El máximo es 5 MB.' };
    if (m.includes('mime') || m.includes('not allowed')) return { __error: 'Ese tipo de archivo no se puede usar. Probá con un MP3.' };
    return { __error: 'No se pudo subir la canción. Probá de nuevo.' };
  }
  return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
}
