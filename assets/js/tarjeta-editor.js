// ============================================================
// EDITOR DE TARJETA IMPRIMIBLE (dashboard)
// 10 diseños, paleta, fuentes y tamaños de texto/QR, con vista previa
// en vivo y descarga de PDF de imprenta (96×56 mm = 90×50 + 3 mm de
// sangrado por lado, 600 dpi). La configuración se autoguarda en
// profiles.tarjeta_config. Descargar el PDF es del plan Pro.
// ============================================================
import { CONFIG } from './config.js';
import { actualizarPerfil } from './supabase-data.js';
import { debounce, escapeHtml } from './utils.js';
import { planEfectivoDe, linkQuieroPro } from './planes.js';
import {
  LAYOUTS, MEDIDAS, normalizarConfig, configParaGuardar, datosDeTarjeta, dibujarCara, _fuentesListas,
} from './tarjeta-render.js';

let userId = null, perfil = null, cfg = null;
let raiz = null;

const $ = (sel) => raiz.querySelector(sel);
const DPI = 600;
const PPM_PDF = DPI / 25.4;

function html() {
  const fuentes = CONFIG.FUENTES_DISPONIBLES.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  const seg = (name, items) => `<div class="tj-seg" data-seg="${name}">${items.map(([v, l]) =>
    `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `
    <p class="form-hint">Diseña la tarjeta que vas a imprimir. El QR lleva a tu perfil y cuenta los escaneos.</p>

    <div class="tj-previa">
      <figure><canvas id="tj-frente" aria-label="Frente de la tarjeta"></canvas><figcaption>Frente</figcaption></figure>
      <figure><canvas id="tj-dorso" aria-label="Dorso de la tarjeta"></canvas><figcaption>Dorso</figcaption></figure>
    </div>

    <p class="paleta-picker__label">Diseño (10 distribuciones)</p>
    <div class="tj-layouts" id="tj-layouts" role="radiogroup" aria-label="Distribución de la tarjeta"></div>

    <p class="paleta-picker__label">Colores</p>
    <div class="paleta-swatches" id="tj-swatches"></div>
    <div class="tj-colores">
      <label class="form-label">Primario <input type="color" id="tj-cp"></label>
      <label class="form-label">Secundario <input type="color" id="tj-cs"></label>
      <button type="button" class="btn btn-tertiary" id="tj-colores-perfil">Usar los de mi perfil</button>
    </div>

    <p class="paleta-picker__label">Fuentes</p>
    <div class="fuentes-grid">
      <div class="form-group"><label class="form-label" for="tj-ft">Título</label>
        <select class="form-select" id="tj-ft"><option value="">Igual que mi perfil</option>${fuentes}</select></div>
      <div class="form-group"><label class="form-label" for="tj-fx">Textos</label>
        <select class="form-select" id="tj-fx"><option value="">Igual que mi perfil</option>${fuentes}</select></div>
    </div>

    <p class="paleta-picker__label">Tamaños</p>
    <div class="tj-tamanos">
      <div><span class="form-label">Texto</span>${seg('textoEscala', [['pequeno', 'Pequeño'], ['normal', 'Normal'], ['grande', 'Grande']])}</div>
      <div><span class="form-label">QR</span>${seg('qrEscala', [['pequeno', 'Pequeño'], ['normal', 'Normal'], ['grande', 'Grande']])}</div>
    </div>

    <p class="paleta-picker__label">Datos que aparecen</p>
    <div class="tj-mostrar">
      <label><input type="checkbox" data-mostrar="telefono"> Teléfono</label>
      <label><input type="checkbox" data-mostrar="email"> Correo</label>
      <label><input type="checkbox" data-mostrar="web"> Sitio web</label>
      <label><input type="checkbox" data-mostrar="direccion"> Dirección</label>
    </div>

    <div class="tj-pie">
      <button type="button" class="btn btn-primary" id="tj-pdf">Descargar PDF para imprenta</button>
      <span class="form-hint" id="tj-estado" role="status"></span>
    </div>
    <p class="form-hint" id="tj-pro"></p>
    <p class="form-hint">Archivo de ${MEDIDAS.W + 2 * MEDIDAS.SANGRADO}×${MEDIDAS.H + 2 * MEDIDAS.SANGRADO} mm
      (${MEDIDAS.W}×${MEDIDAS.H} mm de corte + ${MEDIDAS.SANGRADO} mm de sangrado por lado), ${DPI} dpi.
      Al imprimir elige <strong>“Tamaño real / 100%”</strong>, no “Ajustar a la página”.</p>`;
}

// ---------- vista previa ----------
let _versionPintado = 0;
async function repintar() {
  const v = ++_versionPintado;
  const datos = datosDeTarjeta(perfil);
  await _fuentesListas(cfg);
  if (v !== _versionPintado) return;
  const opts = { ppm: 9, fuentesListas: true };
  await dibujarCara($('#tj-frente'), 'frente', datos, cfg, opts);
  await dibujarCara($('#tj-dorso'), 'dorso', datos, cfg, opts);
  // miniaturas de los 10 diseños (frente)
  for (const l of LAYOUTS) {
    if (v !== _versionPintado) return;
    const cv = raiz.querySelector(`canvas[data-layout="${l.id}"]`);
    if (cv) await dibujarCara(cv, 'frente', datos, { ...cfg, layout: l.id }, { ppm: 2.6, fuentesListas: true });
  }
}
const repintarPronto = debounce(repintar, 120);

// ---------- autoguardado ----------
const guardar = debounce(async () => {
  const est = $('#tj-estado');
  try {
    perfil = await actualizarPerfil(userId, { tarjeta_config: configParaGuardar(cfg) });
    est.textContent = 'Diseño guardado ✓';
  } catch (err) {
    console.error(err);
    est.textContent = 'No se pudo guardar el diseño (¿corriste la migración 008?)';
  }
}, 800);

function cambio() {
  cfg = normalizarConfig(configParaGuardar(cfg), perfil);
  sincronizarControles();
  repintarPronto();
  $('#tj-estado').textContent = 'Guardando…';
  guardar();
}

function sincronizarControles() {
  $('#tj-cp').value = cfg.P; $('#tj-cs').value = cfg.S;
  $('#tj-ft').value = cfg.fuenteTitulo || ''; $('#tj-fx').value = cfg.fuenteTexto || '';
  raiz.querySelectorAll('[data-seg]').forEach(g => {
    g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(cfg[g.dataset.seg] === b.dataset.v)));
  });
  raiz.querySelectorAll('[data-mostrar]').forEach(i => { i.checked = !!cfg.mostrar[i.dataset.mostrar]; });
  raiz.querySelectorAll('.tj-layout').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === cfg.layout)));
  raiz.querySelectorAll('#tj-swatches [data-p]').forEach(b =>
    b.classList.toggle('is-activo', b.dataset.p.toLowerCase() === cfg.P.toLowerCase() && b.dataset.s.toLowerCase() === cfg.S.toLowerCase()));
}

function actualizarPro() {
  const pro = planEfectivoDe(perfil) === 'pro';
  const btn = $('#tj-pdf');
  btn.disabled = !pro;
  const link = linkQuieroPro(perfil);
  $('#tj-pro').innerHTML = pro ? ''
    : `Descargar el PDF es del plan Pro. Puedes diseñar y ver la vista previa gratis. ${link ? `<a href="${link}" target="_blank" rel="noopener">Quiero Pro</a>` : ''}`;
}

// ---------- PDF ----------
async function cargarJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = ok; s.onerror = () => fail(new Error('No se pudo cargar la librería de PDF'));
    document.head.appendChild(s);
  });
  return window.jspdf.jsPDF;
}

/** Arma el PDF (2 páginas de 96×56 mm: frente y dorso) y lo devuelve sin descargar */
export async function generarPDF() {
  const jsPDF = await cargarJsPDF();
  const w = MEDIDAS.W + 2 * MEDIDAS.SANGRADO, h = MEDIDAS.H + 2 * MEDIDAS.SANGRADO;
  const datos = datosDeTarjeta(perfil);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [w, h], compress: true });
  await _fuentesListas(cfg);
  for (const cara of ['frente', 'dorso']) {
    const cv = document.createElement('canvas');
    await dibujarCara(cv, cara, datos, cfg, { ppm: PPM_PDF, conSangrado: true, fuentesListas: true });
    if (cara === 'dorso') doc.addPage([w, h], 'landscape');
    doc.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h, undefined, 'FAST');
    cv.width = cv.height = 0;
  }
  doc.setProperties({ title: `Tarjeta ${datos.nombre}`, subject: 'Tarjeta de presentación 90×50 mm con sangrado de 3 mm' });
  return doc;
}

async function descargarPDF() {
  const btn = $('#tj-pdf'), est = $('#tj-estado');
  btn.disabled = true; est.textContent = 'Generando PDF…';
  try {
    const doc = await generarPDF();
    doc.save(`tarjeta-${perfil.slug || 'mi'}.pdf`);
    est.textContent = 'PDF descargado ✓';
  } catch (err) {
    console.error(err);
    est.textContent = err.message || 'No se pudo generar el PDF';
  } finally {
    actualizarPro();
  }
}

// ---------- arranque ----------
export function iniciarEditorTarjeta({ userId: uid, perfil: p }) {
  userId = uid; perfil = p;
  raiz = document.getElementById('tarjeta-editor');
  if (!raiz) return;
  cfg = normalizarConfig(perfil.tarjeta_config, perfil);
  raiz.innerHTML = html();

  $('#tj-layouts').innerHTML = LAYOUTS.map(l => `
    <button type="button" class="tj-layout" role="radio" data-id="${l.id}" aria-checked="false" title="${l.nombre}">
      <canvas data-layout="${l.id}"></canvas><span>${l.nombre}</span>
    </button>`).join('');
  $('#tj-swatches').innerHTML = CONFIG.PALETAS_PRESET.map(p2 =>
    `<button type="button" class="paleta-swatch" data-p="${p2.primary}" data-s="${p2.secondary}" title="${escapeHtml(p2.label)}"
      style="background:linear-gradient(135deg, ${p2.primary} 50%, ${p2.secondary} 50%)" aria-label="${escapeHtml(p2.label)}"></button>`).join('');

  raiz.addEventListener('click', (e) => {
    const lay = e.target.closest('.tj-layout');
    if (lay) { cfg.layout = lay.dataset.id; return cambio(); }
    const sw = e.target.closest('#tj-swatches [data-p]');
    if (sw) { cfg.colorP = sw.dataset.p; cfg.colorS = sw.dataset.s; return cambio(); }
    const sg = e.target.closest('[data-seg] button');
    if (sg) { cfg[sg.parentElement.dataset.seg] = sg.dataset.v; return cambio(); }
    if (e.target.closest('#tj-colores-perfil')) { cfg.colorP = null; cfg.colorS = null; return cambio(); }
    if (e.target.closest('#tj-pdf')) descargarPDF();
  });
  raiz.addEventListener('input', (e) => {
    if (e.target.id === 'tj-cp') { cfg.colorP = e.target.value; cambio(); }
    if (e.target.id === 'tj-cs') { cfg.colorS = e.target.value; cambio(); }
  });
  raiz.addEventListener('change', (e) => {
    if (e.target.id === 'tj-ft') { cfg.fuenteTitulo = e.target.value || null; cambio(); }
    if (e.target.id === 'tj-fx') { cfg.fuenteTexto = e.target.value || null; cambio(); }
    if (e.target.dataset?.mostrar) { cfg.mostrar[e.target.dataset.mostrar] = e.target.checked; cambio(); }
  });

  sincronizarControles();
  actualizarPro();
  repintar();
}

/** Llamar tras guardar el perfil (cambian nombre, colores, plan…) */
export function actualizarPerfilEnTarjeta(p) {
  if (!raiz) return;
  perfil = p;
  cfg = normalizarConfig(configParaGuardar(cfg), perfil);
  sincronizarControles();
  actualizarPro();
  repintarPronto();
}
