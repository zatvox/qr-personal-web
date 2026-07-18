-- ============================================================
-- FUNCIONES: triggers y RPCs
-- Ejecutar después de schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Crear/actualizar profile cuando el usuario confirma su email
-- Lee los datos del wizard guardados en raw_user_meta_data
-- (ver assets/js/auth.js -> signUp con options.data)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  base_slug text;
  final_slug text;
  suffix int := 0;
begin
  -- Solo actuar cuando el email queda confirmado (antes null, ahora con fecha)
  if new.email_confirmed_at is not null and (old is null or old.email_confirmed_at is null) then
    meta := new.raw_user_meta_data;
    base_slug := coalesce(nullif(regexp_replace(lower(meta->>'slug_sugerido'), '[^a-z0-9-]', '', 'g'), ''), 'usuario');
    final_slug := base_slug;

    -- Resolver colisión de slug agregando sufijo numérico
    while exists (select 1 from public.profiles where slug = final_slug)
       or exists (select 1 from public.slugs_reservados where slug = final_slug) loop
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix::text;
    end loop;

    insert into public.profiles (
      user_id, slug, nombre_completo, cargo, empresa, bio,
      telefono, whatsapp, email_contacto, direccion, redes,
      tema_color_primario, tema_color_secundario,
      tema_fuente_titulo, tema_fuente_texto
    ) values (
      new.id,
      final_slug,
      coalesce(meta->>'nombre_completo', ''),
      coalesce(meta->>'cargo', ''),
      coalesce(meta->>'empresa', ''),
      coalesce(meta->>'bio', ''),
      coalesce(meta->>'telefono', ''),
      coalesce(meta->>'whatsapp', ''),
      coalesce(new.email, ''),
      coalesce(meta->>'direccion', ''),
      coalesce(meta->'redes', '{}'::jsonb),
      case when meta->>'tema_color_primario' ~ '^#[0-9a-fA-F]{6}$'
           then meta->>'tema_color_primario' else '#C9B8F5' end,
      case when meta->>'tema_color_secundario' ~ '^#[0-9a-fA-F]{6}$'
           then meta->>'tema_color_secundario' else '#232421' end,
      case when meta->>'tema_fuente_titulo' in ('Poppins','Inter','Montserrat','Playfair Display','Roboto','Lora','Nunito','Space Grotesk','Merriweather','Work Sans')
           then meta->>'tema_fuente_titulo' else 'Poppins' end,
      case when meta->>'tema_fuente_texto' in ('Poppins','Inter','Montserrat','Playfair Display','Roboto','Lora','Nunito','Space Grotesk','Merriweather','Work Sans')
           then meta->>'tema_fuente_texto' else 'Inter' end
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RPC pública: verificar disponibilidad de slug sin exponer la tabla
-- ------------------------------------------------------------
create or replace function public.check_slug_available(p_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not (
    exists (select 1 from public.profiles where slug = lower(p_slug))
    or exists (select 1 from public.slugs_reservados where slug = lower(p_slug))
  )
  and p_slug ~ '^[a-z0-9](-?[a-z0-9])*$'
  and char_length(p_slug) between 3 and 40;
$$;

grant execute on function public.check_slug_available(text) to anon, authenticated;
