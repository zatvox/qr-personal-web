// ============================================================
// DATA LAYER — queries y mutations contra Supabase
// Toda la lógica de acceso a datos vive aquí (no en las páginas)
// ============================================================
import { getSupabaseClient } from './supabase-client.js';
import { CONFIG } from './config.js';

/** Trae el perfil del usuario autenticado actual (dashboard) */
export async function obtenerMiPerfil(userId) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Trae un perfil público por slug (página /u/slug) */
export async function obtenerPerfilPublico(slug) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Actualiza campos del perfil propio */
export async function actualizarPerfil(userId, cambios) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .update(cambios)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Verifica disponibilidad de slug vía RPC segura */
export async function verificarSlugDisponible(slug) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('check_slug_available', { p_slug: slug });
  if (error) throw error;
  return !!data;
}

/**
 * Sube el avatar al bucket y devuelve la URL pública.
 * `blob` debe venir ya comprimido (ver utils.comprimirImagen) para
 * cuidar la cuota de Storage del free tier (ADR-005).
 */
export async function subirAvatar(userId, blob) {
  const supabase = await getSupabaseClient();
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(CONFIG.BUCKET_AVATARS)
    .upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(CONFIG.BUCKET_AVATARS).getPublicUrl(path);
  return data.publicUrl;
}

/** Lista imágenes de galería de un perfil, con su URL pública ya resuelta */
export async function obtenerGaleria(profileId) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('gallery_images')
    .select('*')
    .eq('profile_id', profileId)
    .order('orden', { ascending: true });
  if (error) throw error;

  return (data || []).map(row => ({
    ...row,
    url: supabase.storage.from(CONFIG.BUCKET_GALLERY).getPublicUrl(row.storage_path).data.publicUrl,
  }));
}

/**
 * Sube una foto de galería (ya comprimida, ver ADR-005) y registra
 * la fila en gallery_images. Se guarda el PATH del objeto (no la URL
 * pública) para poder borrarlo del Storage cuando el usuario lo elimine.
 */
export async function agregarFotoGaleria(userId, profileId, blob, orden = 0) {
  const supabase = await getSupabaseClient();
  const path = `${userId}/galeria-${Date.now()}-${orden}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(CONFIG.BUCKET_GALLERY)
    .upload(path, blob, { upsert: false, cacheControl: '3600', contentType: 'image/jpeg' });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('gallery_images')
    .insert({ profile_id: profileId, storage_path: path, orden })
    .select()
    .single();
  if (error) throw error;

  const { data: pub } = supabase.storage.from(CONFIG.BUCKET_GALLERY).getPublicUrl(path);
  return { ...data, url: pub.publicUrl };
}

/**
 * Actualiza los metadatos de portafolio de una foto de galería
 * (título, descripción y/o enlace externo opcional).
 */
export async function actualizarFotoGaleria(id, cambios) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('gallery_images')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Elimina una foto de galería: borra el objeto del Storage y la fila en DB */
export async function eliminarFotoGaleria(id, storagePath) {
  const supabase = await getSupabaseClient();
  if (storagePath) {
    const { error: delStorageErr } = await supabase.storage.from(CONFIG.BUCKET_GALLERY).remove([storagePath]);
    if (delStorageErr) console.warn('No se pudo borrar el archivo del Storage:', delStorageErr);
  }
  const { error } = await supabase.from('gallery_images').delete().eq('id', id);
  if (error) throw error;
}
