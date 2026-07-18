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
// Iconos de redes sociales (SVG inline, monocromo vía currentColor)
// Se usan en los chips de "tarjeta-preview__redes" (wizard, dashboard
// y perfil público) en vez de las iniciales de texto.
// ------------------------------------------------------------
const ICONOS_REDES = {
  instagram: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.8"/><circle cx="7.7" cy="8.2" r="1.3" fill="currentColor"/><rect x="6.5" y="10.7" width="2.4" height="6.8" fill="currentColor"/><path d="M11.2 10.7h2.3v1.2c.6-.9 1.6-1.5 2.8-1.5 2.2 0 3.2 1.5 3.2 3.9v4.5h-2.4v-4c0-1.1-.4-1.8-1.4-1.8-1 0-1.6.7-1.8 1.3-.1.2-.1.5-.1.8v3.7h-2.6z" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M4.5 4.5l15 15M19.5 4.5l-15 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M14 21v-7.5h2.5l.4-3H14V8.4c0-.9.2-1.5 1.5-1.5H17V4.2C16.7 4.2 15.7 4 14.6 4 12.3 4 10.7 5.4 10.7 8.1v2.4H8.2v3h2.5V21z" fill="currentColor"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M13.5 3h2.2c.2 1.7 1.3 3.1 3 3.5v2.3c-1.1-.1-2.1-.5-3-1.1v5.9a4.3 4.3 0 1 1-4.3-4.3c.2 0 .4 0 .6.1v2.3a2 2 0 1 0 1.9 2V3z" fill="currentColor"/></svg>',
  web: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" stroke="currentColor" stroke-width="1.8"/></svg>',
};

/** Devuelve el SVG inline de la red social (o un globo genérico si no se reconoce la clave) */
export function iconoRedSocial(key) {
  return ICONOS_REDES[key] || ICONOS_REDES.web;
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
