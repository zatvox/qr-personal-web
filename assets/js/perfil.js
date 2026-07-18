// ============================================================
// PERFIL PÚBLICO (pages/perfil.html?u=slug)
// ============================================================
import { CONFIG } from './config.js';
import { obtenerPerfilPublico, obtenerGaleria } from './supabase-data.js';
import { descargarVcf } from './vcard.js';
import { escapeHtml, soloDigitos, esHexValido, colorTextoLegible, mezclarConBlanco, iconoRedSocial, cargarGoogleFont } from './utils.js';

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

async function render(perfil) {
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

  const redesCont = document.getElementById('p-redes');
  redesCont.innerHTML = Object.entries(perfil.redes || {}).map(([key, url]) => {
    const label = CONFIG.REDES_SOCIALES.find(r => r.key === key)?.label || key;
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${escapeHtml(label)}">${iconoRedSocial(key)}</a>`;
  }).join('');

  // Contacto
  const contactoItems = [];
  if (perfil.telefono) contactoItems.push(`<div class="tarjeta-preview__contacto-item">📞 <a href="tel:${soloDigitos(perfil.telefono)}">${escapeHtml(perfil.telefono)}</a></div>`);
  if (perfil.mostrar_email && perfil.email_contacto) contactoItems.push(`<div class="tarjeta-preview__contacto-item">✉️ <a href="mailto:${escapeHtml(perfil.email_contacto)}">${escapeHtml(perfil.email_contacto)}</a></div>`);
  if (perfil.direccion) contactoItems.push(`<div class="tarjeta-preview__contacto-item">📍 ${escapeHtml(perfil.direccion)}</div>`);
  document.getElementById('p-contacto').innerHTML = contactoItems.join('') || '<p class="form-hint">Sin datos de contacto públicos.</p>';

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
  if (perfil.horario_atencion) {
    document.getElementById('p-horario').textContent = perfil.horario_atencion;
    document.getElementById('p-horario-card').style.display = 'block';
  }

  // Galería
  try {
    const fotos = await obtenerGaleria(perfil.id);
    if (fotos.length) {
      document.getElementById('p-galeria').innerHTML = fotos
        .map(f => `<img src="${escapeHtml(f.url)}" alt="Foto de galería" loading="lazy">`)
        .join('');
      document.getElementById('p-galeria-card').style.display = 'block';
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

init();
