// ============================================================
// LOGIN (pages/login.html)
// ============================================================
import { iniciarSesion, reenviarConfirmacion, obtenerSesionActual } from './auth.js';

const form = document.getElementById('form-login');
const errorEl = document.getElementById('login-error');
const btn = document.getElementById('btn-login');
const btnReenviar = document.getElementById('btn-reenviar');

// Si ya hay sesión activa, ir directo al dashboard
obtenerSesionActual().then(sesion => {
  if (sesion) window.location.href = 'dashboard.html';
});

// Mensaje si viene de confirmar email (?confirmado=1)
if (new URLSearchParams(window.location.search).get('confirmado') === '1') {
  document.getElementById('mensaje-confirmacion').style.display = 'block';
}

let ultimoEmail = '';

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';
  btnReenviar.style.display = 'none';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  ultimoEmail = email;

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    await iniciarSesion({ email, password });
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error(err);
    if (err.message?.toLowerCase().includes('email not confirmed')) {
      errorEl.textContent = 'Aún no confirmas tu correo. Revisa tu bandeja de entrada.';
      btnReenviar.style.display = 'inline-flex';
    } else {
      errorEl.textContent = 'Correo o contraseña incorrectos.';
    }
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

btnReenviar.addEventListener('click', async () => {
  try {
    await reenviarConfirmacion(ultimoEmail);
    errorEl.textContent = 'Correo de confirmación reenviado.';
    errorEl.className = 'form-success';
    errorEl.style.display = 'block';
  } catch (err) {
    console.error(err);
  }
});
