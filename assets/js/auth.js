// ============================================================
// AUTH — registro, login, logout, sesión (Supabase Auth)
// ============================================================
import { getSupabaseClient } from './supabase-client.js';

/**
 * Registra un usuario nuevo. Los datos del wizard viajan en
 * user_metadata; el trigger handle_new_user() los usará al
 * confirmarse el email (ver assets/sql/functions.sql, ADR-004).
 */
export async function registrarUsuario({ email, password, datosWizard, slugSugerido }) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        ...datosWizard,
        slug_sugerido: slugSugerido || '',
      },
      emailRedirectTo: window.location.origin + window.location.pathname.replace(/pages\/.*$/, '') + 'pages/login.html?confirmado=1',
    },
  });
  if (error) throw error;
  return data;
}

export async function iniciarSesion({ email, password }) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function cerrarSesion() {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function obtenerSesionActual() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function reenviarConfirmacion(email) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

/**
 * Envía el correo de recuperación de contraseña. Supabase redirige
 * al link de `redirectTo` con un token de sesión temporal en la URL,
 * que restablecer-password.html usa para permitir el cambio.
 */
export async function solicitarResetPassword(email) {
  const supabase = await getSupabaseClient();
  const rutaBase = window.location.origin + window.location.pathname.replace(/pages\/.*$/, '');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${rutaBase}pages/restablecer-password.html`,
  });
  if (error) throw error;
}

/** Actualiza la contraseña del usuario ya autenticado por el link de recuperación */
export async function actualizarPassword(nuevaPassword) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (error) throw error;
}

/** Redirige a login si no hay sesión activa. Usar en páginas protegidas (dashboard). */
export async function protegerPagina(rutaLogin = 'login.html') {
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    window.location.href = rutaLogin;
    return null;
  }
  return sesion;
}
