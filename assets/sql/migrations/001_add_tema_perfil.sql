-- ============================================================
-- MIGRACIÓN 001 — agrega selección de tema de color al perfil (SUPERADA)
-- ⚠️ Esta migración quedó reemplazada por 002_tema_colores_libres.sql,
-- que cambia el tema de un preset fijo (enum) a colores libres
-- (primario + secundario en hex). Si tu proyecto es nuevo, ignora
-- 001 y 002: schema.sql ya incluye las columnas finales.
-- Si ya corriste esta 001, corre 002 después para completar la migración.
-- ============================================================

alter table public.profiles
  add column if not exists tema text not null default 'lavanda';

alter table public.profiles
  drop constraint if exists tema_valido;

alter table public.profiles
  add constraint tema_valido check (tema in ('lavanda', 'menta', 'cielo', 'durazno', 'rosa'));
