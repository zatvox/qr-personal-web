// ============================================================
// DASHBOARD (pages/dashboard.html) — edición del perfil propio
// ============================================================
import { CONFIG } from './config.js';
import { protegerPagina, cerrarSesion } from './auth.js';
import {
  obtenerMiPerfil, actualizarPerfil, subirAvatar,
  obtenerCitas, eliminarCita,
} from './supabase-data.js';
import { iniciarEditorPortafolio, actualizarPerfilEnEditor } from './portafolio-editor.js';
import { iniciarEditorTarjeta, actualizarPerfilEnTarjeta } from './tarjeta-editor.js';
import { obtenerEstadisticas, pintarEstadisticas } from './estadisticas.js';
import { linkQuieroPro } from './planes.js';
import { esAdmin } from './admin-data.js';
import { renderizarQR, descargarQR } from './qr.js';
import { escapeHtml, comprimirImagen, base64ADataBlob, esHexValido, mezclarConBlanco, iconoRedSocial, iconoContacto, cargarGoogleFont, colorTextoLegible, debounce, formatearHorarioAtencion, formatearHora12h } from './utils.js';
import { getSupabaseClient } from './supabase-client.js';

const CAMPOS_TEXTO = ['nombre_completo', 'cargo', 'empresa', 'bio', 'telefono', 'whatsapp', 'direccion', 'video_url'];

let sesion = null;
let perfilActual = null;
let colorPrimario = CONFIG.TEMA_PRIMARIO_DEFECTO;
let colorSecundario = CONFIG.TEMA_SECUNDARIO_DEFECTO;
let fuenteTitulo = CONFIG.FUENTE_TITULO_DEFECTO;
let fuenteTexto = CONFIG.FUENTE_TEXTO_DEFECTO;
let diasAtencionSeleccionados = [];

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

// ------------------------------------------------------------
// Horario de atención: días (chips) + desde/hasta + duración de cita
// ------------------------------------------------------------
const diasSemanaPicker = document.getElementById('dias-semana-picker');
const inputHoraDesde = document.getElementById('hora-desde');
const inputHoraHasta = document.getElementById('hora-hasta');
const selectDuracionCita = document.getElementById('duracion-cita');

function renderDiasSemana() {
  diasSemanaPicker.innerHTML = CONFIG.DIAS_SEMANA.map(d => `
    <button type="button" class="dia-semana-chip ${diasAtencionSeleccionados.includes(d.valor) ? 'seleccionado' : ''}" data-dia="${d.valor}">${d.label}</button>
  `).join('');
  diasSemanaPicker.querySelectorAll('[data-dia]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dia = btn.dataset.dia;
      diasAtencionSeleccionados = diasAtencionSeleccionados.includes(dia)
        ? diasAtencionSeleccionados.filter(d => d !== dia)
        : [...diasAtencionSeleccionados, dia];
      renderDiasSemana();
      actualizarResumenHorario();
      actualizarPreviewEnVivo();
    });
  });
}

function renderSelectorDuracion() {
  selectDuracionCita.innerHTML = CONFIG.DURACIONES_CITA_DISPONIBLES
    .map(min => `<option value="${min}">${min} min</option>`).join('');
}

function actualizarResumenHorario() {
  const resumen = document.getElementById('horario-resumen');
  if (!diasAtencionSeleccionados.length || !inputHoraDesde.value || !inputHoraHasta.value) {
    resumen.textContent = 'Configura tus días y horario para que el módulo de citas funcione.';
    return;
  }
  const labels = CONFIG.DIAS_SEMANA.filter(d => diasAtencionSeleccionados.includes(d.valor)).map(d => d.label);
  resumen.textContent = `${labels.join(', ')} · ${inputHoraDesde.value} a ${inputHoraHasta.value} (bloques de ${selectDuracionCita.value} min)`;
}
[inputHoraDesde, inputHoraHasta, selectDuracionCita].forEach(el => el.addEventListener('input', actualizarResumenHorario));

function llenarFormulario(perfil) {
  CAMPOS_TEXTO.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = perfil[id] || '';
  });
  document.getElementById('mostrar_email').checked = !!perfil.mostrar_email;
  document.getElementById('activo').checked = !!perfil.activo;
  document.getElementById('permitir_citas').checked = !!perfil.permitir_citas;
  document.getElementById('portafolio_titulo').value = perfil.portafolio_titulo || 'Portafolio';
  document.getElementById('portafolio_label_a').value = perfil.portafolio_label_a || '';
  document.getElementById('portafolio_label_b').value = perfil.portafolio_label_b || '';
  document.getElementById('mostrar_portafolio').checked = perfil.mostrar_portafolio !== false;
  document.getElementById('slug').value = perfil.slug || '';

  diasAtencionSeleccionados = Array.isArray(perfil.dias_atencion) ? [...perfil.dias_atencion] : [];
  renderDiasSemana();
  renderSelectorDuracion();
  inputHoraDesde.value = perfil.hora_desde_atencion ? perfil.hora_desde_atencion.slice(0, 5) : '';
  inputHoraHasta.value = perfil.hora_hasta_atencion ? perfil.hora_hasta_atencion.slice(0, 5) : '';
  selectDuracionCita.value = perfil.duracion_cita_min || CONFIG.DURACION_CITA_DEFECTO;
  actualizarResumenHorario();

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

  renderizarQR('qr-contenedor', `${linkPerfil}?s=qr`); // ?s=qr: así se cuentan los escaneos
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
  const horarioTexto = formatearHorarioAtencion(perfil, CONFIG.DIAS_SEMANA);
  if (horarioTexto) items.push(fila('horario', 'Horario', horarioTexto));
  contactoCont.innerHTML = items.join('') || '<p class="tarjeta-preview__contacto-vacio">Tus datos de contacto aparecerán aquí.</p>';
}

function recolectarCambios() {
  const cambios = {};
  CAMPOS_TEXTO.forEach(id => { cambios[id] = document.getElementById(id).value.trim(); });
  cambios.mostrar_email = document.getElementById('mostrar_email').checked;
  cambios.permitir_citas = document.getElementById('permitir_citas').checked;
  cambios.portafolio_titulo = document.getElementById('portafolio_titulo').value.trim() || 'Portafolio';
  cambios.portafolio_label_a = document.getElementById('portafolio_label_a').value.trim();
  cambios.portafolio_label_b = document.getElementById('portafolio_label_b').value.trim();
  cambios.mostrar_portafolio = document.getElementById('mostrar_portafolio').checked;
  cambios.dias_atencion = diasAtencionSeleccionados;
  cambios.hora_desde_atencion = inputHoraDesde.value || null;
  cambios.hora_hasta_atencion = inputHoraHasta.value || null;
  cambios.duracion_cita_min = Number(selectDuracionCita.value) || CONFIG.DURACION_CITA_DEFECTO;
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
// Portafolio: toda la lógica vive en portafolio-editor.js
// (reemplazó a la antigua galería; gallery_images queda solo como
// respaldo de la migración 007).
// ------------------------------------------------------------

// ------------------------------------------------------------
// Citas recibidas: lista de solo lectura + botón para descartar
// ------------------------------------------------------------
async function cargarCitas() {
  const lista = document.getElementById('citas-lista');
  const contador = document.getElementById('citas-contador');
  try {
    const citas = await obtenerCitas(perfilActual.id);
    contador.textContent = citas.length
      ? `${citas.length} cita${citas.length === 1 ? '' : 's'} agendada${citas.length === 1 ? '' : 's'}`
      : 'Sin citas agendadas';

    if (!citas.length) {
      lista.innerHTML = '<p class="form-hint">Todavía no tienes citas agendadas.</p>';
      return;
    }

    lista.innerHTML = citas.map(c => `
      <div class="cita-item" data-id="${c.id}">
        <div class="cita-item__fecha">${c.fecha}<br>${formatearHora12h(c.hora.slice(0, 5))}</div>
        <div class="cita-item__detalle">
          <div class="cita-item__nombre">${escapeHtml(c.nombre_solicitante)}</div>
          <div class="cita-item__email">${escapeHtml(c.email_solicitante)}</div>
          ${c.descripcion ? `<div class="cita-item__desc">${escapeHtml(c.descripcion)}</div>` : ''}
        </div>
        <button type="button" class="cita-item__borrar" data-borrar-cita="${c.id}" aria-label="Descartar cita" title="Descartar">&times;</button>
      </div>
    `).join('');

    lista.querySelectorAll('[data-borrar-cita]').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await eliminarCita(btn.dataset.borrarCita);
          await cargarCitas();
        } catch (err) {
          console.error(err);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error(err);
    lista.innerHTML = '<p class="form-error">No se pudieron cargar tus citas.</p>';
  }
}

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
async function cargarEstadisticas() {
  const el = document.getElementById('stats-contenedor');
  try {
    pintarEstadisticas(el, await obtenerEstadisticas(), { linkPro: linkQuieroPro(perfilActual) });
  } catch (err) {
    console.error(err);
    el.innerHTML = '<p class="form-hint">Las estadísticas estarán disponibles al activar la migración 008.</p>';
  }
}

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
    iniciarEditorPortafolio({ userId: sesion.user.id, perfil: perfilActual });
    iniciarEditorTarjeta({ userId: sesion.user.id, perfil: perfilActual });
    cargarEstadisticas();
    cargarCitas();
    esAdmin().then(ok => { if (ok) document.getElementById('link-admin').style.display = ''; });
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
    actualizarPerfilEnEditor(perfilActual);
    actualizarPerfilEnTarjeta(perfilActual);
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
