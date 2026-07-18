// ============================================================
// UTILS — funciones auxiliares compartidas
// ============================================================

/** Normaliza texto a slug: minúsculas, sin acentos, solo a-z0-9- */
export function slugify(texto = '') {
  return texto
    .toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Muestra un toast no bloqueante que se auto-oculta. */
export function showToast(mensaje, duracionMs = 4000) {
  let contenedor = document.getElementById('toast-container');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toast-container';
    contenedor.setAttribute('aria-live', 'polite');
    document.body.appendChild(contenedor);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');

  const texto = document.createElement('span');
  texto.textContent = mensaje;

  const cerrar = document.createElement('button');
  cerrar.className = 'toast__cerrar';
  cerrar.setAttribute('aria-label', 'Cerrar aviso');
  cerrar.innerHTML = '&times;';
  cerrar.addEventListener('click', () => toast.remove());

  toast.appendChild(texto);
  toast.appendChild(cerrar);
  contenedor.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  const timer = setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, duracionMs);

  toast.addEventListener('click', () => clearTimeout(timer));
}

/** Validación simple de email */
export function esEmailValido(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Escapa HTML para prevenir XSS al insertar texto de usuario en el DOM */
export function escapeHtml(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Formatea un número de teléfono para link tel: / wa.me (solo dígitos) */
export function soloDigitos(str = '') {
  return str.replace(/\D/g, '');
}

/** Lee el borrador del wizard desde localStorage */
export function leerBorrador(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Guarda el borrador del wizard en localStorage */
export function guardarBorrador(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('No se pudo guardar el borrador local:', e);
  }
}

/** Limpia el borrador (tras registro exitoso) */
export function limpiarBorrador(key) {
  localStorage.removeItem(key);
}

/** Debounce genérico */
export function debounce(fn, wait = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Comprime/redimensiona una imagen en el navegador antes de subirla
 * (canvas + toBlob JPEG). Reduce drásticamente el consumo del free
 * tier de Storage sin depender de ningún servicio externo de pago.
 * Ver docs/ARQUITECTURA-VCARD.md sección 3.4 y ADR-005.
 *
 * @param {File} file - archivo original seleccionado por el usuario
 * @param {number} maxDimensionPx - lado máximo (ancho o alto) en píxeles
 * @param {number} calidad - 0 a 1, calidad JPEG
 * @returns {Promise<Blob>}
 */
export function comprimirImagen(file, maxDimensionPx = 1080, calidad = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimensionPx || height > maxDimensionPx) {
        if (width >= height) {
          height = Math.round((height * maxDimensionPx) / width);
          width = maxDimensionPx;
        } else {
          width = Math.round((width * maxDimensionPx) / height);
          height = maxDimensionPx;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // Fondo blanco por si el original tiene transparencia (PNG -> JPEG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error('No se pudo procesar la imagen'));
        },
        'image/jpeg',
        calidad
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Archivo de imagen inválido'));
    };

    img.src = url;
  });
}

/** Convierte un Blob/File a data URL base64 (para guardarlo temporalmente en user_metadata) */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });
}

/** Convierte un data URL base64 de vuelta a Blob (para subirlo a Storage) */
export async function base64ADataBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

// ------------------------------------------------------------
// Contraste de color (WCAG) — permite que el usuario elija
// cualquier color libre en "Diseño" y aun así el texto se vea
// legible: se calcula automáticamente si conviene texto blanco
// o gris oscuro sobre ese fondo. Ver ADR-006.
// ------------------------------------------------------------

/** Valida que un string sea un hex de color de 6 dígitos (#rrggbb) */
export function esHexValido(hex = '') {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

function luminanciaRelativa(hex) {
  const limpio = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(limpio.substring(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Ratio de contraste WCAG entre dos colores hex (1 a 21) */
export function ratioContraste(hex1, hex2) {
  const l1 = luminanciaRelativa(hex1);
  const l2 = luminanciaRelativa(hex2);
  const [claro, oscuro] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Dado un color de fondo, devuelve '#FFFFFF' o el gris oscuro de la
 * app ('#1F2430'), el que tenga mejor contraste — así cualquier color
 * que el usuario elija en "Diseño" mantiene texto legible encima.
 */
export function colorTextoLegible(hexFondo) {
  if (!esHexValido(hexFondo)) return '#1F2430';
  const BLANCO = '#FFFFFF';
  const OSCURO = '#1F2430';
  const contrasteBlanco = ratioContraste(hexFondo, BLANCO);
  const contrasteOscuro = ratioContraste(hexFondo, OSCURO);
  return contrasteBlanco >= contrasteOscuro ? BLANCO : OSCURO;
}

// ------------------------------------------------------------
// Iconos de redes sociales y de contacto — se cargan en tiempo real
// desde librerías públicas y gratuitas de código abierto:
//   - Simple Icons (logos oficiales de marca: Instagram, Facebook,
//     LinkedIn, X, TikTok, WhatsApp) vía CDN jsDelivr.
//   - Lucide (íconos genéricos de línea: teléfono, email, ubicación,
//     horario, globo/web) vía CDN jsDelivr.
// Ambas son gratuitas (MIT/CC0) y no requieren build ni API key.
// Como fetch() es asíncrono, se precargan una vez al importar este
// módulo y se cachean en memoria; iconoRedSocial()/iconoContacto()
// devuelven el SVG ya cacheado (o un placeholder neutro mientras
// carga). Cuando terminan de llegar, se dispara el evento
// "qr-iconos-listos" en window para que la vista que ya se renderizó
// pueda volver a pintarse con el ícono real.
// ------------------------------------------------------------
const SIMPLE_ICONS_SLUG = {
  instagram: 'instagram', facebook: 'facebook', linkedin: 'linkedin',
  x: 'x', tiktok: 'tiktok', whatsapp: 'whatsapp',
};
const LUCIDE_SLUG = {
  telefono: 'phone', email: 'mail', direccion: 'map-pin',
  horario: 'clock', web: 'globe',
};

const _iconosCache = {}; // key -> SVG string ya lista para usar
const _ICONO_PLACEHOLDER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6" opacity="0.4"/></svg>';

async function cargarIconoRemoto(cacheKey, url, { modo }) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let svg = await res.text();
    // Simple Icons no trae currentColor: se inyecta para que el ícono
    // responda al color del círculo donde se dibuja (igual que Lucide,
    // que ya viene con stroke="currentColor" por defecto).
    if (modo === 'fill') {
      svg = svg.replace('<svg', '<svg fill="currentColor" width="20" height="20"');
    } else {
      svg = svg.replace('<svg', '<svg width="20" height="20"');
    }
    _iconosCache[cacheKey] = svg;
  } catch (err) {
    console.warn(`No se pudo cargar el ícono "${cacheKey}" desde la librería pública:`, err);
  }
}

async function precargarTodosLosIconos() {
  const tareas = [];
  for (const [key, slug] of Object.entries(SIMPLE_ICONS_SLUG)) {
    tareas.push(cargarIconoRemoto(`redes:${key}`, `https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/${slug}.svg`, { modo: 'fill' }));
  }
  for (const [key, slug] of Object.entries(LUCIDE_SLUG)) {
    tareas.push(cargarIconoRemoto(`contacto:${key}`, `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${slug}.svg`, { modo: 'stroke' }));
  }
  await Promise.allSettled(tareas);
  window.dispatchEvent(new CustomEvent('qr-iconos-listos'));
}
precargarTodosLosIconos();

/** Devuelve el SVG inline (ya cacheado) del logo de la red social, o un placeholder mientras carga */
export function iconoRedSocial(key) {
  // "web" (Sitio web) no es una marca: usa el ícono genérico de globo (Lucide)
  if (key === 'web') return _iconosCache['contacto:web'] || _ICONO_PLACEHOLDER;
  return _iconosCache[`redes:${key}`] || _ICONO_PLACEHOLDER;
}

/** Devuelve el SVG inline (ya cacheado) del ítem de contacto (teléfono, email, etc.) */
export function iconoContacto(key) {
  if (key === 'whatsapp') return _iconosCache['redes:whatsapp'] || _ICONO_PLACEHOLDER; // logo de marca (Simple Icons)
  return _iconosCache[`contacto:${key}`] || _iconosCache['contacto:web'] || _ICONO_PLACEHOLDER;
}

// ------------------------------------------------------------
// Carga dinámica de Google Fonts (sección "Diseño" > Fuentes)
// ------------------------------------------------------------
const _fuentesCargadas = new Set(['Poppins', 'Inter']); // ya vienen en el @import estático de styles.css

/**
 * Inyecta el <link> de Google Fonts para la familia indicada si aún
 * no se ha cargado en esta página. Solo se permiten familias de la
 * lista blanca (CONFIG.FUENTES_DISPONIBLES) para evitar construir
 * URLs con datos arbitrarios del usuario.
 */
export function cargarGoogleFont(familia) {
  if (!familia || _fuentesCargadas.has(familia)) return;
  _fuentesCargadas.add(familia);
  const param = encodeURIComponent(familia).replace(/%20/g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${param}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/** Aclara un color mezclándolo con blanco (factor 0 a 1, más alto = más claro). Para fondos pastel derivados del color elegido. */
export function mezclarConBlanco(hex, factor = 0.85) {
  if (!esHexValido(hex)) return '#EFEBFB';
  const limpio = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(limpio.substring(i, i + 2), 16));
  const mezclar = (c) => Math.round(c + (255 - c) * factor);
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return `#${toHex(mezclar(r))}${toHex(mezclar(g))}${toHex(mezclar(b))}`;
}
