/* ============================================================
   landing.js — TARJE
   - Nombre de marca (una sola constante)
   - QR ilustrativo generado en el navegador (no es escaneable: es de muestra)
   - Escena del hero: el rayo recorre el QR y el perfil se revela
   - Demo con dos perfiles de ejemplo (datos embebidos, sin backend)
   - Enlaces a WhatsApp de ventas (CONFIG.WHATSAPP_VENTAS)
   Sin dependencias. Módulo ES6 (requiere Live Server, no file://).
============================================================ */
import { CONFIG } from './config.js';

const MARCA = 'TARJE';

/* ------------------------------------------------------------
   QR de muestra: 25×25 con los tres cuadros guía y ruido con
   semilla fija, para que se vea igual en cada visita.
------------------------------------------------------------ */
function qrPath(seed = 7) {
  const N = 25;
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  let s = seed;
  const rnd = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g[y][x] = rnd() > 0.5 ? 1 : 0;

  const guia = (ox, oy) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const X = ox + x, Y = oy + y;
        if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
        const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        g[Y][X] = (d === 3 || d <= 1) ? 1 : 0;
      }
    }
  };
  guia(0, 0); guia(N - 7, 0); guia(0, N - 7);

  // cuadro de alineación pequeño
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
    const d = Math.max(Math.abs(x), Math.abs(y));
    g[18 + y][18 + x] = (d === 2 || d === 0) ? 1 : 0;
  }

  let d = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) d += `M${x} ${y}h1v1h-1z`;
  return d;
}
const qrSvgInline = (seed) => `<svg viewBox="0 0 25 25" shape-rendering="crispEdges" aria-hidden="true"><path d="${qrPath(seed)}"/></svg>`;

/* ------------------------------------------------------------
   Datos demo. De ejemplo a propósito: ninguna persona, negocio
   ni cifra de aquí es real.
------------------------------------------------------------ */
const DEMOS = {
  profesional: {
    titulo: 'Un profesional que vive de su trabajo',
    texto: 'Alguien que se presenta todos los días: un desarrollador, una arquitecta, un dentista, un abogado. Lo que vende es su experiencia, así que su perfil muestra trabajos, no productos.',
    bullets: [
      'Portafolio con sus trabajos y el detalle de cada uno',
      'Botón para agendar una cita según su horario',
      'Enlace directo a WhatsApp y a sus redes',
      'Su QR en la tarjeta impresa que reparte'
    ],
    perfil: {
      inicial: 'MR',
      nombre: 'María Rojas',
      rol: 'Arquitecta · Estudio propio',
      bio: 'Diseño y remodelación de viviendas en Lima. 9 años de obras entregadas.',
      acciones: ['Agendar cita', 'WhatsApp', 'Guardar contacto'],
      seccion: 'Portafolio',
      items: [
        { ico: '🏠', bg: 'var(--lil)',  t: 'Casa Carapongo', d: 'Remodelación integral, 180 m²' },
        { ico: '🏢', bg: 'var(--mint)', t: 'Oficina SJL',    d: 'Diseño interior y mobiliario' },
        { ico: '📐', bg: '#FFE6A8',     t: 'Dúplex Surco',   d: 'Proyecto en desarrollo' }
      ]
    }
  },
  negocio: {
    titulo: 'Un negocio con local y clientes de paso',
    texto: 'Un restaurante, una tienda, una veterinaria. Lo que vende son productos, así que el QR va en la mesa, la vitrina o la puerta, y la carta se actualiza sin reimprimir nada.',
    bullets: [
      'Tu carta o catálogo en el carrusel, con fotos y precios',
      'El QR pegado en la mesa o en la vitrina',
      'Cambias un plato o un precio y ya está actualizado',
      'Horario, ubicación y pedido por WhatsApp'
    ],
    perfil: {
      inicial: 'DL',
      nombre: 'Doña Lucha',
      rol: 'Menú y pollos a la brasa · Huachipa',
      bio: 'Atendemos de 11:00 a 22:00. Delivery en la zona.',
      acciones: ['Ver carta', 'Pedir por WhatsApp', 'Cómo llegar'],
      seccion: 'Nuestra carta',
      items: [
        { ico: '🍗', bg: '#FFE6A8',     t: 'Pollo entero',   d: 'Con papas y ensalada' },
        { ico: '🍲', bg: 'var(--mint)', t: 'Menú del día',   d: 'Entrada, fondo y refresco' },
        { ico: '🥤', bg: 'var(--lil)',  t: 'Para compartir', d: 'Jarras y combos familiares' }
      ]
    }
  }
};

function renderPerfil(p, seedQr = 11) {
  const chips = p.acciones
    .map((a, i) => `<span class="dm-chip${i === 0 ? ' dm-chip--solid' : ''}">${a}</span>`)
    .join('');
  const cards = p.items.map(it => `
    <article class="dm-card">
      <div class="dm-card__img" style="background:${it.bg}">${it.ico}</div>
      <div class="dm-card__t">${it.t}</div>
      <p class="dm-card__d">${it.d}</p>
    </article>`).join('');

  // Cada bloque lleva su índice para escalonar la entrada en la escena del hero
  return `
    <div class="dm-cover"></div>
    <div class="dm-body">
      <div class="dm-avatar" style="--i:0">${p.inicial}</div>
      <h3 class="dm-name" style="--i:1">${p.nombre}</h3>
      <p class="dm-role" style="--i:2">${p.rol}</p>
      <p class="dm-bio" style="--i:3">${p.bio}</p>
      <div class="dm-actions" style="--i:4">${chips}</div>
      <h4 class="dm-h" style="--i:5">${p.seccion}</h4>
      <div class="dm-rail" style="--i:6">${cards}</div>
      <div class="dm-qr" style="--i:7">
        <div class="dm-qr__box">${qrSvgInline(seedQr)}</div>
        <p class="dm-qr__t">Este QR lleva a este perfil</p>
      </div>
    </div>`;
}

/* ------------------------------------------------------------
   WhatsApp de ventas: el cobro y la atención se gestionan por ahí
------------------------------------------------------------ */
function linkWhatsApp(mensaje) {
  let n = String(CONFIG.WHATSAPP_VENTAS || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.length === 9) n = '51' + n;           // número peruano sin código de país
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`;
}

const MENSAJES_WA = {
  pro: `Hola, quiero el plan Pro de ${MARCA}.`,
  contacto: `Hola, vi ${MARCA} y quiero más información.`,
};

/* ------------------------------------------------------------
   Arranque
------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-marca]').forEach(el => { el.textContent = MARCA; });
  const anio = document.getElementById('anio');
  if (anio) anio.textContent = new Date().getFullYear();

  // QR de muestra en la tarjeta impresa y en el bloque de funciones
  document.querySelectorAll('svg[data-qr]').forEach(svg => {
    svg.innerHTML = `<path d="${qrPath(svg.dataset.qr === 'hero' ? 11 : 5)}"/>`;
  });

  // WhatsApp
  document.querySelectorAll('[data-wa]').forEach(a => {
    const link = linkWhatsApp(MENSAJES_WA[a.dataset.wa] || MENSAJES_WA.contacto);
    if (link) { a.href = link; a.target = '_blank'; a.rel = 'noopener'; }
    else if (a.dataset.wa === 'contacto') a.hidden = true;   // sin número, "pro" cae a crear.html
  });

  // Escena del hero
  const hero = document.getElementById('demo-screen');
  if (hero) hero.innerHTML = renderPerfil(DEMOS.profesional.perfil, 11);

  const escena = document.getElementById('escena');
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reproducir = () => {
    if (!escena || sinMovimiento) return;
    escena.classList.remove('play');
    escena.classList.add('is-armed');
    void escena.offsetWidth;                  // reinicia las animaciones
    escena.classList.add('play');
  };
  document.getElementById('replay')?.addEventListener('click', reproducir);
  setTimeout(reproducir, 350);

  // Demo con pestañas
  const pantalla = document.getElementById('demo-screen-2');
  const titulo = document.getElementById('demo-titulo');
  const texto = document.getElementById('demo-texto');
  const bullets = document.getElementById('demo-bullets');
  const tabs = [...document.querySelectorAll('.lp-tab')];

  function pintarDemo(clave) {
    const d = DEMOS[clave];
    if (!d || !pantalla) return;
    titulo.textContent = d.titulo;
    texto.textContent = d.texto;
    bullets.innerHTML = d.bullets.map(b => `<li>${b}</li>`).join('');
    pantalla.innerHTML = renderPerfil(d.perfil, clave === 'profesional' ? 11 : 23);
    pantalla.style.animation = 'none';
    void pantalla.offsetWidth;
    pantalla.style.animation = '';
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.demo === clave)));
  }

  document.querySelector('.lp-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.lp-tab');
    if (btn) pintarDemo(btn.dataset.demo);
  });
  pintarDemo('profesional');
});
