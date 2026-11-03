// ============================================================
// PERFIL PÚBLICO — render del portafolio con carrusel por trabajo
// Carrusel con scroll-snap nativo (sin librerías): swipe en móvil,
// flechas en escritorio, teclado (← → Inicio Fin) y puntos.
// Los trabajos 'privado' no llegan: la BD (RLS) los oculta al
// visitante y además se piden con soloPublicos: true.
// ============================================================
import { obtenerPortafolio } from './portafolio-data.js';
import { escapeHtml } from './utils.js';

/** Solo http(s): evita enlaces `javascript:` guardados por un usuario malicioso */
function urlSegura(u = '') {
  try {
    const x = new URL(u);
    return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : '';
  } catch {
    return '';
  }
}

function itemHtml(it) {
  const fotos = it.fotos || [];
  const multi = fotos.length > 1;
  const enlace = urlSegura(it.url_link);

  const carrusel = fotos.length ? `
    <div class="pf-carrusel${multi ? ' pf-carrusel--multi' : ''}" data-pf-carrusel>
      <div class="pf-track" tabindex="0" role="group" aria-roledescription="carrusel"
           aria-label="Fotos de ${escapeHtml(it.titulo)}">
        ${fotos.map((f, i) => `
          <figure class="pf-slide" aria-label="Foto ${i + 1} de ${fotos.length}">
            <img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.caption || it.titulo)}" loading="lazy" decoding="async" data-pf-img>
            <figcaption class="pf-caption">${escapeHtml(f.caption || '')}</figcaption>
          </figure>`).join('')}
      </div>
      ${multi ? `
        <button type="button" class="pf-nav pf-nav--prev" aria-label="Foto anterior" data-pf-prev>‹</button>
        <button type="button" class="pf-nav pf-nav--next" aria-label="Foto siguiente" data-pf-next>›</button>
        <div class="pf-dots">
          ${fotos.map((_, i) => `<button type="button" class="pf-dot" aria-label="Ir a la foto ${i + 1}" data-pf-dot="${i}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}
        </div>` : ''}
    </div>` : '';

  return `
    <article class="pf-item">
      ${carrusel}
      <h3 class="pf-item__titulo">${escapeHtml(it.titulo)}</h3>
      ${it.subtitulo ? `<p class="pf-item__sub">${escapeHtml(it.subtitulo)}</p>` : ''}
      ${it.descripcion ? `<p class="pf-item__desc">${escapeHtml(it.descripcion)}</p>` : ''}
      ${enlace ? `<a class="btn btn-perfil-accion pf-cta" href="${escapeHtml(enlace)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.cta_texto || 'Ver más')}</a>` : ''}
    </article>`;
}

function activarCarrusel(root, abrirLightbox) {
  const track = root.querySelector('.pf-track');
  const slides = Array.from(root.querySelectorAll('.pf-slide'));
  const dots = Array.from(root.querySelectorAll('[data-pf-dot]'));
  const prev = root.querySelector('[data-pf-prev]');
  const next = root.querySelector('[data-pf-next]');

  root.querySelectorAll('[data-pf-img]').forEach(img => {
    img.addEventListener('click', () => abrirLightbox(img.currentSrc || img.src, img.alt));
  });
  if (slides.length < 2) return;

  const posicion = (i) => slides[i].offsetLeft - track.offsetLeft;
  const indiceActivo = () => {
    let mejor = 0, dist = Infinity;
    slides.forEach((s, i) => {
      const d = Math.abs(posicion(i) - track.scrollLeft);
      if (d < dist) { dist = d; mejor = i; }
    });
    return mejor;
  };
  const ir = (i) => {
    const idx = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: posicion(idx) });
  };
  const pintar = () => {
    const a = indiceActivo();
    dots.forEach((d, i) => (i === a ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    if (prev) prev.disabled = a === 0;
    if (next) next.disabled = a === slides.length - 1;
  };

  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { pintar(); ticking = false; });
  }, { passive: true });

  prev?.addEventListener('click', () => ir(indiceActivo() - 1));
  next?.addEventListener('click', () => ir(indiceActivo() + 1));
  dots.forEach(d => d.addEventListener('click', () => ir(Number(d.dataset.pfDot))));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(indiceActivo() - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); ir(indiceActivo() + 1); }
    else if (e.key === 'Home') { e.preventDefault(); ir(0); }
    else if (e.key === 'End') { e.preventDefault(); ir(slides.length - 1); }
  });
  pintar();
}

/**
 * Pinta el portafolio en #p-portafolio. Si el perfil lo oculta o no hay
 * trabajos públicos, deja el contenedor oculto.
 * `abrirLightbox(src, alt)` viene de perfil.js.
 */
export async function renderPortafolio(perfil, abrirLightbox) {
  const cont = document.getElementById('p-portafolio');
  if (!cont || perfil.mostrar_portafolio === false) return;

  const items = await obtenerPortafolio(perfil.id, { soloPublicos: true });
  if (!items.length) return;

  const a = (perfil.portafolio_label_a || '').trim();
  const b = (perfil.portafolio_label_b || '').trim();

  let cuerpo;
  if (a || b) {
    const grupos = [
      [a || 'Funcionales', items.filter(i => i.estado === 'funcional')],
      [b || 'En desarrollo', items.filter(i => i.estado === 'desarrollo')],
    ].filter(([, g]) => g.length);
    cuerpo = grupos.map(([label, g]) =>
      `<h3 class="pf-grupo-titulo">${escapeHtml(label)}</h3>${g.map(itemHtml).join('')}`).join('');
  } else {
    cuerpo = items.map(itemHtml).join('');
  }

  cont.innerHTML = `<h2>${escapeHtml(perfil.portafolio_titulo || 'Portafolio')}</h2>${cuerpo}`;
  cont.style.display = 'block';
  cont.querySelectorAll('[data-pf-carrusel]').forEach(root => activarCarrusel(root, abrirLightbox));
}
