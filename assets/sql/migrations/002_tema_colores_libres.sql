-- ============================================================
-- MIGRACIÓN 002 — reemplaza el tema de color por preset (enum)
-- por colores libres elegidos por el usuario (hex primario +
-- secundario), con editor de paleta en el wizard/dashboard.
-- Ver ADR-006 (actualizado) en docs/ARQUITECTURA-VCARD.md.
--
-- Ejecutar SOLO si tu proyecto ya tenía la columna `tema` (enum)
-- de la migración 001. Si es un proyecto nuevo, no hace falta:
-- schema.sql ya incluye tema_color_primario/tema_color_secundario.
-- ============================================================

alter table public.profiles
  add column if not exists tema_color_primario text not null default '#C9B8F5';

alter table public.profiles
  add column if not exists tema_color_secundario text not null default '#232421';

-- Migrar los perfiles que ya tenían un tema por nombre a su
-- equivalente en hex (mismos pares usados como presets nuevos).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='tema') then
    update public.profiles set tema_color_primario = case tema
      when 'lavanda' then '#C9B8F5'
      when 'menta'   then '#8FD9B0'
      when 'cielo'   then '#CFE4FB'
      when 'durazno' then '#EDC472'
      when 'rosa'    then '#F5B8DA'
      else '#C9B8F5'
    end,
    tema_color_secundario = case tema
      when 'cielo' then '#4C6FCF'
      else '#232421'
    end
    where tema is not null;

    alter table public.profiles drop constraint if exists tema_valido;
    alter table public.profiles drop column if exists tema;
  end if;
end $$;

alter table public.profiles
  drop constraint if exists tema_color_primario_formato;
alter table public.profiles
  add constraint tema_color_primario_formato check (tema_color_primario ~ '^#[0-9a-fA-F]{6}$');

alter table public.profiles
  drop constraint if exists tema_color_secundario_formato;
alter table public.profiles
  add constraint tema_color_secundario_formato check (tema_color_secundario ~ '^#[0-9a-fA-F]{6}$');
