// ============================================================
// ESTADÍSTICAS de visitas y escaneos del QR
//  - registrarVisita(slug): la llama el perfil público (anónimo).
//    El QR impreso lleva ?s=qr, así se distingue de un link normal.
//  - obtenerEstadisticas() / pintarEstadisticas(): el dashboard.
// Privacidad: por defecto solo se suman contadores por día. No se
// guarda IP ni datos personales. CONFIG.ESTADISTICAS.guardarDetalle
// (hoy false = deshabilitado) activaría dispositivo/idioma/referrer.
// ============================================================
import { CONFIG } from './config.js';
import { getSupabaseClient } from './supabase-client.js';

/** Registra una visita (una por pestaña/sesión y perfil; nunca rompe la página) */
export async function registrarVisita(slug) {
  try {
    const clave = `tarje_visita_${slug}`;
    try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1'); } catch { /* sin storage: se cuenta igual */ }

    const origen = new URLSearchParams(window.location.search).get('s') === 'qr' ? 'qr' : 'link';
    let detalle = null;
    if (CONFIG.ESTADISTICAS?.guardarDetalle) {
      detalle = {
        dispositivo: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'móvil' : 'escritorio',
        idioma: navigator.language || '',
        referrer: document.referrer ? new URL(document.referrer).hostname : '',
      };
    }
    const supabase = await getSupabaseClient();
    await supabase.rpc('registrar_visita', { p_slug: slug, p_origen: origen, p_detalle: detalle });
  } catch (err) {
    console.warn('No se pudo registrar la visita', err);
  }
}

/** { pro, dias, total, qr, link, serie:[{dia,qr,link}] } */
export async function obtenerEstadisticas(dias = CONFIG.ESTADISTICAS?.dias || 30) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('estadisticas_perfil', { p_dias: dias });
  if (error) throw error;
  return data;
}

function barras(serie) {
  const n = serie.length;
  const max = Math.max(1, ...serie.map(s => s.qr + s.link));
  const W = 300, H = 64, paso = W / n, ancho = Math.max(2, paso * 0.68);
  const rects = serie.map((s, i) => {
    const x = (i * paso + (paso - ancho) / 2).toFixed(1);
    const hQ = (s.qr / max) * (H - 4), hL = (s.link / max) * (H - 4);
    const tip = `${s.dia.slice(8, 10)}/${s.dia.slice(5, 7)}: ${s.qr} por QR · ${s.link} por link`;
    return `<g><title>${tip}</title>
      <rect x="${x}" y="${(H - hL).toFixed(1)}" width="${ancho.toFixed(1)}" height="${hL.toFixed(1)}" rx="1" fill="var(--gray-300)"/>
      <rect x="${x}" y="${(H - hL - hQ).toFixed(1)}" width="${ancho.toFixed(1)}" height="${hQ.toFixed(1)}" rx="1" fill="var(--color-primary)"/></g>`;
  }).join('');
  return `<svg class="stats-barras" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Visitas por día en los últimos ${n} días">${rects}</svg>`;
}

/** Pinta el bloque de estadísticas dentro de `el` */
export function pintarEstadisticas(el, d, { linkPro = '' } = {}) {
  if (!el) return;
  const pct = d.total ? Math.round((d.qr / d.total) * 100) : 0;
  const cifras = `
    <div class="stats-cifras">
      <div><strong>${d.total}</strong><span>visitas</span></div>
      <div><strong>${d.qr}</strong><span>desde el QR${d.total ? ` (${pct}%)` : ''}</span></div>
      <div><strong>${d.link}</strong><span>desde un link</span></div>
    </div>`;
  if (d.pro) {
    el.innerHTML = cifras + (d.total
      ? `${barras(d.serie)}
         <p class="stats-leyenda"><i style="background:var(--color-primary)"></i> QR <i style="background:var(--gray-300)"></i> Link · últimos ${d.dias} días</p>`
      : '<p class="form-hint">Aún no hay visitas. Cuando alguien abra tu tarjeta, aparecerá aquí.</p>');
  } else {
    el.innerHTML = cifras + `
      <p class="form-hint">El detalle por día es del plan Pro.
      ${linkPro ? `<a href="${linkPro}" target="_blank" rel="noopener">Quiero Pro</a>` : ''}</p>`;
  }
}
