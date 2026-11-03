// ============================================================
// PLANES — lógica de plan efectiva en el navegador
// (espejo de public.plan_efectivo() en la BD; la BD manda).
// ============================================================
import { CONFIG } from './config.js';

/** Fecha de hoy en Lima como 'YYYY-MM-DD' (para comparar con plan_vence_en) */
export function hoyLima() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}

/** 'pro' solo si el plan es pro y no venció; si no, 'gratis' */
export function planEfectivoDe(perfil) {
  if (perfil?.plan === 'pro' && (!perfil.plan_vence_en || perfil.plan_vence_en >= hoyLima())) return 'pro';
  return 'gratis';
}

/** Topes del plan efectivo del perfil: { etiqueta, maxItems, maxFotosPorItem, privados } */
export function limitesDe(perfil) {
  return CONFIG.PLANES[planEfectivoDe(perfil)];
}

/** Texto corto para mostrar: "Plan Pro · vence 12/12/2026" */
export function resumenPlan(perfil) {
  const efectivo = planEfectivoDe(perfil);
  if (efectivo === 'pro') {
    return perfil.plan_vence_en
      ? `Plan Pro · vence ${formatearFechaISO(perfil.plan_vence_en)}`
      : 'Plan Pro';
  }
  if (perfil?.plan === 'pro' && perfil.plan_vence_en) {
    return `Tu plan Pro venció el ${formatearFechaISO(perfil.plan_vence_en)} · ahora estás en Gratis`;
  }
  return 'Plan Gratis';
}

export function formatearFechaISO(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Link de WhatsApp para pedir Pro ('' si no hay número configurado) */
export function linkQuieroPro(perfil) {
  if (!CONFIG.WHATSAPP_VENTAS) return '';
  const msg = `Hola, quiero activar el plan Pro en mi tarjeta (${perfil?.slug || ''}).`;
  return `https://wa.me/${CONFIG.WHATSAPP_VENTAS}?text=${encodeURIComponent(msg)}`;
}
