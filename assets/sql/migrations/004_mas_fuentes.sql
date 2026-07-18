-- ============================================================
-- MIGRACIÓN 004 — amplía la lista blanca de fuentes disponibles
-- en la sección "Diseño" (10 nuevas, 20 en total). Ejecutar en
-- proyectos que ya tenían la migración 003 aplicada.
-- ============================================================

alter table public.profiles
  drop constraint if exists tema_fuente_titulo_valida;
alter table public.profiles
  add constraint tema_fuente_titulo_valida check (tema_fuente_titulo in
    ('Poppins','Inter','Montserrat','Playfair Display','Roboto','Lora','Nunito','Space Grotesk','Merriweather','Work Sans',
     'Raleway','Oswald','Quicksand','DM Sans','Bebas Neue','Josefin Sans','Caveat','Abril Fatface','Fira Sans','Ubuntu'));

alter table public.profiles
  drop constraint if exists tema_fuente_texto_valida;
alter table public.profiles
  add constraint tema_fuente_texto_valida check (tema_fuente_texto in
    ('Poppins','Inter','Montserrat','Playfair Display','Roboto','Lora','Nunito','Space Grotesk','Merriweather','Work Sans',
     'Raleway','Oswald','Quicksand','DM Sans','Bebas Neue','Josefin Sans','Caveat','Abril Fatface','Fira Sans','Ubuntu'));
