// ============================================================
// TARJETA IMPRIMIBLE — dibujo de frente y dorso en canvas.
// Todo se dibuja en MILÍMETROS (el canvas se escala), así el mismo
// código sirve para la vista previa (baja resolución) y para el PDF
// (600 dpi). Medidas: 90×50 mm de corte + 3 mm de sangrado.
// Sin dependencias salvo la librería de QR (ver qr.js).
// ============================================================
import { CONFIG } from './config.js';
import { colorTextoLegible, esHexValido, mezclarConBlanco, cargarGoogleFont } from './utils.js';
import { matrizQR } from './qr.js';

export const MEDIDAS = { W: 90, H: 50, SANGRADO: 3 };

export const LAYOUTS = [
  { id: 'clasica',  nombre: 'Clásica' },
  { id: 'lateral',  nombre: 'Lateral' },
  { id: 'franja',   nombre: 'Franja' },
  { id: 'minimal',  nombre: 'Minimal' },
  { id: 'oscura',   nombre: 'Oscura' },
  { id: 'diagonal', nombre: 'Diagonal' },
  { id: 'qrfrente', nombre: 'QR al frente' },
  { id: 'centrada', nombre: 'Centrada' },
  { id: 'banda',    nombre: 'Banda' },
  { id: 'circulos', nombre: 'Círculos' },
];

export const ESCALAS = { pequeno: 0.88, normal: 1, grande: 1.14 };

export const CONFIG_DEFECTO = {
  layout: 'clasica',
  colorP: null, colorS: null,            // null = usar los colores del perfil
  fuenteTitulo: null, fuenteTexto: null, // null = usar las fuentes del perfil
  textoEscala: 'normal',
  qrEscala: 'normal',
  mostrar: { telefono: true, email: true, web: true, direccion: false },
};

/** Mezcla lo guardado con los valores por defecto y los del perfil, validando todo */
export function normalizarConfig(guardada, perfil) {
  const g = guardada && typeof guardada === 'object' ? guardada : {};
  const cfg = {
    layout: LAYOUTS.some(l => l.id === g.layout) ? g.layout : CONFIG_DEFECTO.layout,
    colorP: esHexValido(g.colorP) ? g.colorP : null,
    colorS: esHexValido(g.colorS) ? g.colorS : null,
    fuenteTitulo: CONFIG.FUENTES_DISPONIBLES.includes(g.fuenteTitulo) ? g.fuenteTitulo : null,
    fuenteTexto: CONFIG.FUENTES_DISPONIBLES.includes(g.fuenteTexto) ? g.fuenteTexto : null,
    textoEscala: ESCALAS[g.textoEscala] ? g.textoEscala : 'normal',
    qrEscala: ESCALAS[g.qrEscala] ? g.qrEscala : 'normal',
    mostrar: { ...CONFIG_DEFECTO.mostrar, ...(g.mostrar && typeof g.mostrar === 'object' ? g.mostrar : {}) },
  };
  const p = perfil || {};
  cfg.P = cfg.colorP || (esHexValido(p.tema_color_primario) ? p.tema_color_primario : CONFIG.TEMA_PRIMARIO_DEFECTO);
  cfg.S = cfg.colorS || (esHexValido(p.tema_color_secundario) ? p.tema_color_secundario : CONFIG.TEMA_SECUNDARIO_DEFECTO);
  cfg.tf = cfg.fuenteTitulo || (CONFIG.FUENTES_DISPONIBLES.includes(p.tema_fuente_titulo) ? p.tema_fuente_titulo : CONFIG.FUENTE_TITULO_DEFECTO);
  cfg.tx = cfg.fuenteTexto || (CONFIG.FUENTES_DISPONIBLES.includes(p.tema_fuente_texto) ? p.tema_fuente_texto : CONFIG.FUENTE_TEXTO_DEFECTO);
  return cfg;
}

/** Lo que se guarda en la BD (sin los valores derivados) */
export function configParaGuardar(cfg) {
  return {
    layout: cfg.layout, colorP: cfg.colorP, colorS: cfg.colorS,
    fuenteTitulo: cfg.fuenteTitulo, fuenteTexto: cfg.fuenteTexto,
    textoEscala: cfg.textoEscala, qrEscala: cfg.qrEscala, mostrar: { ...cfg.mostrar },
  };
}

/** Datos del perfil que aparecen en la tarjeta */
export function datosDeTarjeta(perfil) {
  const url = `${CONFIG.SITE_BASE_URL}/u/${perfil.slug}`;
  const sinProto = (s) => String(s || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return {
    nombre: perfil.nombre_completo || 'Tu nombre',
    cargo: [perfil.cargo, perfil.empresa].filter(Boolean).join(' · '),
    telefono: perfil.telefono || '',
    email: perfil.mostrar_email ? (perfil.email_contacto || '') : '',
    web: sinProto(perfil.redes?.web),
    direccion: perfil.direccion || '',
    url: `${url}?s=qr`,          // el QR marca su origen para las estadísticas
    urlCorta: sinProto(url),
  };
}

// ---------- utilidades de color ----------
function luminancia(hex) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const TINTA = '#1F2430';

// ---------- primitivas de dibujo (todo en mm) ----------
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function circ(ctx, x, y, r, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}
function poly(ctx, pts, color) {
  ctx.fillStyle = color; ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * Texto en mm. Se dibuja a escala ×10 para que el motor de fuentes
 * nunca trabaje con tamaños diminutos. Si no cabe en maxW, primero
 * encoge hasta 62% y luego corta con "…".
 */
function T(ctx, s, x, y, o) {
  s = String(s ?? '').trim();
  if (!s) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(0.1, 0.1);
  let size = o.size * 10;
  const fam = `"${o.font}", sans-serif`;
  const fijar = () => { ctx.font = `${o.weight || 400} ${size}px ${fam}`; };
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = o.color; ctx.globalAlpha = o.alpha ?? 1;
  fijar();
  // Cargos largos en columnas angostas: se parten en 2 líneas equilibradas
  // (si no caben a tamaño completo, se prueba con letra algo más chica)
  if (o.wrap && o.maxW && ctx.measureText(s).width > o.maxW * 10) {
    const pal = s.split(' ');
    for (let f = 1; f >= 0.72; f -= 0.07) {
      size = o.size * 10 * f; fijar();
      let mejor = null;
      for (let i = 1; i < pal.length; i++) {
        const a = pal.slice(0, i).join(' '), b = pal.slice(i).join(' ');
        const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
        if (!mejor || w < mejor.w) mejor = { a, b, w };
      }
      if (mejor && mejor.w <= o.maxW * 10) {
        ctx.restore();
        T(ctx, mejor.a, x, y, { ...o, size: o.size * f, wrap: false });
        T(ctx, mejor.b, x, y + o.size * f * 1.3, { ...o, size: o.size * f, wrap: false });
        return;
      }
    }
    size = o.size * 10; fijar();
  }
  if (o.maxW) {
    const tope = o.maxW * 10;
    while (ctx.measureText(s).width > tope && size > o.size * 10 * 0.62) { size -= o.size * 0.4; fijar(); }
    if (ctx.measureText(s).width > tope) {
      while (s.length > 1 && ctx.measureText(s + '…').width > tope) s = s.slice(0, -1);
      s = s.trimEnd() + '…';
    }
  }
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

/** QR: caja clara con zona tranquila + módulos oscuros. Siempre oscuro sobre claro (escaneable) */
function QR(ctx, m, x, y, size, radio = 1.4) {
  const n = m.length, quiet = 2, mod = size / (n + quiet * 2);
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, y, size, size, radio); ctx.fill();
  ctx.fillStyle = '#111111';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (m[r][c]) ctx.fillRect(x + (quiet + c) * mod - 0.004, y + (quiet + r) * mod - 0.004, mod + 0.008, mod + 0.008);
  }
}

/** Lista de contactos anclada al borde inferior (bottom = línea base de la última) */
function lista(ctx, items, x, bottom, o) {
  const gap = o.gap;
  items.forEach((s, i) => {
    const y = bottom - (items.length - 1 - i) * gap;
    if (o.align === 'center') {
      T(ctx, s, x, y, { size: o.size, font: o.font, color: o.color, align: 'center', maxW: o.maxW, alpha: o.alpha });
    } else if (o.align === 'right') {
      T(ctx, s, x, y, { size: o.size, font: o.font, color: o.color, align: 'right', maxW: o.maxW, alpha: o.alpha });
    } else {
      circ(ctx, x + 0.6, y - o.size * 0.32, 0.55, o.dot || o.color);
      T(ctx, s, x + 2.4, y, { size: o.size, font: o.font, color: o.color, maxW: o.maxW - 2.4, alpha: o.alpha });
    }
  });
}

function iniciales(nombre) {
  return String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

// ---------- los 10 diseños ----------
// Cada uno: { frente(L), dorso(L) }. L = { ctx, d, cfg, c, m, k, q, lineas }
// k = escala de texto, q = escala de QR. Zona segura: 4 mm desde el corte.
const BLEED = [-3, -3, 96, 56];
const clampQR = (s, max) => Math.min(s, max);

const DISENOS = {
  clasica: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, cfg.P);
      rect(ctx, 6, 9, 10, 1.1, cfg.S);
      T(ctx, d.nombre, 6, 21, { size: 7.2 * k, font: cfg.tf, weight: 700, color: c.onP, maxW: 78 });
      T(ctx, d.cargo, 6, 27.2, { size: 3.5 * k, font: cfg.tx, weight: 500, color: c.onP, alpha: 0.9, maxW: 78 });
      lista(ctx, lineas, 6, 45.5, { size: 2.9 * k, gap: 4.2 * k, font: cfg.tx, color: c.onP, dot: c.onP, maxW: 78 });
    },
    dorso({ ctx, d, cfg, c, m, q }) {
      rect(ctx, ...BLEED, mezclarConBlanco(cfg.P, 0.9));
      const s = clampQR(30 * q, 36), x = (90 - s) / 2;
      QR(ctx, m, x, (50 - s) / 2 - 3, s);
      T(ctx, d.urlCorta, 45, (50 - s) / 2 - 3 + s + 4.6, { size: 2.6, font: cfg.tx, weight: 500, color: c.ink, align: 'center', maxW: 78 });
    },
  },

  lateral: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, '#FFFFFF');
      rect(ctx, -3, -3, 33, 56, cfg.P);
      circ(ctx, 15, 25, 9.5, cfg.S);
      T(ctx, iniciales(d.nombre), 15, 25 + 2.9, { size: 8.4, font: cfg.tf, weight: 700, color: c.onS, align: 'center' });
      T(ctx, d.nombre, 35, 17, { size: 5.8 * k, font: cfg.tf, weight: 700, color: c.ink, maxW: 50 });
      T(ctx, d.cargo, 35, 22.6, { wrap: true, size: 3.1 * k, font: cfg.tx, weight: 500, color: c.inkP, maxW: 50 });
      lista(ctx, lineas, 35, 45.5, { size: 2.7 * k, gap: 4 * k, font: cfg.tx, color: c.ink, dot: c.inkP, maxW: 51 });
    },
    dorso({ ctx, d, cfg, c, m, q, k }) {
      rect(ctx, ...BLEED, cfg.S);
      const s = clampQR(30 * q, 38);
      QR(ctx, m, 90 - 6 - s, (50 - s) / 2, s);
      const w = 90 - 12 - s - 4;
      T(ctx, 'Escanéame', 6, 21, { size: 6 * k, font: cfg.tf, weight: 700, color: c.onS, maxW: w });
      T(ctx, d.nombre, 6, 27.5, { size: 3.2 * k, font: cfg.tx, color: c.onS, alpha: 0.85, maxW: w });
      T(ctx, d.urlCorta, 6, 45.5, { size: 2.4, font: cfg.tx, color: c.onS, alpha: 0.75, maxW: w });
    },
  },

  franja: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, '#FFFFFF');
      rect(ctx, -3, -3, 96, 17, cfg.P);
      T(ctx, d.nombre, 6, 10.2, { size: 5.6 * k, font: cfg.tf, weight: 700, color: c.onP, maxW: 78 });
      T(ctx, d.cargo, 6, 22.5, { size: 3.3 * k, font: cfg.tx, weight: 500, color: c.ink, maxW: 78 });
      rect(ctx, 6, 26, 8, 0.8, c.inkP);
      lista(ctx, lineas, 6, 45.5, { size: 2.8 * k, gap: 4.1 * k, font: cfg.tx, color: c.ink, dot: c.inkP, maxW: 78 });
    },
    dorso({ ctx, d, cfg, c, m, q, k }) {
      rect(ctx, ...BLEED, cfg.P);
      const s = clampQR(30 * q, 38);
      QR(ctx, m, 6, (50 - s) / 2, s);
      const x = 6 + s + 6, w = 90 - 6 - x;
      T(ctx, d.nombre, x, 21, { size: 5 * k, font: cfg.tf, weight: 700, color: c.onP, maxW: w });
      T(ctx, d.cargo, x, 27, { wrap: true, size: 3 * k, font: cfg.tx, color: c.onP, alpha: 0.9, maxW: w });
      T(ctx, d.urlCorta, x, 45.5, { size: 2.4, font: cfg.tx, color: c.onP, alpha: 0.8, maxW: w });
    },
  },

  minimal: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, '#FAFAF8');
      T(ctx, d.nombre, 6, 20, { size: 6.4 * k, font: cfg.tf, weight: 700, color: c.ink, maxW: 78 });
      rect(ctx, 6, 23.2, 12, 0.7, c.inkP);
      T(ctx, d.cargo, 6, 29.5, { size: 3.2 * k, font: cfg.tx, color: c.ink, alpha: 0.75, maxW: 78 });
      lista(ctx, lineas, 6, 45.5, { size: 2.7 * k, gap: 4 * k, font: cfg.tx, color: c.ink, dot: c.inkP, maxW: 78 });
    },
    dorso({ ctx, d, cfg, c, m, q }) {
      rect(ctx, ...BLEED, cfg.S);
      const s = clampQR(24 * q, 32), y = (50 - s) / 2 - 2;
      QR(ctx, m, (90 - s) / 2, y, s);
      T(ctx, d.urlCorta, 45, y + s + 4.6, { size: 2.4, font: cfg.tx, color: c.onS, alpha: 0.8, align: 'center', maxW: 78 });
    },
  },

  oscura: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, cfg.S);
      rect(ctx, -3, -3, 5.5, 56, cfg.P);
      T(ctx, d.nombre, 10, 20, { size: 6.6 * k, font: cfg.tf, weight: 700, color: c.onS, maxW: 74 });
      T(ctx, d.cargo, 10, 26.5, { size: 3.3 * k, font: cfg.tx, weight: 500, color: c.acento, maxW: 74 });
      lista(ctx, lineas, 10, 45.5, { size: 2.8 * k, gap: 4.1 * k, font: cfg.tx, color: c.onS, alpha: 0.92, dot: c.acento, maxW: 74 });
    },
    dorso({ ctx, cfg, c, m, q }) {
      rect(ctx, ...BLEED, cfg.S);
      const s = clampQR(26 * q, 30);
      ctx.strokeStyle = c.acento; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(45, 25, s * 0.74, 0, Math.PI * 2); ctx.stroke();
      QR(ctx, m, (90 - s) / 2, (50 - s) / 2, s);
    },
  },

  diagonal: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, '#FFFFFF');
      poly(ctx, [[-3, -3], [54, -3], [34, 53], [-3, 53]], cfg.P);
      poly(ctx, [[54, -3], [58, -3], [38, 53], [34, 53]], cfg.S);
      T(ctx, d.nombre, 6, 20, { size: 5.8 * k, font: cfg.tf, weight: 700, color: c.onP, maxW: 33 });
      T(ctx, d.cargo, 6, 26, { wrap: true, size: 3 * k, font: cfg.tx, color: c.onP, alpha: 0.9, maxW: 32 });
      lista(ctx, lineas, 84, 45.5, { size: 2.7 * k, gap: 4 * k, font: cfg.tx, color: c.ink, align: 'right', maxW: 36 });
    },
    dorso({ ctx, cfg, m, q }) {
      rect(ctx, ...BLEED, '#FFFFFF');
      poly(ctx, [[93, -3], [56, -3], [76, 53], [93, 53]], cfg.P);
      poly(ctx, [[52, -3], [56, -3], [76, 53], [72, 53]], cfg.S);
      const s = clampQR(30 * q, 36);
      QR(ctx, m, 31 - s / 2, (50 - s) / 2, s);
    },
  },

  qrfrente: {
    frente({ ctx, d, cfg, c, m, q, k, lineas }) {
      rect(ctx, ...BLEED, '#FFFFFF');
      const s = clampQR(34 * q, 40);
      rect(ctx, -3, -3, 5 + s + 2.5, 56, mezclarConBlanco(cfg.P, 0.82));
      QR(ctx, m, 5, (50 - s) / 2, s);
      const x = 5 + s + 7, w = 90 - 5 - x;
      T(ctx, d.nombre, x, 17, { size: 5 * k, font: cfg.tf, weight: 700, color: c.ink, maxW: w });
      T(ctx, d.cargo, x, 22.4, { wrap: true, size: 2.9 * k, font: cfg.tx, color: c.inkP, maxW: w });
      lista(ctx, lineas, x, 45.5, { size: 2.5 * k, gap: 3.8 * k, font: cfg.tx, color: c.ink, dot: c.inkP, maxW: w });
    },
    dorso({ ctx, d, cfg, c, k }) {
      rect(ctx, ...BLEED, cfg.P);
      T(ctx, d.nombre, 45, 24, { size: 8 * k, font: cfg.tf, weight: 700, color: c.onP, align: 'center', maxW: 78 });
      T(ctx, d.cargo, 45, 31, { size: 3.6 * k, font: cfg.tx, color: c.onP, alpha: 0.9, align: 'center', maxW: 78 });
      rect(ctx, 39, 35, 12, 1.1, cfg.S);
    },
  },

  centrada: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, cfg.P);
      T(ctx, d.nombre, 45, 19.5, { size: 6.8 * k, font: cfg.tf, weight: 700, color: c.onP, align: 'center', maxW: 78 });
      T(ctx, d.cargo, 45, 25.5, { size: 3.3 * k, font: cfg.tx, weight: 500, color: c.onP, alpha: 0.9, align: 'center', maxW: 78 });
      rect(ctx, 40, 28.6, 10, 0.9, cfg.S);
      lista(ctx, lineas, 45, 45.5, { size: 2.7 * k, gap: 3.9 * k, font: cfg.tx, color: c.onP, align: 'center', maxW: 78 });
    },
    dorso({ ctx, cfg, m, q }) {
      rect(ctx, ...BLEED, '#FFFFFF');
      const s = clampQR(26 * q, 30);
      ctx.strokeStyle = cfg.S; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(45, 25, s * 0.74, 0, Math.PI * 2); ctx.stroke();
      QR(ctx, m, (90 - s) / 2, (50 - s) / 2, s);
    },
  },

  banda: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, '#FFFFFF');
      T(ctx, d.nombre, 6, 14.5, { size: 6.2 * k, font: cfg.tf, weight: 700, color: c.ink, maxW: 78 });
      T(ctx, d.cargo, 6, 20.5, { size: 3.2 * k, font: cfg.tx, weight: 500, color: c.inkP, maxW: 78 });
      rect(ctx, -3, 29.5, 96, 24, cfg.P);
      lista(ctx, lineas, 6, 45.5, { size: 2.7 * k, gap: 3.6 * k, font: cfg.tx, color: c.onP, dot: c.onP, maxW: 78 });
    },
    dorso({ ctx, d, cfg, c, m, q, k }) {
      rect(ctx, ...BLEED, cfg.S);
      const s = clampQR(30 * q, 38);
      QR(ctx, m, 90 - 6 - s, (50 - s) / 2, s);
      const w = 90 - 12 - s - 4;
      T(ctx, 'Guarda mi contacto', 6, 19, { size: 4.6 * k, font: cfg.tf, weight: 700, color: c.onS, maxW: w });
      T(ctx, d.nombre, 6, 26, { size: 3.2 * k, font: cfg.tx, color: c.onS, alpha: 0.85, maxW: w });
      T(ctx, d.urlCorta, 6, 45.5, { size: 2.4, font: cfg.tx, color: c.onS, alpha: 0.8, maxW: w });
    },
  },

  circulos: {
    frente({ ctx, d, cfg, c, k, lineas }) {
      rect(ctx, ...BLEED, '#FFFFFF');
      ctx.save(); ctx.beginPath(); ctx.rect(...BLEED); ctx.clip();
      circ(ctx, 82, 4, 24, cfg.P);
      circ(ctx, 92, 52, 16, cfg.S);
      ctx.restore();
      T(ctx, d.nombre, 6, 19, { size: 6 * k, font: cfg.tf, weight: 700, color: c.ink, maxW: 56 });
      T(ctx, d.cargo, 6, 25, { size: 3.2 * k, font: cfg.tx, weight: 500, color: c.inkP, maxW: 56 });
      lista(ctx, lineas, 6, 45.5, { size: 2.7 * k, gap: 4 * k, font: cfg.tx, color: c.ink, dot: c.inkP, maxW: 56 });
    },
    dorso({ ctx, d, cfg, c, m, q, k }) {
      rect(ctx, ...BLEED, cfg.P);
      ctx.save(); ctx.beginPath(); ctx.rect(...BLEED); ctx.clip();
      circ(ctx, -4, 56, 28, cfg.S);
      circ(ctx, 95, -5, 30, '#FFFFFF', 0.12);
      ctx.restore();
      const s = clampQR(30 * q, 36);
      QR(ctx, m, 90 - 6 - s, (50 - s) / 2, s);
      const w = 90 - 12 - s - 4;
      T(ctx, 'Escanéame', 6, 22, { size: 5.2 * k, font: cfg.tf, weight: 700, color: c.onP, maxW: w });
      T(ctx, d.nombre, 6, 28, { size: 3.2 * k, font: cfg.tx, color: c.onP, alpha: 0.9, maxW: w });
    },
  },
};

// ---------- orquestación ----------
async function cargarFuentes(cfg) {
  cargarGoogleFont(cfg.tf); cargarGoogleFont(cfg.tx);
  const esperar = Promise.all([
    document.fonts.load(`700 20px "${cfg.tf}"`), document.fonts.load(`500 20px "${cfg.tf}"`),
    document.fonts.load(`400 20px "${cfg.tx}"`), document.fonts.load(`500 20px "${cfg.tx}"`),
  ]).catch(() => {});
  await Promise.race([esperar, new Promise(r => setTimeout(r, 3500))]);
}

const _cacheQR = new Map();
async function matriz(texto) {
  if (!_cacheQR.has(texto)) _cacheQR.set(texto, await matrizQR(texto));
  return _cacheQR.get(texto);
}

/**
 * Dibuja una cara ('frente' | 'dorso') en el canvas.
 * ppm = píxeles por milímetro (preview ≈ 8; PDF 600 dpi ≈ 23.622).
 * conSangrado=true → canvas de 96×56 mm (para imprenta); false → 90×50 (vista previa).
 */
export async function dibujarCara(canvas, cara, datos, cfg, { ppm = 8, conSangrado = false, fuentesListas = false } = {}) {
  if (!fuentesListas) await cargarFuentes(cfg);
  const m = await matriz(datos.url);
  const sg = conSangrado ? MEDIDAS.SANGRADO : 0;
  canvas.width = Math.round((MEDIDAS.W + sg * 2) * ppm);
  canvas.height = Math.round((MEDIDAS.H + sg * 2) * ppm);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ppm, 0, 0, ppm, sg * ppm, sg * ppm);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-3, -3, 96, 56);

  const onP = colorTextoLegible(cfg.P), onS = colorTextoLegible(cfg.S);
  const ink = ratio(cfg.S, '#FFFFFF') >= 7 ? cfg.S : TINTA;
  const inkP = ratio(cfg.P, '#FFFFFF') >= 4.5 ? cfg.P : ink;
  const acento = ratio(cfg.P, cfg.S) >= 3 ? cfg.P : onS;
  const c = { onP, onS, ink, inkP, acento };

  const lineas = [];
  if (cfg.mostrar.telefono && datos.telefono) lineas.push(datos.telefono);
  if (cfg.mostrar.email && datos.email) lineas.push(datos.email);
  if (cfg.mostrar.web && datos.web) lineas.push(datos.web);
  if (cfg.mostrar.direccion && datos.direccion) lineas.push(datos.direccion);
  const recorte = lineas.slice(0, 4);

  const kTxt = ESCALAS[cfg.textoEscala];
  const L = { ctx, d: datos, cfg, c, m, k: kTxt, q: ESCALAS[cfg.qrEscala], lineas: recorte };
  ctx.save();
  DISENOS[cfg.layout][cara === 'dorso' ? 'dorso' : 'frente'](L);
  ctx.restore();
}

export const _fuentesListas = cargarFuentes;
