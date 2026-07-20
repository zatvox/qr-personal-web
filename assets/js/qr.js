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
      text: texto,
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

/**
 * Descarga la imagen del QR ya renderizado dentro del contenedor.
 * Se redibuja sobre un canvas nuevo con fondo blanco sólido (+ un
 * margen de "zona tranquila") en vez de usar directamente el
 * canvas/img de la librería: así el PNG exportado nunca queda con
 * fondo transparente, que en muchas apps de galería/impresión se ve
 * negro o gris y hace que el QR no se pueda escanear.
 */
export function descargarQR(contenedorId, nombreArchivo = 'mi-qr.png') {
  const el = document.getElementById(contenedorId);
  const img = el?.querySelector('img');
  const canvasOriginal = el?.querySelector('canvas');
  const fuente = img || canvasOriginal;
  if (!fuente) return false;

  const ladoQR = fuente.naturalWidth || fuente.width || 220;
  const margen = Math.round(ladoQR * 0.12); // zona tranquila blanca alrededor del QR
  const ladoFinal = ladoQR + margen * 2;

  const canvasFinal = document.createElement('canvas');
  canvasFinal.width = ladoFinal;
  canvasFinal.height = ladoFinal;
  const ctx = canvasFinal.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ladoFinal, ladoFinal);
  ctx.drawImage(fuente, margen, margen, ladoQR, ladoQR);

  const a = document.createElement('a');
  a.href = canvasFinal.toDataURL('image/png');
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
