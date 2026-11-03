// ============================================================
// DATA LAYER — Portafolio (ítems con varias fotos)
// Capa de datos igual que supabase-data.js (la UI nunca habla
// directo con Supabase). Los topes de plan y la privacidad de los
// ítems 'privado' los fuerza la BD (007_portafolio_admin.sql).
// ============================================================
import { getSupabaseClient } from './supabase-client.js';
import { CONFIG } from './config.js';

function urlFoto(supabase, path) {
  return supabase.storage.from(CONFIG.BUCKET_GALLERY).getPublicUrl(path).data.publicUrl;
}

function normalizarItem(supabase, row) {
  const { portfolio_images, ...item } = row;
  const fotos = (portfolio_images || [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map(f => ({ ...f, url: urlFoto(supabase, f.storage_path) }));
  return { ...item, fotos };
}

/**
 * Trae los ítems de un perfil con sus fotos en UNA sola consulta
 * (importa: el perfil público se abre desde un QR con datos móviles).
 * `soloPublicos` excluye los privados: úsalo SIEMPRE en la página
 * pública, porque si el dueño la abre logueado la RLS sí le muestra
 * sus privados. Para el visitante anónimo la BD ya los oculta.
 */
export async function obtenerPortafolio(profileId, { soloPublicos = false } = {}) {
  const supabase = await getSupabaseClient();
  let q = supabase
    .from('portfolio_items')
    .select('*, portfolio_images(*)')
    .eq('profile_id', profileId)
    .order('orden', { ascending: true });
  if (soloPublicos) q = q.neq('estado', 'privado');
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(row => normalizarItem(supabase, row));
}

/** Crea un ítem vacío al final de la lista. Lanza el mensaje del tope de plan si aplica. */
export async function crearItemPortafolio(profileId, datos = {}, orden = 0) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('portfolio_items')
    .insert({ profile_id: profileId, titulo: 'Nuevo trabajo', orden, ...datos })
    .select('*, portfolio_images(*)')
    .single();
  if (error) throw error;
  return normalizarItem(supabase, data);
}

export async function actualizarItemPortafolio(id, cambios) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('portfolio_items')
    .update(cambios)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Borra el ítem Y sus archivos del Storage (el cascade de la BD solo borra filas). */
export async function eliminarItemPortafolio(item) {
  const supabase = await getSupabaseClient();
  const paths = (item.fotos || []).map(f => f.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: errStorage } = await supabase.storage.from(CONFIG.BUCKET_GALLERY).remove(paths);
    if (errStorage) console.warn('No se pudieron borrar algunos archivos del Storage:', errStorage);
  }
  const { error } = await supabase.from('portfolio_items').delete().eq('id', item.id);
  if (error) throw error;
}

/**
 * Sube una foto (ya comprimida) y registra su fila. Si la BD rechaza la fila
 * (tope de plan), borra el archivo recién subido para no dejar huérfanos.
 */
export async function agregarFotoItem(userId, itemId, blob, orden = 0) {
  const supabase = await getSupabaseClient();
  const sufijo = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/pf-${Date.now()}-${sufijo}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(CONFIG.BUCKET_GALLERY)
    .upload(path, blob, { upsert: false, cacheControl: '31536000', contentType: 'image/jpeg' });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('portfolio_images')
    .insert({ item_id: itemId, storage_path: path, orden })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(CONFIG.BUCKET_GALLERY).remove([path]);
    throw error;
  }
  return { ...data, url: urlFoto(supabase, path) };
}

export async function actualizarFotoItem(id, cambios) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('portfolio_images')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarFotoItem(id, storagePath) {
  const supabase = await getSupabaseClient();
  if (storagePath) {
    const { error: errStorage } = await supabase.storage.from(CONFIG.BUCKET_GALLERY).remove([storagePath]);
    if (errStorage) console.warn('No se pudo borrar el archivo del Storage:', errStorage);
  }
  const { error } = await supabase.from('portfolio_images').delete().eq('id', id);
  if (error) throw error;
}

/** Guarda el orden de los ítems según el arreglo de ids (posición = orden) */
export async function reordenarItems(ids) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.rpc('reordenar_portafolio', { p_ids: ids });
  if (error) throw error;
}

/** Guarda el orden de las fotos de un ítem */
export async function reordenarFotos(ids) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.rpc('reordenar_portafolio_fotos', { p_ids: ids });
  if (error) throw error;
}
