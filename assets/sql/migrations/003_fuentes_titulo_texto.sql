-- ============================================================
-- MIGRACIÓN 003 — agrega selección de fuentes (título/texto)
-- Ejecutar solo si tu proyecto ya tenía la tabla profiles creada
-- ANTES de que schema.sql incluyera tema_fuente_titulo/tema_fuente_texto.
-- Si es un proyecto nuevo, no hace falta: schema.sql ya las incluye.
-- ============================================================

alter table public.profiles
  add column if not exists tema_fuente_titulo text not null default 'Poppins';

alter table public.profiles
  add column if not exists tema_fuente_texto text not null default 'Inter';

alter table public.profiles
  drop constraint if exists tema_fuente_titulo_valida;
alter table public.profiles
  add constraint tema_fuente_titulo_valida check (tema_fuente_titulo in
    ('Poppins','Inter','Montserrat','Playfair Display','Roboto','Lora','Nunito','Space Grotesk','Merriweather','Work Sans'));

alter table public.profiles
  drop constraint if exists tema_fuente_texto_valida;
alter table public.profiles
  add constraint tema_fuente_texto_valida check (tema_fuente_texto in
    ('Poppins','Inter','Montserrat','Playfair Display','Roboto','Lora','Nunito','Space Grotesk','Merriweather','Work Sans'));
