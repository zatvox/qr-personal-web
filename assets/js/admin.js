// ============================================================
// PANEL ADMIN (pages/admin.html) — usuarios, planes, pagos y estados.
// Solo carga si public.es_admin() es true; todas las acciones pasan
// por RPCs que lo vuelven a verificar en el servidor.
// ============================================================
import { CONFIG } from './config.js';
import { protegerPagina, cerrarSesion } from './auth.js';
import {
  esAdmin, adminListarUsuarios, adminCambiarPlan, adminActivarPerfil,
  adminRegistrarPago, adminListarPagos, adminEliminarPago,
} from './admin-data.js';
import { escapeHtml } from './utils.js';
import { hoyLima, formatearFechaISO } from './planes.js';

const $ = (id) => document.getElementById(id);
const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

let usuarios = [];
let abiertoId = null;
let filtro = 'todos';
let busqueda = '';

// ------------------------------------------------------------
// Estado de plan de cada usuario
// ------------------------------------------------------------
function diasHasta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const [hy, hm, hd] = hoyLima().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86400000);
}

/** 'pro' | 'por_vencer' | 'vencido' | 'gratis' */
function estadoPlan(u) {
  if (u.plan === 'pro' && u.plan_vence_en && diasHasta(u.plan_vence_en) < 0) return 'vencido';
  if (u.plan_efectivo === 'pro') {
    if (u.plan_vence_en && diasHasta(u.plan_vence_en) <= 7) return 'por_vencer';
    return 'pro';
  }
  return 'gratis';
}

const ETIQUETA_PLAN = {
  pro: ['adm-badge--pro', 'Pro'],
  por_vencer: ['adm-badge--vencido', 'Pro · por vencer'],
  vencido: ['adm-badge--vencido', 'Pro vencido'],
  gratis: ['adm-badge--gratis', 'Gratis'],
};

function mensaje(tipo, texto) {
  const err = $('adm-error'), ok = $('adm-exito');
  err.style.display = 'none'; ok.style.display = 'none';
  const el = tipo === 'error' ? err : ok;
  el.textContent = texto;
  el.style.display = 'block';
  if (tipo === 'ok') setTimeout(() => { el.style.display = 'none'; }, 6000);
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function pasaFiltro(u) {
  const est = estadoPlan(u);
  const okFiltro =
    filtro === 'todos' ? true :
    filtro === 'pro' ? (est === 'pro' || est === 'por_vencer') :
    filtro === 'pausado' ? !u.activo :
    est === filtro;
  if (!okFiltro) return false;
  if (!busqueda) return true;
  const q = busqueda.toLowerCase();
  return [u.nombre_completo, u.email, u.slug].some(v => (v || '').toLowerCase().includes(q));
}

function renderResumen() {
  const cuenta = (e) => usuarios.filter(u => estadoPlan(u) === e).length;
  const ingresos = usuarios.reduce((s, u) => s + Number(u.total_pagado || 0), 0);
  const kpi = (n, label) => `<div class="adm-kpi"><strong>${n}</strong><span>${label}</span></div>`;
  $('adm-resumen').innerHTML =
    kpi(usuarios.length, 'Usuarios') +
    kpi(cuenta('pro') + cuenta('por_vencer'), 'Pro vigentes') +
    kpi(cuenta('por_vencer'), 'Por vencer (7 días)') +
    kpi(cuenta('vencido'), 'Vencidos') +
    kpi(usuarios.filter(u => !u.activo).length, 'Pausados') +
    kpi(soles(ingresos), 'Cobrado en total');
}

function usuarioHtml(u) {
  const est = estadoPlan(u);
  const [claseBadge, textoBadge] = ETIQUETA_PLAN[est];
  const venceTxt = u.plan_vence_en ? ` · vence ${formatearFechaISO(u.plan_vence_en)}` : (u.plan === 'pro' ? ' · sin vencimiento' : '');
  const linkTarjeta = `${CONFIG.SITE_BASE_URL}/u/${encodeURIComponent(u.slug || '')}`;

  return `
  <details class="adm-usuario" data-profile-id="${u.profile_id}"${u.profile_id === abiertoId ? ' open' : ''}>
    <summary class="adm-usuario__head">
      <span class="adm-usuario__nombre">${escapeHtml(u.nombre_completo || '(sin nombre)')}</span>
      <span>
        <span class="adm-badge ${claseBadge}">${escapeHtml(textoBadge)}</span>
        ${u.activo ? '' : '<span class="adm-badge adm-badge--pausado">Pausado</span>'}
      </span>
      <span class="adm-usuario__meta">
        ${escapeHtml(u.email || 'sin correo')} · /u/${escapeHtml(u.slug || '')}${escapeHtml(venceTxt)}
        · ${u.items} trabajo(s) · ${u.fotos} foto(s)
        · ${u.ultimo_pago ? `último pago ${formatearFechaISO(u.ultimo_pago)}` : 'sin pagos'} · ${soles(u.total_pagado)}
      </span>
    </summary>

    <div class="adm-usuario__body">
      <div class="adm-acciones">
        <a class="btn btn-secondary" href="${escapeHtml(linkTarjeta)}" target="_blank" rel="noopener">Ver tarjeta</a>
        <button type="button" class="btn btn-tertiary" data-accion="pausar" data-activo="${u.activo ? '1' : '0'}">
          ${u.activo ? 'Pausar perfil' : 'Reactivar perfil'}
        </button>
      </div>

      <form data-form-pago novalidate>
        <p class="paleta-picker__label">Registrar pago (activa o extiende Pro)</p>
        <div class="adm-form-pago">
          <div class="form-group"><label class="form-label">Periodo</label>
            <select class="form-select" name="periodo">
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
              <option value="otro">Otro (indico vencimiento)</option>
            </select></div>
          <div class="form-group"><label class="form-label">Monto (S/)</label>
            <input class="form-input" type="number" name="monto" step="0.01" min="0" value="${CONFIG.PRECIOS.mensual.toFixed(2)}"></div>
          <div class="form-group"><label class="form-label">Método</label>
            <select class="form-select" name="metodo">
              <option value="yape">Yape</option><option value="plin">Plin</option>
              <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select></div>
          <div class="form-group"><label class="form-label">Fecha de pago</label>
            <input class="form-input" type="date" name="fecha" value="${hoyLima()}"></div>
          <div class="form-group"><label class="form-label">Vence (opcional)</label>
            <input class="form-input" type="date" name="vence"></div>
          <div class="form-group"><label class="form-label">N° operación</label>
            <input class="form-input" type="text" name="referencia" maxlength="60"></div>
        </div>
        <div class="form-group"><label class="form-label">Notas</label>
          <input class="form-input" type="text" name="notas" maxlength="200"></div>
        <button type="submit" class="btn btn-primary">Registrar pago y activar Pro</button>
      </form>

      <form data-form-plan novalidate style="margin-top: var(--space-md);">
        <p class="paleta-picker__label">Cambiar plan a mano (sin registrar pago)</p>
        <div class="adm-form-pago">
          <div class="form-group"><label class="form-label">Plan</label>
            <select class="form-select" name="plan">
              <option value="gratis"${u.plan === 'gratis' ? ' selected' : ''}>Gratis</option>
              <option value="pro"${u.plan === 'pro' ? ' selected' : ''}>Pro</option>
            </select></div>
          <div class="form-group"><label class="form-label">Vence (vacío = sin vencimiento)</label>
            <input class="form-input" type="date" name="vence" value="${escapeHtml(u.plan_vence_en || '')}"></div>
        </div>
        <button type="submit" class="btn btn-secondary">Aplicar plan</button>
      </form>

      <p class="paleta-picker__label" style="margin-top: var(--space-md);">Historial de pagos</p>
      <div class="adm-pagos-wrap" data-pagos><p class="form-hint">Se carga al abrir…</p></div>
    </div>
  </details>`;
}

function renderLista() {
  const visibles = usuarios.filter(pasaFiltro);
  $('adm-lista').innerHTML = visibles.length
    ? visibles.map(usuarioHtml).join('')
    : '<p class="form-hint">No hay usuarios con ese filtro.</p>';
  if (abiertoId) cargarPagos(abiertoId);
}

function render() {
  renderResumen();
  renderLista();
}

async function cargarPagos(profileId) {
  const cont = document.querySelector(`[data-profile-id="${profileId}"] [data-pagos]`);
  if (!cont) return;
  try {
    const pagos = await adminListarPagos(profileId);
    cont.innerHTML = pagos.length ? `
      <table class="adm-pagos">
        <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Periodo</th><th>Vence</th><th>Operación</th><th></th></tr></thead>
        <tbody>
          ${pagos.map(p => `
            <tr data-pago-id="${p.id}">
              <td>${formatearFechaISO(p.fecha_pago)}</td>
              <td>${soles(p.monto)}</td>
              <td>${escapeHtml(p.metodo)}</td>
              <td>${escapeHtml(p.periodo)}</td>
              <td>${p.vence_en ? formatearFechaISO(p.vence_en) : '—'}</td>
              <td>${escapeHtml(p.referencia || '')}${p.notas ? ` <span class="form-hint">${escapeHtml(p.notas)}</span>` : ''}</td>
              <td><button type="button" class="pf-icon-btn pf-icon-btn--borrar" data-accion="borrar-pago" aria-label="Borrar pago">🗑</button></td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<p class="form-hint">Sin pagos registrados.</p>';
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<p class="form-error">No se pudo cargar el historial.</p>';
  }
}

// ------------------------------------------------------------
// Carga y acciones
// ------------------------------------------------------------
async function cargar() {
  try {
    usuarios = await adminListarUsuarios();
    render();
  } catch (err) {
    console.error(err);
    mensaje('error', 'No se pudo cargar la lista. ¿Corriste la migración 007 en Supabase?');
  }
}

function bindEventos() {
  $('adm-buscar').addEventListener('input', (e) => { busqueda = e.target.value.trim(); renderLista(); });
  $('adm-filtro').addEventListener('change', (e) => { filtro = e.target.value; renderLista(); });
  $('adm-recargar').addEventListener('click', cargar);
  $('btn-logout').addEventListener('click', async () => { await cerrarSesion(); window.location.href = '../index.html'; });

  const lista = $('adm-lista');

  lista.addEventListener('toggle', (e) => {
    const det = e.target;
    if (det.tagName !== 'DETAILS' || !det.dataset.profileId) return;
    if (det.open) { abiertoId = det.dataset.profileId; cargarPagos(abiertoId); }
    else if (abiertoId === det.dataset.profileId) abiertoId = null;
  }, true);

  // Al cambiar el periodo se autocompleta el monto sugerido
  lista.addEventListener('change', (e) => {
    if (e.target.name !== 'periodo') return;
    const monto = e.target.closest('form').elements.monto;
    if (e.target.value === 'mensual') monto.value = CONFIG.PRECIOS.mensual.toFixed(2);
    else if (e.target.value === 'anual') monto.value = CONFIG.PRECIOS.anual.toFixed(2);
  });

  lista.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const profileId = form.closest('[data-profile-id]').dataset.profileId;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      if (form.matches('[data-form-pago]')) {
        const f = form.elements;
        const monto = parseFloat(f.monto.value);
        if (!Number.isFinite(monto) || monto < 0) throw new Error('Ingresa un monto válido.');
        if (f.periodo.value === 'otro' && !f.vence.value) throw new Error('Con periodo "otro" indica la fecha de vencimiento.');
        const vence = await adminRegistrarPago({
          profileId, monto, metodo: f.metodo.value, periodo: f.periodo.value,
          fechaPago: f.fecha.value, venceEn: f.vence.value,
          referencia: f.referencia.value.trim(), notas: f.notas.value.trim(),
        });
        abiertoId = profileId;
        await cargar();
        mensaje('ok', `Pago registrado. Pro activo hasta el ${formatearFechaISO(vence)}.`);
      } else if (form.matches('[data-form-plan]')) {
        const f = form.elements;
        await adminCambiarPlan(profileId, f.plan.value, f.vence.value);
        abiertoId = profileId;
        await cargar();
        mensaje('ok', 'Plan actualizado.');
      }
    } catch (err) {
      console.error(err);
      mensaje('error', err.message || 'No se pudo completar la acción.');
      btn.disabled = false;
    }
  });

  lista.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-accion]');
    if (!btn) return;
    const profileId = btn.closest('[data-profile-id]')?.dataset.profileId;

    if (btn.dataset.accion === 'pausar') {
      btn.disabled = true;
      try {
        await adminActivarPerfil(profileId, btn.dataset.activo !== '1');
        abiertoId = profileId;
        await cargar();
        mensaje('ok', btn.dataset.activo === '1' ? 'Perfil pausado: ya no es visible al público.' : 'Perfil reactivado.');
      } catch (err) {
        console.error(err);
        mensaje('error', err.message || 'No se pudo cambiar el estado.');
        btn.disabled = false;
      }
    }

    if (btn.dataset.accion === 'borrar-pago') {
      if (btn.dataset.confirmar !== '1') {
        btn.dataset.confirmar = '1';
        btn.textContent = '¿Borrar?';
        btn.classList.add('pf-icon-btn--peligro');
        setTimeout(() => {
          if (btn.isConnected) { btn.dataset.confirmar = ''; btn.textContent = '🗑'; btn.classList.remove('pf-icon-btn--peligro'); }
        }, 3000);
        return;
      }
      try {
        await adminEliminarPago(btn.closest('[data-pago-id]').dataset.pagoId);
        abiertoId = profileId;
        await cargar();
        mensaje('ok', 'Pago borrado. Ojo: el plan del usuario no se recalcula; ajústalo con "Cambiar plan" si hace falta.');
      } catch (err) {
        console.error(err);
        mensaje('error', err.message || 'No se pudo borrar el pago.');
      }
    }
  });
}

async function init() {
  const sesion = await protegerPagina('login.html');
  if (!sesion) return;

  const ok = await esAdmin();
  $('estado-carga').style.display = 'none';
  if (!ok) {
    $('estado-no-autorizado').style.display = 'block';
    return;
  }
  $('admin-contenido').style.display = 'block';
  bindEventos();
  await cargar();
}

init();
