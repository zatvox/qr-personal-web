// ============================================================
// DASHBOARD (pages/dashboard.html) — edición del perfil propio
// ============================================================
import { CONFIG } from './config.js';
import { protegerPagina, cerrarSesion } from './auth.js';
import {
  obtenerMiPerfil, actualizarPerfil, subirAvatar,
  obtenerGaleria, agregarFotoGaleria, eliminarFotoGaleria,
} from './supabase-data.js';
import { renderizarQR, descargarQR } from './qr.js';
import { escapeHtml, comprimirImagen, base64ADataBlob, esHexValido, mezclarConBlanco, iconoRedSocial, iconoContacto, cargarGoogleFont, colorTextoLegible } from './utils.js';
import { getSupabaseClient } from './supabase-client.js';

const CAMPOS_TEXTO = ['nombre_completo', 'cargo', 'empresa', 'bio', 'telefono', 'whatsapp', 'direccion', 'horario_atencion', 'video_url'];

let sesion = null;
let perfilActual = null;
let galeriaActual = [];
let colorPrimario = CONFIG.TEMA_PRIMARIO_DEFECTO;
let colorSecundario = CONFIG.TEMA_SECUNDARIO_DEFECTO;
let fuenteTitulo = CONFIG.FUENTE_TITULO_DEFECTO;
let fuenteTexto = CONFIG.FUENTE_TEXTO_DEFECTO;

function renderCamposRedes(redesGuardadas = {}) {
  const cont = document.getElementById('redes-campos');
  cont.innerHTML = CONFIG.REDES_SOCIALES.map(r => `
    <div class="form-group">
      <label class="form-label" for="red_${r.key}">${escapeHtml(r.label)}</label>
      <input class="form-input" type="url" id="red_${r.key}" value="${escapeHtml(redesGuardadas[r.key] || '')}" placeholder="https://...">
    </div>
  `).join('');
}

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
  const preview = document.querySelector('.tarjeta-preview');
  preview.style.setProperty('--color-primary', colorPrimario);
  preview.style.setProperty('--color-primary-dark', colorSecundario);
  preview.style.setProperty('--color-primary-light', mezclarConBlanco(colorPrimario, 0.85));
  preview.style.setProperty('--color-on-primary', colorTextoLegible(colorPrimario));
  preview.style.setProperty('--font-heading', `'${fuenteTitulo}', sans-serif`);
  preview.style.setProperty('--font-body', `'${fuenteTexto}', sans-serif`);
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
});
selectFuenteTexto.addEventListener('change', () => {
  fuenteTexto = selectFuenteTexto.value;
  cargarGoogleFont(fuenteTexto);
  aplicarTemaPreview();
});

inputPrimarioPicker.addEventListener('input', () => {
  colorPrimario = inputPrimarioPicker.value;
  inputPrimarioHex.value = colorPrimario.toUpperCase();
  renderPaletaSwatches();
  aplicarTemaPreview();
});
inputPrimarioHex.addEventListener('input', () => {
  const valor = inputPrimarioHex.value.trim();
  if (esHexValido(valor)) {
    colorPrimario = valor;
    inputPrimarioPicker.value = valor;
    renderPaletaSwatches();
    aplicarTemaPreview();
  }
});
inputSecundarioPicker.addEventListener('input', () => {
  colorSecundario = inputSecundarioPicker.value;
  inputSecundarioHex.value = colorSecundario.toUpperCase();
  renderPaletaSwatches();
  aplicarTemaPreview();
});
inputSecundarioHex.addEventListener('input', () => {
  const valor = inputSecundarioHex.value.trim();
  if (esHexValido(valor)) {
    colorSecundario = valor;
    inputSecundarioPicker.value = valor;
    renderPaletaSwatches();
    aplicarTemaPreview();
  }
});
document.getElementById('btn-swap-colores').addEventListener('click', () => {
  [colorPrimario, colorSecundario] = [colorSecundario, colorPrimario];
  sincronizarInputsDeColor();
  aplicarTemaPreview();
});

// ------------------------------------------------------------
// Checkbox "Este número también es mi WhatsApp"
// ------------------------------------------------------------
const checkEsWhatsapp = document.getElementById('es_whatsapp');
const whatsappWrap = document.getElementById('whatsapp-wrap');

function actualizarVisibilidadWhatsapp() {
  whatsappWrap.style.display = checkEsWhatsapp.checked ? 'none' : 'block';
}
checkEsWhatsapp.addEventListener('change', actualizarVisibilidadWhatsapp);

function llenarFormulario(perfil) {
  CAMPOS_TEXTO.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = perfil[id] || '';
  });
  document.getElementById('mostrar_email').checked = !!perfil.mostrar_email;
  document.getElementById('activo').checked = !!perfil.activo;
  document.getElementById('slug').value = perfil.slug || '';

  // "Es WhatsApp" se considera activo si el teléfono y whatsapp guardados coinciden (o whatsapp está vacío)
  checkEsWhatsapp.checked = !perfil.whatsapp || perfil.whatsapp === perfil.telefono;
  actualizarVisibilidadWhatsapp();

  renderCamposRedes(perfil.redes || {});

  colorPrimario = esHexValido(perfil.tema_color_primario) ? perfil.tema_color_primario : CONFIG.TEMA_PRIMARIO_DEFECTO;
  colorSecundario = esHexValido(perfil.tema_color_secundario) ? perfil.tema_color_secundario : CONFIG.TEMA_SECUNDARIO_DEFECTO;
  fuenteTitulo = CONFIG.FUENTES_DISPONIBLES.includes(perfil.tema_fuente_titulo) ? perfil.tema_fuente_titulo : CONFIG.FUENTE_TITULO_DEFECTO;
  fuenteTexto = CONFIG.FUENTES_DISPONIBLES.includes(perfil.tema_fuente_texto) ? perfil.tema_fuente_texto : CONFIG.FUENTE_TEXTO_DEFECTO;
  cargarGoogleFont(fuenteTitulo);
  cargarGoogleFont(fuenteTexto);
  renderSelectoresFuentes();
  sincronizarInputsDeColor();
  aplicarTemaPreview();

  actualizarPreview(perfil);

  const linkPerfil = `${CONFIG.SITE_BASE_URL}/u/${perfil.slug}`;
  document.getElementById('link-ver-perfil').href = linkPerfil;
  document.getElementById('slug-prefijo').textContent = CONFIG.SITE_BASE_URL.replace(/^https?:\/\//, '') + '/u/';
  document.getElementById('qr-link').textContent = linkPerfil;

  renderizarQR('qr-contenedor', linkPerfil);
}

function actualizarPreview(perfil) {
  document.getElementById('preview-nombre').textContent = perfil.nombre_completo || 'Edwin García Flores';
  document.getElementById('preview-cargo').textContent = [perfil.cargo, perfil.empresa].filter(Boolean).join(' · ') || 'Arquitecto · Estudio XYZ';

  const bioEl = document.getElementById('preview-bio');
  if (perfil.bio) {
    bioEl.textContent = perfil.bio;
    bioEl.classList.remove('tarjeta-preview__bio--vacio');
  } else {
    bioEl.textContent = 'Soy un profesional apasionado por mi trabajo y siempre busco nuevas oportunidades para crecer y aprender.';
    bioEl.classList.add('tarjeta-preview__bio--vacio');
  }

  const avatar = document.getElementById('preview-avatar');
  const placeholder = document.getElementById('preview-avatar-placeholder');
  if (perfil.foto_url) {
    avatar.src = perfil.foto_url;
    if (placeholder) placeholder.style.display = 'none';
  } else {
    avatar.removeAttribute('src');
    if (placeholder) placeholder.style.display = 'flex';
  }

  const redesCont = document.getElementById('preview-redes');
  const redesEntries = Object.entries(perfil.redes || {});
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
  if (perfil.telefono) items.push(fila('telefono', 'Teléfono', perfil.telefono));
  if (perfil.whatsapp && perfil.whatsapp !== perfil.telefono) items.push(fila('whatsapp', 'WhatsApp', perfil.whatsapp));
  if (perfil.direccion) items.push(fila('direccion', 'Ubicación', perfil.direccion));
  if (perfil.horario_atencion) items.push(fila('horario', 'Horario', perfil.horario_atencion));
  contactoCont.innerHTML = items.join('') || '<p class="tarjeta-preview__contacto-vacio">Tus datos de contacto aparecerán aquí.</p>';
}

function recolectarCambios() {
  const cambios = {};
  CAMPOS_TEXTO.forEach(id => { cambios[id] = document.getElementById(id).value.trim(); });
  cambios.mostrar_email = document.getElementById('mostrar_email').checked;
  cambios.activo = document.getElementById('activo').checked;
  cambios.tema_color_primario = colorPrimario;
  cambios.tema_color_secundario = colorSecundario;
  cambios.tema_fuente_titulo = fuenteTitulo;
  cambios.tema_fuente_texto = fuenteTexto;
  if (checkEsWhatsapp.checked) cambios.whatsapp = cambios.telefono;
  cambios.redes = {};
  CONFIG.REDES_SOCIALES.forEach(r => {
    const el = document.getElementById(`red_${r.key}`);
    if (el && el.value.trim()) cambios.redes[r.key] = el.value.trim();
  });
  return cambios;
}

// ------------------------------------------------------------
// Foto de perfil: preview inmediata al elegir archivo (no esperar
// a "Guardar cambios"), igual que en el wizard.
// ------------------------------------------------------------
document.getElementById('avatar-file').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  document.getElementById('preview-avatar').src = URL.createObjectURL(archivo);
  const placeholder = document.getElementById('preview-avatar-placeholder');
  if (placeholder) placeholder.style.display = 'none';
});

// ------------------------------------------------------------
// Galería: render + subir + borrar (con compresión cliente, ADR-005)
// ------------------------------------------------------------
function renderGaleria() {
  const grid = document.getElementById('galeria-grid');
  const contador = document.getElementById('galeria-contador');
  contador.textContent = `${galeriaActual.length} de ${CONFIG.GALERIA_MAX_FOTOS} fotos usadas`;

  grid.innerHTML = galeriaActual.map(foto => `
    <div class="galeria-item" data-id="${foto.id}">
      <img src="${escapeHtml(foto.url)}" alt="Foto de galería">
      <button type="button" class="galeria-item__borrar" data-borrar-id="${foto.id}" data-borrar-path="${escapeHtml(foto.storage_path)}" aria-label="Borrar foto">&times;</button>
    </div>
  `).join('');

  grid.querySelectorAll('[data-borrar-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.borrarId;
      const path = btn.dataset.borrarPath;
      btn.disabled = true;
      try {
        await eliminarFotoGaleria(id, path);
        galeriaActual = galeriaActual.filter(f => f.id !== id);
        renderGaleria();
      } catch (err) {
        console.error(err);
        document.getElementById('galeria-error').textContent = 'No se pudo borrar la foto.';
        document.getElementById('galeria-error').style.display = 'block';
        btn.disabled = false;
      }
    });
  });

  document.getElementById('galeria-file').disabled = galeriaActual.length >= CONFIG.GALERIA_MAX_FOTOS;
}

document.getElementById('galeria-file').addEventListener('change', async (e) => {
  const errorEl = document.getElementById('galeria-error');
  errorEl.style.display = 'none';
  const archivos = Array.from(e.target.files);
  e.target.value = '';

  const espacioDisponible = CONFIG.GALERIA_MAX_FOTOS - galeriaActual.length;
  if (espacioDisponible <= 0) {
    errorEl.textContent = `Ya tienes el máximo de ${CONFIG.GALERIA_MAX_FOTOS} fotos. Borra alguna para agregar otra.`;
    errorEl.style.display = 'block';
    return;
  }

  const aSubir = archivos.slice(0, espacioDisponible);
  if (archivos.length > espacioDisponible) {
    errorEl.textContent = `Solo se subirán ${espacioDisponible} foto(s); ya alcanzaste el límite de ${CONFIG.GALERIA_MAX_FOTOS}.`;
    errorEl.style.display = 'block';
  }

  for (const archivo of aSubir) {
    try {
      if (archivo.size > CONFIG.GALERIA_MAX_MB * 1024 * 1024) {
        throw new Error(`"${archivo.name}" supera ${CONFIG.GALERIA_MAX_MB}MB.`);
      }
      const blob = await comprimirImagen(archivo, CONFIG.GALERIA_RESIZE_MAX_PX, CONFIG.GALERIA_JPEG_CALIDAD);
      if (blob.size > CONFIG.POST_COMPRESION_MAX_KB * 1024) {
        throw new Error(`"${archivo.name}" sigue siendo muy pesada después de comprimir.`);
      }
      const orden = galeriaActual.length;
      const nueva = await agregarFotoGaleria(sesion.user.id, perfilActual.id, blob, orden);
      galeriaActual.push(nueva);
      renderGaleria();
    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || 'No se pudo subir una de las fotos.';
      errorEl.style.display = 'block';
    }
  }
});

// ------------------------------------------------------------
// Avatar elegido durante el wizard (antes de tener cuenta): viaja
// como miniatura base64 en user_metadata y se sube a Storage en el
// primer ingreso al dashboard. Ver ADR-007.
// ------------------------------------------------------------
async function importarAvatarPendienteSiExiste() {
  if (perfilActual.foto_url) return; // ya tiene avatar, nada que importar

  const b64 = sesion.user.user_metadata?.avatar_pendiente_b64;
  if (!b64) return;

  try {
    const blob = await base64ADataBlob(b64);
    const foto_url = await subirAvatar(sesion.user.id, blob);
    perfilActual = await actualizarPerfil(sesion.user.id, { foto_url });

    // Limpiar la miniatura de metadata para no seguir cargando el JWT
    const supabase = await getSupabaseClient();
    await supabase.auth.updateUser({ data: { avatar_pendiente_b64: null } });
  } catch (err) {
    console.warn('No se pudo importar el avatar del registro:', err);
  }
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
async function init() {
  sesion = await protegerPagina('login.html');
  if (!sesion) return;

  try {
    perfilActual = await obtenerMiPerfil(sesion.user.id);
    if (!perfilActual) {
      document.getElementById('estado-carga').innerHTML =
        '<p>Tu cuenta aún no tiene una tarjeta asociada. Si acabas de confirmar tu correo, espera unos segundos y recarga la página.</p>';
      return;
    }

    await importarAvatarPendienteSiExiste();

    llenarFormulario(perfilActual);
    galeriaActual = await obtenerGaleria(perfilActual.id);
    renderGaleria();
    document.getElementById('estado-carga').style.display = 'none';
    document.getElementById('dashboard-contenido').style.display = 'block';
  } catch (err) {
    console.error(err);
    document.getElementById('estado-carga').innerHTML = '<p>No se pudo cargar tu panel. Intenta recargar la página.</p>';
  }
}

// ------------------------------------------------------------
// Vista previa en vivo: refleja lo que se va escribiendo en el
// formulario, no solo lo que ya está guardado (igual que el wizard).
// ------------------------------------------------------------
function actualizarPreviewEnVivo() {
  if (!perfilActual) return;
  actualizarPreview({ ...perfilActual, ...recolectarCambios() });
}
document.getElementById('form-dashboard').addEventListener('input', actualizarPreviewEnVivo);
document.getElementById('form-dashboard').addEventListener('change', actualizarPreviewEnVivo);

// Íconos de redes/contacto cargados de forma asíncrona (Simple Icons/Lucide,
// ver utils.js): al terminar de llegar se repinta la preview.
window.addEventListener('qr-iconos-listos', actualizarPreviewEnVivo);

document.getElementById('form-dashboard').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('guardar-error');
  const exitoEl = document.getElementById('guardar-exito');
  errorEl.style.display = 'none';
  exitoEl.style.display = 'none';

  try {
    const avatarFile = document.getElementById('avatar-file').files[0];
    let foto_url = perfilActual.foto_url;
    if (avatarFile) {
      if (avatarFile.size > CONFIG.AVATAR_MAX_MB * 1024 * 1024) {
        throw new Error(`La foto no debe superar ${CONFIG.AVATAR_MAX_MB}MB`);
      }
      const blob = await comprimirImagen(avatarFile, CONFIG.AVATAR_RESIZE_MAX_PX, CONFIG.AVATAR_JPEG_CALIDAD);
      foto_url = await subirAvatar(sesion.user.id, blob);
    }

    const cambios = { ...recolectarCambios(), foto_url };
    perfilActual = await actualizarPerfil(sesion.user.id, cambios);
    llenarFormulario(perfilActual);
    exitoEl.textContent = 'Cambios guardados correctamente.';
    exitoEl.style.display = 'block';
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message || 'No se pudieron guardar los cambios.';
    errorEl.style.display = 'block';
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '../index.html';
});

document.getElementById('btn-descargar-qr').addEventListener('click', () => {
  descargarQR('qr-contenedor', `${perfilActual?.slug || 'mi'}-qr.png`);
});

init();
