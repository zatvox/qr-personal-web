// ============================================================
// RESTABLECER CONTRASEÑA (pages/restablecer-password.html)
// Supabase abre esta página con una sesión temporal ya activa
// (tokens en la URL), gracias a detectSessionInUrl: true en
// supabase-client.js. Solo falta pedir la nueva contraseña.
// ============================================================
import { actualizarPassword, obtenerSesionActual } from './auth.js';

const form = document.getElementById('form-restablecer');
const errorEl = document.getElementById('restablecer-error');
const exitoEl = document.getElementById('restablecer-exito');
const btn = document.getElementById('btn-restablecer');

async function verificarSesionDeRecuperacion() {
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    errorEl.textContent = 'Este link expiró o ya fue usado. Solicita uno nuevo.';
    errorEl.style.display = 'block';
    form.querySelectorAll('input, button').forEach(el => el.disabled = true);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';
  exitoEl.style.display = 'none';

  const p1 = document.getElementById('password').value;
  const p2 = document.getElementById('password2').value;

  if (p1.length < 8) {
    errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres.';
    errorEl.style.display = 'block';
    return;
  }
  if (p1 !== p2) {
    errorEl.textContent = 'Las contraseñas no coinciden.';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await actualizarPassword(p1);
    exitoEl.textContent = '¡Contraseña actualizada! Redirigiendo a tu panel...';
    exitoEl.style.display = 'block';
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
  } catch (err) {
    console.error(err);
    errorEl.textContent = 'No se pudo actualizar la contraseña. Intenta solicitar el link de nuevo.';
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Guardar nueva contraseña';
  }
});

verificarSesionDeRecuperacion();
