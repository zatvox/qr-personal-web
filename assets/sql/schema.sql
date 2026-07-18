-- ============================================================
-- SCHEMA: Sistema de Tarjeta Personal (vCard) + QR
-- Ejecutar en Supabase SQL Editor, en este orden:
-- 1) schema.sql  2) functions.sql  3) rls-policies.sql
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabla: profiles
-- Un perfil por usuario autenticado (1:1 con auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,

  slug            text not null unique,

  nombre_completo text not null default '',
  foto_url        text,
  cargo           text default '',
  empresa         text default '',
  bio             text default '',

  telefono        text default '',
  whatsapp        text default '',
  email_contacto  text default '',
  mostrar_email   boolean not null default false,
  direccion       text default '',

  redes           jsonb not null default '{}'::jsonb, -- {instagram, linkedin, x, facebook, tiktok, web}

  horario_atencion text default '',
  video_url        text default '',

  -- Tema de color libre del perfil público (sección "Diseño"):
  -- el usuario puede elegir un preset o escribir su propio hex.
  tema_color_primario   text not null default '#C9B8F5',
  tema_color_secundario text not null default '#232421',

  -- Fuentes (Google Fonts) para título y texto del perfil público
  tema_fuente_titulo text not null default 'Poppins',
  tema_fuente_texto  text not null default 'Inter',

  activo          boolean not null default true,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint slug_formato check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and char_length(slug) between 3 and 40),
  constraint tema_fuente_titulo_valida check (tema_fuente_titulo in ('Poppins','Inter','Montserrat','Playfair Display','Roboto','Lora','Nunito','Space Grotesk','Merriweather','Work Sans','Raleway','Oswald','Quicksand','DM Sans','Bebas Neue','Josefin Sans','Caveat','Abril Fatface','Fira Sans','Ubuntu')),
  constraint tema_fuente_texto_valida check (tema_fuente_texto in ('Poppins','Inter','Montserrat','Playfair Display','Roboto','Lora','Nunito','Space Grotesk','Merriweather','Work Sans','Raleway','Oswald','Quicksand','DM Sans','Bebas Neue','Josefin Sans','Caveat','Abril Fatface','Fira Sans','Ubuntu')),
  constraint tema_color_primario_formato check (tema_color_primario ~ '^#[0-9a-fA-F]{6}$'),
  constraint tema_color_secundario_formato check (tema_color_secundario ~ '^#[0-9a-fA-F]{6}$')
);

comment on table public.profiles is 'Tarjeta de presentación digital de cada usuario. Público si activo=true.';

create index if not exists idx_profiles_slug on public.profiles (slug);
create index if not exists idx_profiles_user_id on public.profiles (user_id);

-- ------------------------------------------------------------
-- Tabla: gallery_images
-- Galería opcional de fotos por perfil (P1)
-- ------------------------------------------------------------
create table if not exists public.gallery_images (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  orden       int not null default 0,
  -- Metadatos opcionales de portafolio: cada foto puede tener su
  -- propio título, descripción y enlace externo (ej. un trabajo,
  -- producto o proyecto), para que la galería funcione como un
  -- mini-portafolio y no solo una cuadrícula de imágenes sueltas.
  titulo      text,
  descripcion text,
  url_link    text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_gallery_profile_id on public.gallery_images (profile_id);

-- ------------------------------------------------------------
-- Slugs reservados (evita palabras de sistema/rutas propias)
-- ------------------------------------------------------------
create table if not exists public.slugs_reservados (
  slug text primary key
);

insert into public.slugs_reservados (slug) values
  ('admin'),('login'),('registro'),('dashboard'),('perfil'),
  ('api'),('assets'),('docs'),('u'),('www'),('soporte'),('help')
on conflict do nothing;

-- ------------------------------------------------------------
-- Enable RLS (políticas en rls-policies.sql)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.gallery_images enable row level security;
alter table public.slugs_reservados enable row level security;
