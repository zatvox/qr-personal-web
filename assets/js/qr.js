// ============================================================
// QR — generación 100% en cliente (sin API externa de pago)
// Usa la librería qrcodejs vía CDN. Ver ADR-002.
// ============================================================

let _libCargada = false;

async function asegurarLibreria() {
  if (_libCargada || window.QRCode) { _libCargada = true; return; }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se pudo cargar la librería de QR'));
    document.head.appendChild(script);
  });
  _libCargada = true;
}

/**
 * Renderiza un QR dentro del elemento contenedor (id o elemento).
 * Devuelve el elemento canvas/img generado para poder exportarlo.
 */
export async function renderizarQR(contenedor, texto, opciones = {}) {
  try {
    await asegurarLibreria();
    const el = typeof contenedor === 'string' ? document.getElementById(contenedor) : contenedor;
    el.innerHTML = '';
    // eslint-disable-next-line no-undef
    new QRCode(el, {
      text,
      width: opciones.width || 220,
      height: opciones.height || 220,
      colorDark: opciones.colorDark || '#111827',
      colorLight: opciones.colorLight || '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
    return true;
  } catch (err) {
    console.error('Error generando QR:', err);
    const el = typeof contenedor === 'string' ? document.getElementById(contenedor) : contenedor;
    el.innerHTML = `<p class="qr-fallback">No se pudo generar el QR. Comparte este link:<br><a href="${texto}">${texto}</a></p>`;
    return false;
  }
}

/** Descarga la imagen del QR ya renderizado dentro del contenedor */
export function descargarQR(contenedorId, nombreArchivo = 'mi-qr.png') {
  const el = document.getElementById(contenedorId);
  const img = el?.querySelector('img');
  const canvas = el?.querySelector('canvas');
  const src = img?.src || canvas?.toDataURL('image/png');
  if (!src) return false;

  const a = document.createElement('a');
  a.href = src;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
