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

// ------------------------------------------------------------
// Módulo de citas ("Agendar una cita")
// ------------------------------------------------------------

/** Horas ya reservadas de un perfil (por slug) en una fecha dada, vía RPC pública */
export async function obtenerHorariosOcupados(slug, fechaISO) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('obtener_horarios_ocupados', { p_slug: slug, p_fecha: fechaISO });
  if (error) throw error;
  return (data || []).map(row => row.hora.slice(0, 5)); // "HH:MM:SS" -> "HH:MM"
}

/**
 * Crea una cita vía RPC segura (valida horario/duplicados en el
 * servidor, ver functions.sql -> crear_cita). Lanza error con mensaje
 * legible si el horario ya no está disponible o los datos son inválidos.
 */
export async function crearCita({ slug, nombre, email, descripcion, fecha, hora }) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('crear_cita', {
    p_slug: slug,
    p_nombre: nombre,
    p_email: email,
    p_descripcion: descripcion || '',
    p_fecha: fecha,
    p_hora: hora,
  });
  if (error) throw error;
  return data;
}

/** Lista las citas recibidas por el dueño del perfil (dashboard), más próximas primero */
export async function obtenerCitas(profileId) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('citas')
    .select('*')
    .eq('profile_id', profileId)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Borra una cita recibida (el dueño la descarta desde el dashboard) */
export async function eliminarCita(id) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('citas').delete().eq('id', id);
  if (error) throw error;
}
