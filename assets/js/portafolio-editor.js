// ============================================================
// EDITOR DE PORTAFOLIO (dashboard) — lista de trabajos, cada uno con
// varias fotos y su caption. Autoguardado por campo (debounced).
// Orden: arrastrar el asa ⋮⋮ (escritorio) o botones ↑ ↓ (móvil).
// UI → portafolio-data.js → supabase-client.js (3 capas)
// ============================================================
import { CONFIG } from './config.js';
import { escapeHtml, comprimirImagen, debounce } from './utils.js';
import {
  obtenerPortafolio, crearItemPortafolio, actualizarItemPortafolio, eliminarItemPortafolio,
  agregarFotoItem, actualizarFotoItem, eliminarFotoItem, reordenarItems, reordenarFotos,
} from './portafolio-data.js';
import { limitesDe, resumenPlan, linkQuieroPro } from './planes.js';

const $ = (id) => document.getElementById(id);

let ctx = null;          // { userId, perfil }
let items = [];          // ítems con sus fotos
let abiertoId = null;    // ítem desplegado (se conserva entre renders)
let arrastrandoId = null;
const debouncers = new Map();

const urlValida = (v) => v === '' || /^https?:\/\//i.test(v);

function etiquetaEstado(estado) {
  const a = ($('portafolio_label_a')?.value || '').trim() || 'Funcional';
  const b = ($('portafolio_label_b')?.value || '').trim() || 'En desarrollo';
  if (estado === 'funcional') return a;
  if (estado === 'desarrollo') return b;
  return 'Privado (solo tú)';
}

function mostrarError(msg) {
  const el = $('portafolio-error');
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function itemPorId(id) { return items.find(i => i.id === id); }

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function fotoHtml(f, i, total) {
  return `
    <div class="pf-foto" data-foto-id="${f.id}">
      <div class="pf-foto__img">
        <img src="${escapeHtml(f.url)}" alt="Foto ${i + 1}" loading="lazy">
        <button type="button" class="pf-foto__borrar" data-accion="foto-borrar" aria-label="Borrar foto">&times;</button>
      </div>
      <input class="form-input" type="text" maxlength="200" data-campo-foto="caption"
             value="${escapeHtml(f.caption || '')}" placeholder="Detalle de esta foto (opcional)" aria-label="Detalle de la foto ${i + 1}">
      <div class="pf-foto__mover">
        <button type="button" class="pf-icon-btn" data-accion="foto-izq" aria-label="Mover a la izquierda" ${i === 0 ? 'disabled' : ''}>←</button>
        <button type="button" class="pf-icon-btn" data-accion="foto-der" aria-label="Mover a la derecha" ${i === total - 1 ? 'disabled' : ''}>→</button>
      </div>
    </div>`;
}

function itemHtml(it, idx, lim) {
  const portada = it.fotos[0]?.url;
  const maxFotos = lim.maxFotosPorItem;
  const llenoFotos = it.fotos.length >= maxFotos;
  const opcionPrivado = lim.privados
    ? `<option value="privado" ${it.estado === 'privado' ? 'selected' : ''}>Privado (solo tú)</option>`
    : `<option value="privado" disabled ${it.estado === 'privado' ? 'selected' : ''}>Privado (plan Pro)</option>`;

  return `
  <div class="pf-editor-item" data-item-id="${it.id}">
    <details${it.id === abiertoId ? ' open' : ''}>
      <summary class="pf-editor-item__head">
        <span class="pf-handle" data-handle title="Arrastra para reordenar" aria-hidden="true">⋮⋮</span>
        ${portada
          ? `<img class="pf-thumb" src="${escapeHtml(portada)}" alt="" loading="lazy">`
          : '<span class="pf-thumb pf-thumb--vacio" aria-hidden="true">🖼️</span>'}
        <span class="pf-editor-item__titulo" data-titulo-vivo>${escapeHtml(it.titulo)}</span>
        <span class="pf-chip pf-chip--${it.estado}" data-chip>${escapeHtml(etiquetaEstado(it.estado))}</span>
        <span class="pf-editor-item__acciones">
          <button type="button" class="pf-icon-btn" data-accion="subir" aria-label="Subir posición" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="pf-icon-btn" data-accion="bajar" aria-label="Bajar posición" ${idx === items.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="pf-icon-btn pf-icon-btn--borrar" data-accion="borrar-item" aria-label="Borrar trabajo" title="Borrar trabajo">🗑</button>
        </span>
      </summary>

      <div class="pf-editor-item__body">
        <div class="form-group">
          <label class="form-label" for="pf-titulo-${it.id}">Título *</label>
          <input class="form-input" id="pf-titulo-${it.id}" type="text" maxlength="80" data-campo="titulo" value="${escapeHtml(it.titulo)}" placeholder="Ej. Casa Carapongo">
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-sub-${it.id}">Subtítulo</label>
          <input class="form-input" id="pf-sub-${it.id}" type="text" maxlength="120" data-campo="subtitulo" value="${escapeHtml(it.subtitulo || '')}" placeholder="Una línea que lo resuma">
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-desc-${it.id}">Descripción</label>
          <textarea class="form-textarea" id="pf-desc-${it.id}" maxlength="600" data-campo="descripcion" placeholder="2 a 4 líneas sobre este trabajo">${escapeHtml(it.descripcion || '')}</textarea>
        </div>
        <div class="pf-fila-2">
          <div class="form-group">
            <label class="form-label" for="pf-url-${it.id}">Enlace (opcional)</label>
            <input class="form-input" id="pf-url-${it.id}" type="url" data-campo="url_link" value="${escapeHtml(it.url_link || '')}" placeholder="https://...">
          </div>
          <div class="form-group">
            <label class="form-label" for="pf-cta-${it.id}">Texto del botón</label>
            <input class="form-input" id="pf-cta-${it.id}" type="text" maxlength="30" data-campo="cta_texto" value="${escapeHtml(it.cta_texto || 'Ver más')}" placeholder="Ver más">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-estado-${it.id}">Dónde aparece</label>
          <select class="form-select" id="pf-estado-${it.id}" data-campo-estado>
            <option value="funcional" ${it.estado === 'funcional' ? 'selected' : ''}>${escapeHtml(etiquetaEstado('funcional'))}</option>
            <option value="desarrollo" ${it.estado === 'desarrollo' ? 'selected' : ''}>${escapeHtml(etiquetaEstado('desarrollo'))}</option>
            ${opcionPrivado}
          </select>
        </div>

        <div class="pf-fotos">
          <p class="paleta-picker__label">Fotos (${it.fotos.length} de ${maxFotos})</p>
          <div class="pf-fotos-grid">
            ${it.fotos.map((f, i) => fotoHtml(f, i, it.fotos.length)).join('')}
          </div>
          <input class="form-input" type="file" accept="image/png, image/jpeg, image/webp" multiple data-subir-fotos ${llenoFotos ? 'disabled' : ''} aria-label="Agregar fotos">
          <p class="form-hint">${llenoFotos
            ? `Llegaste al máximo de ${maxFotos} fotos por trabajo en tu plan.`
            : 'Se comprimen solas al subirlas. El "detalle" aparece bajo la foto en tu tarjeta.'}</p>
        </div>

        <p class="form-hint pf-estado-guardado" data-guardado>&nbsp;</p>
      </div>
    </details>
  </div>`;
}

function render() {
  const lista = $('portafolio-lista');
  if (!lista || !ctx) return;
  const lim = limitesDe(ctx.perfil);

  $('portafolio-contador').textContent = `${items.length} de ${lim.maxItems} trabajos usados`;

  const pro = linkQuieroPro(ctx.perfil);
  $('portafolio-plan').innerHTML =
    `<strong>${escapeHtml(resumenPlan(ctx.perfil))}</strong> · hasta ${lim.maxItems} trabajos con ${lim.maxFotosPorItem} fotos cada uno` +
    (lim.privados ? ' · trabajos privados disponibles' : '') +
    (!lim.privados && pro ? ` · <a href="${escapeHtml(pro)}" target="_blank" rel="noopener">Quiero Pro</a>` : '');

  lista.innerHTML = items.length
    ? items.map((it, idx) => itemHtml(it, idx, lim)).join('')
    : '<p class="form-hint">Todavía no tienes trabajos. Agrega el primero: cada uno puede tener varias fotos, una descripción y un botón con enlace.</p>';

  const btn = $('btn-nuevo-item');
  const lleno = items.length >= lim.maxItems;
  btn.disabled = lleno;
  btn.title = lleno ? 'Llegaste al tope de tu plan' : '';
}

// ------------------------------------------------------------
// Guardado de campos
// ------------------------------------------------------------
function indicador(itemId) {
  return document.querySelector(`[data-item-id="${itemId}"] [data-guardado]`);
}
function setIndicador(itemId, texto, clase = 'form-hint') {
  const el = indicador(itemId);
  if (el) { el.textContent = texto; el.className = `${clase} pf-estado-guardado`; }
}

async function guardarCampoItem(itemId, campo, valor) {
  const item = itemPorId(itemId);
  if (!item) return;
  if (campo === 'titulo' && !valor) { setIndicador(itemId, 'El título es obligatorio.', 'form-error'); return; }
  if (campo === 'url_link' && !urlValida(valor)) { setIndicador(itemId, 'El enlace debe empezar con https://', 'form-error'); return; }
  if (campo === 'cta_texto' && !valor) valor = 'Ver más';
  try {
    setIndicador(itemId, 'Guardando...');
    const actualizado = await actualizarItemPortafolio(itemId, { [campo]: valor });
    Object.assign(item, actualizado);
    setIndicador(itemId, 'Guardado ✓', 'form-success');
  } catch (err) {
    console.error(err);
    setIndicador(itemId, err.message || 'No se pudo guardar.', 'form-error');
  }
}

function guardarCampoDebounced(itemId, campo, valor) {
  const clave = `${itemId}:${campo}`;
  if (!debouncers.has(clave)) {
    debouncers.set(clave, debounce((...a) => guardarCampoItem(...a), 700));
  }
  debouncers.get(clave)(itemId, campo, valor);
}

async function guardarCaptionFoto(fotoId, itemId, valor) {
  try {
    setIndicador(itemId, 'Guardando...');
    const act = await actualizarFotoItem(fotoId, { caption: valor });
    const foto = itemPorId(itemId)?.fotos.find(f => f.id === fotoId);
    if (foto) Object.assign(foto, act);
    setIndicador(itemId, 'Guardado ✓', 'form-success');
  } catch (err) {
    console.error(err);
    setIndicador(itemId, err.message || 'No se pudo guardar.', 'form-error');
  }
}

// ------------------------------------------------------------
// Acciones
// ------------------------------------------------------------
async function persistirOrdenItems() {
  try {
    await reordenarItems(items.map(i => i.id));
  } catch (err) {
    console.error(err);
    mostrarError('No se pudo guardar el nuevo orden. Recarga la página.');
  }
}

async function mover(itemId, delta) {
  const i = items.findIndex(x => x.id === itemId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  render();
  await persistirOrdenItems();
}

async function moverFoto(itemId, fotoId, delta) {
  const item = itemPorId(itemId);
  if (!item) return;
  const i = item.fotos.findIndex(f => f.id === fotoId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= item.fotos.length) return;
  [item.fotos[i], item.fotos[j]] = [item.fotos[j], item.fotos[i]];
  render();
  try { await reordenarFotos(item.fotos.map(f => f.id)); }
  catch (err) { console.error(err); mostrarError('No se pudo guardar el orden de las fotos.'); }
}

async function nuevoItem() {
  mostrarError('');
  const lim = limitesDe(ctx.perfil);
  if (items.length >= lim.maxItems) {
    mostrarError(`Tu plan permite hasta ${lim.maxItems} trabajos.`);
    return;
  }
  const btn = $('btn-nuevo-item');
  btn.disabled = true;
  try {
    const nuevo = await crearItemPortafolio(ctx.perfil.id, {}, items.length);
    items.push(nuevo);
    abiertoId = nuevo.id;
    render();
    document.getElementById(`pf-titulo-${nuevo.id}`)?.select();
  } catch (err) {
    console.error(err);
    mostrarError(err.message || 'No se pudo crear el trabajo.');
    btn.disabled = false;
  }
}

async function borrarItem(itemId) {
  const item = itemPorId(itemId);
  if (!item) return;
  try {
    await eliminarItemPortafolio(item);
    items = items.filter(i => i.id !== itemId);
    if (abiertoId === itemId) abiertoId = null;
    render();
    persistirOrdenItems();
  } catch (err) {
    console.error(err);
    mostrarError('No se pudo borrar el trabajo.');
  }
}

async function borrarFoto(itemId, fotoId) {
  const item = itemPorId(itemId);
  const foto = item?.fotos.find(f => f.id === fotoId);
  if (!foto) return;
  try {
    await eliminarFotoItem(fotoId, foto.storage_path);
    item.fotos = item.fotos.filter(f => f.id !== fotoId);
    render();
  } catch (err) {
    console.error(err);
    mostrarError('No se pudo borrar la foto.');
  }
}

async function subirFotos(itemId, archivos) {
  mostrarError('');
  const item = itemPorId(itemId);
  if (!item) return;
  const lim = limitesDe(ctx.perfil);
  const libres = lim.maxFotosPorItem - item.fotos.length;
  if (libres <= 0) { mostrarError(`Máximo ${lim.maxFotosPorItem} fotos por trabajo en tu plan.`); return; }

  const aSubir = archivos.slice(0, libres);
  if (archivos.length > libres) mostrarError(`Solo se subirán ${libres} foto(s): es el máximo de tu plan.`);

  for (const archivo of aSubir) {
    try {
      if (!archivo.type.startsWith('image/')) throw new Error(`"${archivo.name}" no es una imagen.`);
      if (archivo.size > CONFIG.PORTAFOLIO_MAX_MB * 1024 * 1024) throw new Error(`"${archivo.name}" supera ${CONFIG.PORTAFOLIO_MAX_MB}MB.`);
      setIndicador(itemId, `Subiendo "${archivo.name}"...`);
      const blob = await comprimirImagen(archivo, CONFIG.PORTAFOLIO_RESIZE_MAX_PX, CONFIG.PORTAFOLIO_JPEG_CALIDAD);
      if (blob.size > CONFIG.POST_COMPRESION_MAX_KB * 1024) throw new Error(`"${archivo.name}" sigue muy pesada tras comprimir.`);
      const foto = await agregarFotoItem(ctx.userId, itemId, blob, item.fotos.length);
      item.fotos.push(foto);
      render();
    } catch (err) {
      console.error(err);
      mostrarError(err.message || 'No se pudo subir una de las fotos.');
    }
  }
  setIndicador(itemId, 'Guardado ✓', 'form-success');
}

// ------------------------------------------------------------
// Eventos (delegación sobre la lista)
// ------------------------------------------------------------
function bindEventos() {
  const lista = $('portafolio-lista');

  $('btn-nuevo-item').addEventListener('click', nuevoItem);

  // Las etiquetas de los grupos se editan en el formulario de arriba
  let t = null;
  ['portafolio_label_a', 'portafolio_label_b'].forEach(id => {
    $(id)?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 250); });
  });

  // La lista vive dentro del <form> del dashboard: Enter en un campo no debe enviarlo
  lista.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') e.preventDefault();
  });

  lista.addEventListener('toggle', (e) => {
    const cont = e.target.closest?.('[data-item-id]');
    if (!cont || e.target.tagName !== 'DETAILS') return;
    if (e.target.open) abiertoId = cont.dataset.itemId;
    else if (abiertoId === cont.dataset.itemId) abiertoId = null;
  }, true);

  lista.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-accion]');
    if (!btn) return;
    e.preventDefault();               // los botones viven dentro de <summary>
    const itemId = btn.closest('[data-item-id]')?.dataset.itemId;
    const fotoId = btn.closest('[data-foto-id]')?.dataset.fotoId;
    switch (btn.dataset.accion) {
      case 'subir': mover(itemId, -1); break;
      case 'bajar': mover(itemId, +1); break;
      case 'borrar-item':
        if (btn.dataset.confirmar === '1') { borrarItem(itemId); }
        else {
          btn.dataset.confirmar = '1';
          btn.textContent = '¿Borrar?';
          btn.classList.add('pf-icon-btn--peligro');
          setTimeout(() => {
            if (btn.isConnected) { btn.dataset.confirmar = ''; btn.textContent = '🗑'; btn.classList.remove('pf-icon-btn--peligro'); }
          }, 3000);
        }
        break;
      case 'foto-izq': moverFoto(itemId, fotoId, -1); break;
      case 'foto-der': moverFoto(itemId, fotoId, +1); break;
      case 'foto-borrar': borrarFoto(itemId, fotoId); break;
    }
  });

  lista.addEventListener('input', (e) => {
    const itemId = e.target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;
    if (e.target.dataset.campo) {
      const campo = e.target.dataset.campo;
      const valor = e.target.value.trim();
      if (campo === 'titulo') {
        const tit = e.target.closest('[data-item-id]').querySelector('[data-titulo-vivo]');
        if (tit) tit.textContent = valor || 'Sin título';
      }
      guardarCampoDebounced(itemId, campo, valor);
    } else if (e.target.dataset.campoFoto) {
      const fotoId = e.target.closest('[data-foto-id]').dataset.fotoId;
      const clave = `foto:${fotoId}`;
      if (!debouncers.has(clave)) debouncers.set(clave, debounce((...a) => guardarCaptionFoto(...a), 700));
      debouncers.get(clave)(fotoId, itemId, e.target.value.trim());
    }
  });

  lista.addEventListener('change', async (e) => {
    const itemId = e.target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;
    if (e.target.matches('[data-campo-estado]')) {
      const item = itemPorId(itemId);
      const previo = item.estado;
      try {
        setIndicador(itemId, 'Guardando...');
        const act = await actualizarItemPortafolio(itemId, { estado: e.target.value });
        Object.assign(item, act);
        render();
        document.querySelector(`[data-item-id="${itemId}"] [data-guardado]`).textContent = 'Guardado ✓';
      } catch (err) {
        console.error(err);
        e.target.value = previo;
        setIndicador(itemId, err.message || 'No se pudo cambiar.', 'form-error');
      }
    } else if (e.target.matches('[data-subir-fotos]')) {
      const archivos = Array.from(e.target.files);
      e.target.value = '';
      subirFotos(itemId, archivos);
    }
  });

  // Drag & drop nativo (solo desde el asa ⋮⋮, para no romper la selección de texto)
  lista.addEventListener('mousedown', (e) => {
    const asa = e.target.closest('[data-handle]');
    if (asa) asa.closest('.pf-editor-item').draggable = true;
  });
  lista.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.('.pf-editor-item');
    if (!el || !el.draggable) return;
    arrastrandoId = el.dataset.itemId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', arrastrandoId);
    el.classList.add('pf-arrastrando');
  });
  lista.addEventListener('dragover', (e) => {
    if (!arrastrandoId) return;
    e.preventDefault();
    lista.querySelectorAll('.pf-drop-objetivo').forEach(n => n.classList.remove('pf-drop-objetivo'));
    const objetivo = e.target.closest('.pf-editor-item');
    if (objetivo && objetivo.dataset.itemId !== arrastrandoId) objetivo.classList.add('pf-drop-objetivo');
  });
  lista.addEventListener('drop', async (e) => {
    if (!arrastrandoId) return;
    e.preventDefault();
    const objetivo = e.target.closest('.pf-editor-item');
    const origenId = arrastrandoId;
    arrastrandoId = null;
    if (!objetivo || objetivo.dataset.itemId === origenId) { render(); return; }
    const desde = items.findIndex(i => i.id === origenId);
    const hasta = items.findIndex(i => i.id === objetivo.dataset.itemId);
    const [mov] = items.splice(desde, 1);
    items.splice(hasta, 0, mov);
    render();
    await persistirOrdenItems();
  });
  lista.addEventListener('dragend', () => {
    arrastrandoId = null;
    lista.querySelectorAll('.pf-editor-item').forEach(n => {
      n.draggable = false;
      n.classList.remove('pf-arrastrando', 'pf-drop-objetivo');
    });
  });
}

// ------------------------------------------------------------
// API pública del módulo
// ------------------------------------------------------------
export async function iniciarEditorPortafolio({ userId, perfil }) {
  ctx = { userId, perfil };
  bindEventos();
  try {
    items = await obtenerPortafolio(perfil.id);
  } catch (err) {
    console.error(err);
    items = [];
    mostrarError('No se pudo cargar tu portafolio. ¿Ya corriste la migración 007 en Supabase?');
  }
  render();
}

/** Llamar tras guardar el perfil (cambia plan / etiquetas) para repintar contadores */
export function actualizarPerfilEnEditor(perfil) {
  if (!ctx) return;
  ctx.perfil = perfil;
  render();
}
