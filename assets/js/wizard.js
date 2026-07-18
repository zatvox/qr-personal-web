// ============================================================
// WIZARD (index.html) — secciones desplegables con preview en vivo
// No escribe en Supabase hasta el paso final (registro). Ver ADR-004.
// El avatar elegido antes de tener cuenta viaja como miniatura base64
// en user_metadata hasta que el dashboard lo sube a Storage. Ver ADR-007.
// La paleta de color (primario+secundario) es libre; el texto sobre
// ella se calcula automáticamente para mantener contraste. Ver ADR-006.
// ============================================================
import { CONFIG } from './config.js';
import { registrarUsuario } from './auth.js';
import { verificarSlugDisponible } from './supabase-data.js';
import {
  slugify, showToast, esEmailValido, escapeHtml,
  leerBorrador, guardarBorrador, limpiarBorrador, debounce,
  comprimirImagen, blobToBase64, esHexValido, mezclarConBlanco, iconoRedSocial, iconoContacto,
  cargarGoogleFont, colorTextoLegible,
} from './utils.js';

const form = document.getElementById('wizard-form');
const camposTexto = ['nombre_completo', 'cargo', 'empresa', 'bio', 'telefono', 'whatsapp', 'direccion', 'horario_atencion', 'video_url', 'slug', 'email'];

let avatarPendienteB64 = ''; // miniatura del avatar elegido, lista para enviar en el registro
let colorPrimario = CONFIG.TEMA_PRIMARIO_DEFECTO;
let colorSecundario = CONFIG.TEMA_SECUNDARIO_DEFECTO;
let fuenteTitulo = CONFIG.FUENTE_TITULO_DEFECTO;
let fuenteTexto = CONFIG.FUENTE_TEXTO_DEFECTO;

// ------------------------------------------------------------
// Generar campos de redes sociales dinámicamente desde CONFIG
// ------------------------------------------------------------
function renderCamposRedes() {
  const cont = document.getElementById('redes-campos');
  cont.innerHTML = CONFIG.REDES_SOCIALES.map(r => `
    <div class="form-group">
      <label class="form-label" for="red_${r.key}">${escapeHtml(r.label)}</label>
      <input class="form-input" type="url" id="red_${r.key}" name="red_${r.key}" placeholder="https://...">
    </div>
  `).join('');
}

// ------------------------------------------------------------
// Selector de paleta de color: swatches preset + editor hex libre
// ------------------------------------------------------------
const inputPrimarioPicker = document.getElementById('color-primario-picker');
const inputPrimarioHex = document.getElementById('color-primario-hex');
const inputSecundarioPicker = document.getElementById('color-secundario-picker');
const inputSecundarioHex = document.getElementById('color-secundario-hex');

function renderPaletaSwatches() {
  const cont = document.getElementById('paleta-swatches');
  cont.innerHTML = CONFIG.PALETAS_PRESET.map((p, i) => {
    const seleccionada = p.primary.toLowerCase() === colorPrimario.toLowerCase() && p.secondary.toLowerCase() === colorSecundario.toLowerCase();
    return `
      <button type="button" class="paleta-swatch ${seleccionada ? 'seleccionada' : ''}" data-paleta-idx="${i}" aria-label="Paleta ${escapeHtml(p.label)}" title="${escapeHtml(p.label)}">
        <span style="background:${p.primary};"></span>
        <span style="background:${p.secondary};"></span>
      </button>
    `;
  }).join('');

  cont.querySelectorAll('[data-paleta-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = CONFIG.PALETAS_PRESET[Number(btn.dataset.paletaIdx)];
      colorPrimario = preset.primary;
      colorSecundario = preset.secondary;
      sincronizarInputsDeColor();
      aplicarTemaPreview();
      guardarBorradorActual();
    });
  });
}

function sincronizarInputsDeColor() {
  inputPrimarioPicker.value = colorPrimario;
  inputPrimarioHex.value = colorPrimario.toUpperCase();
  inputSecundarioPicker.value = colorSecundario;
  inputSecundarioHex.value = colorSecundario.toUpperCase();
  renderPaletaSwatches();
}

function aplicarTemaPreview() {
  const aside = document.querySelector('.tarjeta-preview');
  aside.style.setProperty('--color-primary', colorPrimario);
  aside.style.setProperty('--color-primary-dark', colorSecundario);
  aside.style.setProperty('--color-primary-light', mezclarConBlanco(colorPrimario, 0.85));
  aside.style.setProperty('--color-on-primary', colorTextoLegible(colorPrimario));
  aside.style.setProperty('--font-heading', `'${fuenteTitulo}', sans-serif`);
  aside.style.setProperty('--font-body', `'${fuenteTexto}', sans-serif`);
}

// ------------------------------------------------------------
// Selector de fuentes (Título / Textos)
// ------------------------------------------------------------
const selectFuenteTitulo = document.getElementById('fuente-titulo');
const selectFuenteTexto = document.getElementById('fuente-texto');

function renderSelectoresFuentes() {
  const opciones = CONFIG.FUENTES_DISPONIBLES
    .map(f => `<option value="${f}" style="font-family:'${f}', sans-serif;">${f}</option>`)
    .join('');
  selectFuenteTitulo.innerHTML = opciones;
  selectFuenteTexto.innerHTML = opciones;
  selectFuenteTitulo.value = fuenteTitulo;
  selectFuenteTexto.value = fuenteTexto;
}

selectFuenteTitulo.addEventListener('change', () => {
  fuenteTitulo = selectFuenteTitulo.value;
  cargarGoogleFont(fuenteTitulo);
  aplicarTemaPreview();
  guardarBorradorActual();
});
selectFuenteTexto.addEventListener('change', () => {
  fuenteTexto = selectFuenteTexto.value;
  cargarGoogleFont(fuenteTexto);
  aplicarTemaPreview();
  guardarBorradorActual();
});

inputPrimarioPicker.addEventListener('input', () => {
  colorPrimario = inputPrimarioPicker.value;
  inputPrimarioHex.value = colorPrimario.toUpperCase();
  renderPaletaSwatches();
  aplicarTemaPreview();
  guardarBorradorActual();
});
inputPrimarioHex.addEventListener('input', () => {
  const valor = inputPrimarioHex.value.trim();
  if (esHexValido(valor)) {
    colorPrimario = valor;
    inputPrimarioPicker.value = valor;
    renderPaletaSwatches();
    aplicarTemaPreview();
    guardarBorradorActual();
  }
});
inputSecundarioPicker.addEventListener('input', () => {
  colorSecundario = inputSecundarioPicker.value;
  inputSecundarioHex.value = colorSecundario.toUpperCase();
  renderPaletaSwatches();
  aplicarTemaPreview();
  guardarBorradorActual();
});
inputSecundarioHex.addEventListener('input', () => {
  const valor = inputSecundarioHex.value.trim();
  if (esHexValido(valor)) {
    colorSecundario = valor;
    inputSecundarioPicker.value = valor;
    renderPaletaSwatches();
    aplicarTemaPreview();
    guardarBorradorActual();
  }
});
document.getElementById('btn-swap-colores').addEventListener('click', () => {
  [colorPrimario, colorSecundario] = [colorSecundario, colorPrimario];
  sincronizarInputsDeColor();
  aplicarTemaPreview();
  guardarBorradorActual();
});

// ------------------------------------------------------------
// Checkbox "Este número también es mi WhatsApp"
// ------------------------------------------------------------
const checkEsWhatsapp = document.getElementById('es_whatsapp');
const whatsappWrap = document.getElementById('whatsapp-wrap');

function actualizarVisibilidadWhatsapp() {
  whatsappWrap.style.display = checkEsWhatsapp.checked ? 'none' : 'block';
}
checkEsWhatsapp.addEventListener('change', () => { actualizarVisibilidadWhatsapp(); guardarBorradorActual(); actualizarPreview(); });

// ------------------------------------------------------------
// Foto de perfil: input de archivo -> comprimir -> preview + base64
// ------------------------------------------------------------
/** Muestra la foto en el círculo de preview y oculta el ícono de silueta */
function mostrarAvatarPreview(src) {
  document.getElementById('preview-avatar').src = src;
  const placeholder = document.getElementById('preview-avatar-placeholder');
  if (placeholder) placeholder.style.display = 'none';
}

document.getElementById('foto-file').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  try {
    // Miniatura pequeña para viajar en user_metadata (ADR-007)
    const blobMini = await comprimirImagen(archivo, CONFIG.AVATAR_THUMBNAIL_MAX_PX, CONFIG.AVATAR_THUMBNAIL_JPEG_CALIDAD);
    avatarPendienteB64 = await blobToBase64(blobMini);

    // Preview nítida inmediata (no necesita ser la comprimida pequeña)
    mostrarAvatarPreview(URL.createObjectURL(archivo));

    guardarBorradorActual();
  } catch (err) {
    console.error(err);
    showToast('No se pudo procesar esa imagen, intenta con otra.', 3500);
  }
});

// ------------------------------------------------------------
// Borrador: cargar / guardar en localStorage
// ------------------------------------------------------------
function cargarBorradorEnForm() {
  const draft = leerBorrador(CONFIG.DRAFT_STORAGE_KEY);
  camposTexto.forEach(id => {
    const el = document.getElementById(id);
    if (el && draft[id] !== undefined) el.value = draft[id];
  });
  if (draft.mostrar_email) document.getElementById('mostrar_email').checked = true;
  checkEsWhatsapp.checked = draft.es_whatsapp !== false;
  CONFIG.REDES_SOCIALES.forEach(r => {
    const el = document.getElementById(`red_${r.key}`);
    if (el && draft.redes?.[r.key]) el.value = draft.redes[r.key];
  });
  if (draft.avatar_pendiente_b64) {
    avatarPendienteB64 = draft.avatar_pendiente_b64;
    mostrarAvatarPreview(avatarPendienteB64);
  }
  if (esHexValido(draft.tema_color_primario)) colorPrimario = draft.tema_color_primario;
  if (esHexValido(draft.tema_color_secundario)) colorSecundario = draft.tema_color_secundario;
  if (CONFIG.FUENTES_DISPONIBLES.includes(draft.tema_fuente_titulo)) fuenteTitulo = draft.tema_fuente_titulo;
  if (CONFIG.FUENTES_DISPONIBLES.includes(draft.tema_fuente_texto)) fuenteTexto = draft.tema_fuente_texto;
  cargarGoogleFont(fuenteTitulo);
  cargarGoogleFont(fuenteTexto);
  renderSelectoresFuentes();
  sincronizarInputsDeColor();
  aplicarTemaPreview();
  actualizarVisibilidadWhatsapp();
  actualizarPreview();
}

function recolectarDatos() {
  const datos = {};
  camposTexto.forEach(id => {
    const el = document.getElementById(id);
    if (el) datos[id] = el.value.trim();
  });
  datos.mostrar_email = document.getElementById('mostrar_email').checked;
  datos.es_whatsapp = checkEsWhatsapp.checked;
  datos.whatsapp = checkEsWhatsapp.checked ? datos.telefono : datos.whatsapp;
  datos.tema_color_primario = colorPrimario;
  datos.tema_color_secundario = colorSecundario;
  datos.tema_fuente_titulo = fuenteTitulo;
  datos.tema_fuente_texto = fuenteTexto;
  datos.avatar_pendiente_b64 = avatarPendienteB64;
  datos.redes = {};
  CONFIG.REDES_SOCIALES.forEach(r => {
    const el = document.getElementById(`red_${r.key}`);
    if (el && el.value.trim()) datos.redes[r.key] = el.value.trim();
  });
  return datos;
}

function guardarBorradorActual() {
  guardarBorrador(CONFIG.DRAFT_STORAGE_KEY, recolectarDatos());
}

// ------------------------------------------------------------
// Preview en vivo
// ------------------------------------------------------------
function actualizarPreview() {
  const d = recolectarDatos();

  document.getElementById('preview-nombre').textContent = d.nombre_completo || 'Edwin García Flores';
  const cargoEmpresa = [d.cargo, d.empresa].filter(Boolean).join(' · ');
  document.getElementById('preview-cargo').textContent = cargoEmpresa || 'Arquitecto · Estudio XYZ';
  const bioEl = document.getElementById('preview-bio');
  if (d.bio) {
    bioEl.textContent = d.bio;
    bioEl.classList.remove('tarjeta-preview__bio--vacio');
  } else {
    bioEl.textContent = 'Soy un profesional apasionado por mi trabajo y siempre busco nuevas oportunidades para crecer y aprender.';
    bioEl.classList.add('tarjeta-preview__bio--vacio');
  }

  const redesCont = document.getElementById('preview-redes');
  const redesEntries = Object.entries(d.redes || {});
  if (redesEntries.length) {
    redesCont.innerHTML = redesEntries.map(([key, url]) => {
      const label = CONFIG.REDES_SOCIALES.find(r => r.key === key)?.label || key;
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${escapeHtml(label)}">${iconoRedSocial(key)}</a>`;
    }).join('');
  } else {
    redesCont.innerHTML = '<span class="tarjeta-preview__redes-vacio">Tus redes sociales aparecerán aquí</span>';
  }

  const contactoCont = document.getElementById('preview-contacto');
  const fila = (icono, label, valor) => `
    <div class="tarjeta-preview__contacto-item">
      <span class="tarjeta-preview__contacto-icono">${iconoContacto(icono)}</span>
      <span class="tarjeta-preview__contacto-texto">
        <span class="tarjeta-preview__contacto-label">${escapeHtml(label)}</span>
        <span class="tarjeta-preview__contacto-valor">${escapeHtml(valor)}</span>
      </span>
    </div>`;
  const items = [];
  if (d.telefono) items.push(fila('telefono', 'Teléfono', d.telefono));
  if (!d.es_whatsapp && d.whatsapp) items.push(fila('whatsapp', 'WhatsApp', d.whatsapp));
  if (d.direccion) items.push(fila('direccion', 'Ubicación', d.direccion));
  if (d.horario_atencion) items.push(fila('horario', 'Horario', d.horario_atencion));
  contactoCont.innerHTML = items.join('') || '<p class="tarjeta-preview__contacto-vacio">Tus datos de contacto aparecerán aquí.</p>';
}

// ------------------------------------------------------------
// Acordeón: toast al cerrar una sección (equivalente a "pasar de sección")
// ------------------------------------------------------------
document.querySelectorAll('.accordion-section').forEach(sec => {
  sec.addEventListener('toggle', () => {
    if (!sec.open) {
      showToast(CONFIG.TOAST_MENSAJE, CONFIG.TOAST_DURATION_MS);
    }
  });
});

// ------------------------------------------------------------
// Slugify automático a partir del nombre (solo si el usuario no lo tocó)
// ------------------------------------------------------------
let slugTocadoManualmente = false;
document.getElementById('slug').addEventListener('input', () => { slugTocadoManualmente = true; });

document.getElementById('nombre_completo').addEventListener('input', () => {
  if (!slugTocadoManualmente) {
    document.getElementById('slug').value = slugify(document.getElementById('nombre_completo').value);
  }
});

const verificarSlugDebounced = debounce(async () => {
  const slugEl = document.getElementById('slug');
  const estado = document.getElementById('slug-estado');
  const valor = slugify(slugEl.value);
  slugEl.value = valor;
  if (valor.length < 3) return;
  estado.textContent = 'Verificando disponibilidad...';
  estado.className = 'form-hint';
  try {
    const disponible = await verificarSlugDisponible(valor);
    estado.textContent = disponible ? '✅ Disponible' : '❌ Ya está en uso, prueba otro';
    estado.className = disponible ? 'form-success' : 'form-error';
  } catch {
    estado.textContent = 'No se pudo verificar ahora mismo (se validará al registrarte).';
    estado.className = 'form-hint';
  }
}, 500);

document.getElementById('slug').addEventListener('input', verificarSlugDebounced);

// ------------------------------------------------------------
// Preview en vivo: escuchar todos los inputs del form
// ------------------------------------------------------------
form.addEventListener('input', () => { actualizarPreview(); guardarBorradorActual(); });
form.addEventListener('change', () => { actualizarPreview(); guardarBorradorActual(); });

// ------------------------------------------------------------
// Validación mínima al enviar (ya no hay pasos, solo se valida al final)
// ------------------------------------------------------------
function validarFormulario() {
  const requeridos = form.querySelectorAll('[required]');
  for (const campo of requeridos) {
    if (!campo.value.trim()) {
      campo.closest('details')?.setAttribute('open', '');
      campo.focus();
      showToast('Completa los campos obligatorios (*) antes de crear tu cuenta', 3500);
      return false;
    }
  }
  const slugEl = document.getElementById('slug');
  if (!/^[a-z0-9](-?[a-z0-9])*$/.test(slugEl.value)) {
    slugEl.closest('details')?.setAttribute('open', '');
    slugEl.focus();
    showToast('El link único solo puede tener letras minúsculas, números y guiones.', 3500);
    return false;
  }
  return true;
}

// ------------------------------------------------------------
// Envío final: crear cuenta
// ------------------------------------------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validarFormulario()) return;

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('registro-error');
  const exitoEl = document.getElementById('registro-exito');
  const btn = document.getElementById('btn-registrar');

  errorEl.style.display = 'none';
  exitoEl.style.display = 'none';

  if (!esEmailValido(email)) {
    errorEl.textContent = 'Ingresa un correo válido.';
    errorEl.style.display = 'block';
    return;
  }
  if (password.length < 8) {
    errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres.';
    errorEl.style.display = 'block';
    return;
  }

  const datos = recolectarDatos();
  btn.disabled = true;
  btn.textContent = 'Creando tu cuenta...';

  try {
    await registrarUsuario({
      email,
      password,
      datosWizard: datos,
      slugSugerido: datos.slug,
    });
    limpiarBorrador(CONFIG.DRAFT_STORAGE_KEY);
    exitoEl.textContent = '¡Listo! Revisa tu correo y confirma tu cuenta para activar tu tarjeta y generar tu QR.';
    exitoEl.style.display = 'block';
    form.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message?.includes('already registered')
      ? 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.'
      : 'No se pudo crear tu cuenta. Intenta de nuevo.';
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Crear cuenta y generar mi QR';
  }
});

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
renderCamposRedes();
cargarBorradorEnForm();
document.getElementById('slug-prefijo').textContent = CONFIG.SITE_BASE_URL.replace(/^https?:\/\//, '') + '/u/';

// Los íconos de redes/contacto se cargan de forma asíncrona desde
// Simple Icons/Lucide (ver utils.js); en cuanto estén listos se
// repinta la preview para que no se quede con el placeholder.
window.addEventListener('qr-iconos-listos', actualizarPreview);
