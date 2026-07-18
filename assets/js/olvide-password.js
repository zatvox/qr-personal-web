// ============================================================
// OLVIDÉ MI CONTRASEÑA (pages/olvide-password.html)
// ============================================================
import { solicitarResetPassword } from './auth.js';
import { esEmailValido } from './utils.js';

const form = document.getElementById('form-olvide');
const errorEl = document.getElementById('olvide-error');
const exitoEl = document.getElementById('olvide-exito');
const btn = document.getElementById('btn-olvide');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';
  exitoEl.style.display = 'none';

  const email = document.getElementById('email').value.trim();
  if (!esEmailValido(email)) {
    errorEl.textContent = 'Ingresa un correo válido.';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    await solicitarResetPassword(email);
    // Mensaje genérico siempre (no revelar si el correo existe o no, evita enumeración de usuarios)
    exitoEl.textContent = 'Si ese correo tiene una cuenta, te enviamos un link para restablecer tu contraseña.';
    exitoEl.style.display = 'block';
    form.reset();
  } catch (err) {
    console.error(err);
    exitoEl.textContent = 'Si ese correo tiene una cuenta, te enviamos un link para restablecer tu contraseña.';
    exitoEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar link de recuperación';
  }
});
