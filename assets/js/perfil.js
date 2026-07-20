// ============================================================
// PERFIL PÚBLICO (pages/perfil.html?u=slug)
// ============================================================
import { CONFIG } from './config.js';
import { obtenerPerfilPublico, obtenerGaleria, obtenerHorariosOcupados, crearCita } from './supabase-data.js';
import { descargarVcf } from './vcard.js';
import {
  escapeHtml, soloDigitos, esHexValido, colorTextoLegible, mezclarConBlanco,
  iconoRedSocial, iconoContacto, cargarGoogleFont,
  formatearHorarioAtencion, generarSlotsHorario, formatearHora12h, enviarNotificacionCita,
} from './utils.js';

function obtenerSlugDeUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('u');
}

function embedVideo(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      return `<iframe src="https://www.youtube.com/embed/${id}" title="Video" allowfullscreen loading="lazy"></iframe>`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return `<iframe src="https://player.vimeo.com/video/${id}" title="Video" allowfullscreen loading="lazy"></iframe>`;
    }
  } catch { /* URL inválida, se ignora */ }
  return '';
}

/**
 * Aplica la paleta de color libre elegida por el usuario (sección
 * "Diseño") a esta página pública. El color de texto sobre el header
 * se calcula automáticamente para mantener buen contraste sin
 * importar qué color haya elegido (ver ADR-006 y utils.colorTextoLegible).
 */
function aplicarTema(perfil) {
  const primario = esHexValido(perfil.tema_color_primario) ? perfil.tema_color_primario : CONFIG.TEMA_PRIMARIO_DEFECTO;
  const secundario = esHexValido(perfil.tema_color_secundario) ? perfil.tema_color_secundario : CONFIG.TEMA_SECUNDARIO_DEFECTO;
  const root = document.documentElement.style;
  root.setProperty('--color-primary', primario);
  root.setProperty('--color-primary-dark', secundario);
  root.setProperty('--color-primary-light', mezclarConBlanco(primario, 0.85));
  root.setProperty('--color-on-primary', colorTextoLegible(primario));

  const fuenteTitulo = CONFIG.FUENTES_DISPONIBLES.includes(perfil.tema_fuente_titulo) ? perfil.tema_fuente_titulo : CONFIG.FUENTE_TITULO_DEFECTO;
  const fuenteTexto = CONFIG.FUENTES_DISPONIBLES.includes(perfil.tema_fuente_texto) ? perfil.tema_fuente_texto : CONFIG.FUENTE_TEXTO_DEFECTO;
  cargarGoogleFont(fuenteTitulo);
  cargarGoogleFont(fuenteTexto);
  root.setProperty('--font-heading', `'${fuenteTitulo}', sans-serif`);
  root.setProperty('--font-body', `'${fuenteTexto}', sans-serif`);
}

let _ultimoPerfilRenderizado = null;

/** Pinta redes sociales + lista de contacto (íconos vía Simple Icons/Lucide, ver utils.js) */
function pintarIconos(perfil) {
  const redesCont = document.getElementById('p-redes');
  redesCont.innerHTML = Object.entries(perfil.redes || {}).map(([key, url]) => {
    const label = CONFIG.REDES_SOCIALES.find(r => r.key === key)?.label || key;
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${escapeHtml(label)}">${iconoRedSocial(key)}</a>`;
  }).join('');

  // Contacto: fila con ícono + etiqueta + valor (el valor puede ser un link o texto plano)
  const filaContacto = (icono, label, valorHtml) => `
    <div class="tarjeta-preview__contacto-item">
      <span class="tarjeta-preview__contacto-icono">${iconoContacto(icono)}</span>
      <span class="tarjeta-preview__contacto-texto">
        <span class="tarjeta-preview__contacto-label">${escapeHtml(label)}</span>
        ${valorHtml}
      </span>
    </div>`;
  const contactoItems = [];
  if (perfil.telefono) {
    contactoItems.push(filaContacto('telefono', 'Teléfono', `<a class="tarjeta-preview__contacto-valor" href="tel:${soloDigitos(perfil.telefono)}">${escapeHtml(perfil.telefono)}</a>`));
  }
  if (perfil.mostrar_email && perfil.email_contacto) {
    contactoItems.push(filaContacto('email', 'E-mail', `<a class="tarjeta-preview__contacto-valor" href="mailto:${escapeHtml(perfil.email_contacto)}">${escapeHtml(perfil.email_contacto)}</a>`));
  }
  if (perfil.redes?.web) {
    contactoItems.push(filaContacto('web', 'Sitio web', `<a class="tarjeta-preview__contacto-valor" href="${escapeHtml(perfil.redes.web)}" target="_blank" rel="noopener">${escapeHtml(perfil.redes.web.replace(/^https?:\/\//, ''))}</a>`));
  }
  if (perfil.direccion) {
    contactoItems.push(filaContacto('direccion', 'Ubicación', `<span class="tarjeta-preview__contacto-valor">${escapeHtml(perfil.direccion)}</span>`));
  }
  document.getElementById('p-contacto').innerHTML = contactoItems.join('') || '<p class="form-hint">Sin datos de contacto públicos.</p>';
}

async function render(perfil) {
  _ultimoPerfilRenderizado = perfil;
  aplicarTema(perfil);
  document.title = `${perfil.nombre_completo} | QR Personal System`;
  document.getElementById('p-nombre').textContent = perfil.nombre_completo || '';
  document.getElementById('p-cargo').textContent = [perfil.cargo, perfil.empresa].filter(Boolean).join(' · ');
  document.getElementById('p-bio').textContent = perfil.bio || '';

  const avatar = document.getElementById('p-avatar');
  const AVATAR_FALLBACK_SVG = '../assets/images/logo.svg';
  avatar.src = perfil.foto_url || AVATAR_FALLBACK_SVG;
  avatar.onerror = () => { avatar.onerror = null; avatar.src = AVATAR_FALLBACK_SVG; };
  avatar.alt = perfil.nombre_completo || 'Foto de perfil';

  pintarIconos(perfil);

  // WhatsApp
  if (perfil.whatsapp) {
    const btnWa = document.getElementById('p-whatsapp-link');
    btnWa.href = `https://wa.me/${soloDigitos(perfil.whatsapp)}`;
    btnWa.style.display = 'inline-flex';
  }

  // Video
  if (perfil.video_url) {
    const embed = embedVideo(perfil.video_url);
    if (embed) {
      document.getElementById('p-video').innerHTML = embed;
      document.getElementById('p-video-card').style.display = 'block';
    }
  }

  // Horario
  const horarioTexto = formatearHorarioAtencion(perfil, CONFIG.DIAS_SEMANA);
  if (horarioTexto) {
    document.getElementById('p-horario').textContent = horarioTexto;
    document.getElementById('p-horario-card').style.display = 'block';
  }

  // Botón "Agendar una cita": solo si el dueño lo activó y configuró horario
  if (perfil.permitir_citas && perfil.dias_atencion?.length && perfil.hora_desde_atencion && perfil.hora_hasta_atencion) {
    const btn = document.getElementById('btn-agendar-cita');
    btn.style.display = 'inline-flex';
    btn.addEventListener('click', () => abrirModalCita(perfil));
  }

  // Galería (mini-portafolio): imagen + título + descripción + enlace opcional
  try {
    const fotos = await obtenerGaleria(perfil.id);
    if (fotos.length) {
      document.getElementById('p-galeria').innerHTML = fotos.map(f => `
        <div class="perfil-galeria__item">
          <img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.titulo || 'Foto de galería')}" loading="lazy">
          ${(f.titulo || f.descripcion || f.url_link) ? `
            <div class="perfil-galeria__item-texto">
              ${f.titulo ? `<p class="perfil-galeria__item-titulo">${escapeHtml(f.titulo)}</p>` : ''}
              ${f.descripcion ? `<p class="perfil-galeria__item-desc">${escapeHtml(f.descripcion)}</p>` : ''}
              ${f.url_link ? `<a class="perfil-galeria__item-link" href="${escapeHtml(f.url_link)}" target="_blank" rel="noopener">Ver más →</a>` : ''}
            </div>` : ''}
        </div>
      `).join('');
      document.getElementById('p-galeria-card').style.display = 'block';

      document.querySelectorAll('#p-galeria .perfil-galeria__item img').forEach(img => {
        img.addEventListener('click', () => abrirLightbox(img.src, img.alt));
      });
    }
  } catch (err) {
    console.warn('No se pudo cargar la galería:', err);
  }

  document.getElementById('btn-guardar-contacto').addEventListener('click', () => descargarVcf(perfil));

  document.getElementById('estado-carga').style.display = 'none';
  document.getElementById('perfil-contenido').style.display = 'block';
}

async function init() {
  const slug = obtenerSlugDeUrl();
  if (!slug) {
    document.getElementById('estado-carga').style.display = 'none';
    document.getElementById('estado-no-encontrado').style.display = 'block';
    return;
  }
  try {
    const perfil = await obtenerPerfilPublico(slug);
    if (!perfil) {
      document.getElementById('estado-carga').style.display = 'none';
      document.getElementById('estado-no-encontrado').style.display = 'block';
      return;
    }
    await render(perfil);
  } catch (err) {
    console.error(err);
    document.getElementById('estado-carga').style.display = 'none';
    document.getElementById('estado-no-encontrado').style.display = 'block';
  }
}

// Íconos cargados de forma asíncrona (Simple Icons/Lucide, ver utils.js):
// al terminar de llegar se repintan sobre el perfil ya renderizado.
window.addEventListener('qr-iconos-listos', () => {
  if (_ultimoPerfilRenderizado) pintarIconos(_ultimoPerfilRenderizado);
});

// ------------------------------------------------------------
// Lightbox de la galería: click en una foto la agranda en el centro;
// click fuera de la imagen (fondo oscuro), en la X o tecla Esc la
// vuelve a encoger a su lugar.
// ------------------------------------------------------------
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

function abrirLightbox(src, alt) {
  lightboxImg.src = src;
  lightboxImg.alt = alt || '';
  lightbox.classList.add('lightbox--visible');
  lightbox.setAttribute('aria-hidden', 'false');
}

function cerrarLightbox() {
  lightbox.classList.remove('lightbox--visible');
  lightbox.setAttribute('aria-hidden', 'true');
}

// Cierra al hacer click en el fondo, pero no si el click fue sobre la
// imagen agrandada (solo "fuera de la imagen" debe encogerla).
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) cerrarLightbox();
});
document.getElementById('lightbox-cerrar').addEventListener('click', cerrarLightbox);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarLightbox();
});

// ------------------------------------------------------------
// Módulo "Agendar una cita": calendario mensual -> horarios
// disponibles ese día -> formulario -> confirmación.
// La validación real (horario disponible, sin duplicados) ocurre en
// el servidor vía la RPC crear_cita (ver functions.sql); aquí solo se
// filtra para UNA buena experiencia, nunca como única barrera.
// ------------------------------------------------------------
const DIA_JS_A_VALOR = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const citaModal = document.getElementById('cita-modal');
let perfilCita = null;
let citaMesActual = null; // Date, día 1 del mes mostrado
let citaFechaSeleccionada = null; // "YYYY-MM-DD"
let citaHoraSeleccionada = null; // "HH:MM"

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mostrarPasoCita(paso) {
  ['calendario', 'horarios', 'formulario', 'confirmacion'].forEach(p => {
    document.getElementById(`cita-paso-${p}`).style.display = p === paso ? 'block' : 'none';
  });
}

function abrirModalCita(perfil) {
  perfilCita = perfil;
  citaFechaSeleccionada = null;
  citaHoraSeleccionada = null;
  const hoy = new Date();
  citaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  mostrarPasoCita('calendario');
  renderCalendarioCita();
  citaModal.classList.add('cita-modal--visible');
  citaModal.setAttribute('aria-hidden', 'false');
}

function cerrarModalCita() {
  citaModal.classList.remove('cita-modal--visible');
  citaModal.setAttribute('aria-hidden', 'true');
  document.getElementById('form-cita').reset();
  document.getElementById('cita-error').style.display = 'none';
}

function renderCalendarioCita() {
  document.getElementById('cita-dias-semana').innerHTML = CONFIG.DIAS_SEMANA.map(d => `<span>${d.label}</span>`).join('');
  document.getElementById('cita-mes-actual').textContent =
    citaMesActual.toLocaleDateString('es', { month: 'long', year: 'numeric' });

  const anio = citaMesActual.getFullYear();
  const mes = citaMesActual.getMonth();
  const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7; // 0 = lunes (para alinear con DIAS_SEMANA)
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const hoy = hoyISO();

  const celdas = [];
  for (let i = 0; i < primerDiaSemana; i++) celdas.push('<span class="cita-dia cita-dia--vacio"></span>');

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = new Date(anio, mes, dia);
    const fechaISO = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const diaSemanaValor = DIA_JS_A_VALOR[fecha.getDay()];
    const habilitado = fechaISO >= hoy && (perfilCita.dias_atencion || []).includes(diaSemanaValor);
    const esHoy = fechaISO === hoy;
    celdas.push(
      `<button type="button" class="cita-dia ${esHoy ? 'cita-dia--hoy' : ''}" data-fecha="${fechaISO}" ${habilitado ? '' : 'disabled'}>${dia}</button>`
    );
  }

  document.getElementById('cita-calendario-grid').innerHTML = celdas.join('');
  document.querySelectorAll('#cita-calendario-grid [data-fecha]:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => seleccionarFechaCita(btn.dataset.fecha));
  });

  // No permitir navegar a meses anteriores al actual
  const inicioMesReal = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  document.getElementById('cita-mes-anterior').disabled = citaMesActual <= inicioMesReal;
}

document.getElementById('cita-mes-anterior').addEventListener('click', () => {
  citaMesActual = new Date(citaMesActual.getFullYear(), citaMesActual.getMonth() - 1, 1);
  renderCalendarioCita();
});
document.getElementById('cita-mes-siguiente').addEventListener('click', () => {
  citaMesActual = new Date(citaMesActual.getFullYear(), citaMesActual.getMonth() + 1, 1);
  renderCalendarioCita();
});

async function seleccionarFechaCita(fechaISO) {
  citaFechaSeleccionada = fechaISO;
  mostrarPasoCita('horarios');
  const fechaLegible = new Date(fechaISO + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('cita-fecha-elegida').textContent = fechaLegible;

  const grid = document.getElementById('cita-horarios-grid');
  const sinHorarios = document.getElementById('cita-sin-horarios');
  grid.innerHTML = '<p class="form-hint">Cargando horarios...</p>';
  sinHorarios.style.display = 'none';

  try {
    const ocupados = await obtenerHorariosOcupados(perfilCita.slug, fechaISO);
    let slots = generarSlotsHorario(
      perfilCita.hora_desde_atencion.slice(0, 5),
      perfilCita.hora_hasta_atencion.slice(0, 5),
      perfilCita.duracion_cita_min || CONFIG.DURACION_CITA_DEFECTO
    ).filter(s => !ocupados.includes(s));

    if (fechaISO === hoyISO()) {
      const ahora = new Date();
      const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
      slots = slots.filter(s => {
        const [h, m] = s.split(':').map(Number);
        return h * 60 + m > minutosAhora;
      });
    }

    if (!slots.length) {
      grid.innerHTML = '';
      sinHorarios.style.display = 'block';
      return;
    }
    grid.innerHTML = slots.map(s => `<button type="button" class="cita-horario-slot" data-hora="${s}">${formatearHora12h(s)}</button>`).join('');
    grid.querySelectorAll('[data-hora]').forEach(btn => {
      btn.addEventListener('click', () => seleccionarHoraCita(btn.dataset.hora));
    });
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="form-error">No se pudieron cargar los horarios. Intenta de nuevo.</p>';
  }
}

function seleccionarHoraCita(hora) {
  citaHoraSeleccionada = hora;
  mostrarPasoCita('formulario');
  const fechaLegible = new Date(citaFechaSeleccionada + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('cita-resumen-elegido').textContent = `${fechaLegible} · ${formatearHora12h(hora)}`;
}

document.querySelectorAll('.cita-volver').forEach(btn => {
  btn.addEventListener('click', () => mostrarPasoCita(btn.dataset.volver));
});

document.getElementById('form-cita').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('cita-error');
  errorEl.style.display = 'none';
  const btn = document.getElementById('btn-confirmar-cita');
  btn.disabled = true;
  btn.textContent = 'Agendando...';

  const nombre = document.getElementById('cita-nombre').value.trim();
  const email = document.getElementById('cita-email').value.trim();
  const descripcion = document.getElementById('cita-descripcion').value.trim();

  try {
    await crearCita({
      slug: perfilCita.slug,
      nombre, email, descripcion,
      fecha: citaFechaSeleccionada,
      hora: citaHoraSeleccionada,
    });

    // Notificación por email al dueño (opcional, ver CONFIG.EMAILJS_*; si no
    // está configurado esto simplemente no hace nada, la cita ya se guardó).
    enviarNotificacionCita({
      to_email: perfilCita.email_contacto,
      nombre_perfil: perfilCita.nombre_completo,
      nombre_solicitante: nombre,
      email_solicitante: email,
      fecha: citaFechaSeleccionada,
      hora: formatearHora12h(citaHoraSeleccionada),
      descripcion: descripcion || '(sin descripción)',
    });

    const fechaLegible = new Date(citaFechaSeleccionada + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('cita-confirmacion-detalle').textContent =
      `${fechaLegible} a las ${formatearHora12h(citaHoraSeleccionada)} con ${perfilCita.nombre_completo}.`;
    mostrarPasoCita('confirmacion');
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message?.includes('reservado')
      ? 'Ese horario ya fue reservado por alguien más. Elige otro.'
      : 'No se pudo agendar la cita. Intenta de nuevo.';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar cita';
  }
});

document.getElementById('btn-cerrar-confirmacion').addEventListener('click', cerrarModalCita);
document.getElementById('cita-modal-cerrar').addEventListener('click', cerrarModalCita);
citaModal.addEventListener('click', (e) => { if (e.target === citaModal) cerrarModalCita(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && citaModal.classList.contains('cita-modal--visible')) cerrarModalCita();
});

init();
