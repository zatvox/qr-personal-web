-- ============================================================
-- MIGRACIÓN 006 — horario estructurado (días + desde/hasta 24h) y
-- módulo de citas. Ejecutar en proyectos que ya existían.
--
-- Después de correr este archivo, vuelve a ejecutar COMPLETOS
-- (son idempotentes, no rompen nada si ya los corriste antes):
--   1) functions.sql   (agrega crear_cita / obtener_horarios_ocupados)
--   2) rls-policies.sql (agrega las políticas de la tabla citas)
-- ============================================================

alter table public.profiles
  add column if not exists dias_atencion       text[] not null default '{}',
  add column if not exists hora_desde_atencion  time,
  add column if not exists hora_hasta_atencion  time,
  add column if not exists duracion_cita_min    int not null default 30,
  add column if not exists permitir_citas       boolean not null default false;

alter table public.profiles
  drop constraint if exists dias_atencion_validos;
alter table public.profiles
  add constraint dias_atencion_validos check (dias_atencion <@ array['lunes','martes','miercoles','jueves','viernes','sabado','domingo']::text[]);

alter table public.profiles
  drop constraint if exists duracion_cita_rango;
alter table public.profiles
  add constraint duracion_cita_rango check (duracion_cita_min between 5 and 240);

-- El antiguo campo de texto libre queda reemplazado por los de arriba.
alter table public.profiles
  drop column if exists horario_atencion;

create table if not exists public.citas (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  nombre_solicitante text not null,
  email_solicitante  text not null,
  descripcion        text default '',
  fecha              date not null,
  hora               time not null,
  created_at         timestamptz not null default now(),

  constraint citas_unicas unique (profile_id, fecha, hora)
);

create index if not exists idx_citas_profile_fecha on public.citas (profile_id, fecha);

alter table public.citas enable row level security;
