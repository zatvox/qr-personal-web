// ============================================================
// VCARD — genera archivo .vcf descargable ("Guardar contacto")
// ============================================================

/**
 * Construye el contenido de un archivo vCard 3.0 a partir del perfil.
 */
export function construirVcf(perfil) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  lines.push(`FN:${perfil.nombre_completo || ''}`);
  if (perfil.empresa) lines.push(`ORG:${perfil.empresa}`);
  if (perfil.cargo) lines.push(`TITLE:${perfil.cargo}`);
  if (perfil.telefono) lines.push(`TEL;TYPE=CELL:${perfil.telefono}`);
  if (perfil.whatsapp && perfil.whatsapp !== perfil.telefono) lines.push(`TEL;TYPE=WORK:${perfil.whatsapp}`);
  if (perfil.mostrar_email && perfil.email_contacto) lines.push(`EMAIL:${perfil.email_contacto}`);
  if (perfil.direccion) lines.push(`ADR;TYPE=WORK:;;${perfil.direccion};;;;`);
  if (perfil.bio) lines.push(`NOTE:${perfil.bio.replace(/\n/g, '\\n')}`);
  if (perfil.redes?.web) lines.push(`URL:${perfil.redes.web}`);

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/** Descarga el .vcf en el navegador */
export function descargarVcf(perfil) {
  const contenido = construirVcf(perfil);
  const blob = new Blob([contenido], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(perfil.slug || 'contacto')}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
