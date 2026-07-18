-- ============================================================
-- MIGRACIÓN 005 — la galería funciona como mini-portafolio:
-- cada foto puede tener título, descripción y un enlace externo
-- opcional (ej. a un producto, proyecto o trabajo).
-- ============================================================

alter table public.gallery_images
  add column if not exists titulo text;

alter table public.gallery_images
  add column if not exists descripcion text;

alter table public.gallery_images
  add column if not exists url_link text;
