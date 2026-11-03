// ============================================================
// DATA LAYER — Panel admin (planes, pagos, estados de perfiles)
// Todas las operaciones pasan por RPCs SECURITY DEFINER que
// verifican public.es_admin() en el servidor: aunque alguien
// manipule el JS, la BD rechaza a quien no sea admin.
// ============================================================
import { getSupabaseClient } from './supabase-client.js';

/** ¿El usuario logueado es admin? Si la función aún no existe o falla → false (nunca rompe el dashboard). */
export async function esAdmin() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('es_admin');
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function adminListarUsuarios() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_listar_usuarios');
  if (error) throw error;
  return data || [];
}

export async function adminCambiarPlan(profileId, plan, venceEn = null) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.rpc('admin_cambiar_plan', {
    p_profile_id: profileId,
    p_plan: plan,
    p_vence_en: venceEn || null,
  });
  if (error) throw error;
}

export async function adminActivarPerfil(profileId, activo) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.rpc('admin_activar_perfil', { p_profile_id: profileId, p_activo: activo });
  if (error) throw error;
}

/** Registra un pago y activa/extiende Pro. Devuelve la nueva fecha de vencimiento ('YYYY-MM-DD'). */
export async function adminRegistrarPago({ profileId, monto, metodo, periodo, fechaPago, venceEn, referencia, notas }) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_registrar_pago', {
    p_profile_id: profileId,
    p_monto: monto,
    p_metodo: metodo,
    p_periodo: periodo,
    p_fecha_pago: fechaPago || null,
    p_vence_en: venceEn || null,
    p_referencia: referencia || '',
    p_notas: notas || '',
  });
  if (error) throw error;
  return data;
}

export async function adminListarPagos(profileId) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('profile_id', profileId)
    .order('fecha_pago', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminEliminarPago(id) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('pagos').delete().eq('id', id);
  if (error) throw error;
}
