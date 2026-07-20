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

-- ------------------------------------------------------------
-- RPC pública: horarios ya ocupados de un perfil en una fecha dada
-- Devuelve SOLO la hora (nunca nombre/email/descripción de quien
-- reservó), para que el calendario público pueda deshabilitar esos
-- bloques sin exponer datos personales de otros visitantes.
-- ------------------------------------------------------------
create or replace function public.obtener_horarios_ocupados(p_slug text, p_fecha date)
returns table(hora time)
language sql
security definer
set search_path = public
stable
as $$
  select c.hora
  from public.citas c
  join public.profiles p on p.id = c.profile_id
  where p.slug = lower(p_slug) and c.fecha = p_fecha;
$$;

grant execute on function public.obtener_horarios_ocupados(text, date) to anon, authenticated;

-- ------------------------------------------------------------
-- RPC pública: crear una cita validando en el servidor (nunca confiar
-- solo en el JS del cliente):
--   - el perfil existe, está activo y permite citas
--   - el día de la semana de p_fecha está en dias_atencion
--   - la fecha no es pasada
--   - la hora cae dentro de [hora_desde_atencion, hora_hasta_atencion)
--   - la hora coincide con un bloque válido según duracion_cita_min
--   - el bloque no está ya tomado (constraint citas_unicas como respaldo)
-- ------------------------------------------------------------
create or replace function public.crear_cita(
  p_slug text,
  p_nombre text,
  p_email text,
  p_descripcion text,
  p_fecha date,
  p_hora time
)
returns public.citas
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil public.profiles%rowtype;
  dia_semana text;
  dias_es text[] := array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  minutos_desde_inicio int;
  nueva public.citas%rowtype;
begin
  select * into perfil from public.profiles where slug = lower(p_slug);
  if perfil.id is null then
    raise exception 'Perfil no encontrado';
  end if;
  if not perfil.activo or not perfil.permitir_citas then
    raise exception 'Este perfil no acepta citas en este momento';
  end if;
  if trim(coalesce(p_nombre, '')) = '' or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Nombre o correo inválido';
  end if;
  if p_fecha < current_date then
    raise exception 'La fecha ya pasó';
  end if;

  dia_semana := dias_es[extract(dow from p_fecha)::int + 1];
  if not (dia_semana = any(perfil.dias_atencion)) then
    raise exception 'Ese día no está disponible';
  end if;

  if perfil.hora_desde_atencion is null or perfil.hora_hasta_atencion is null
     or p_hora < perfil.hora_desde_atencion or p_hora >= perfil.hora_hasta_atencion then
    raise exception 'Ese horario está fuera del rango de atención';
  end if;

  minutos_desde_inicio := extract(epoch from (p_hora - perfil.hora_desde_atencion)) / 60;
  if minutos_desde_inicio % greatest(perfil.duracion_cita_min, 1) <> 0 then
    raise exception 'Horario inválido';
  end if;

  insert into public.citas (profile_id, nombre_solicitante, email_solicitante, descripcion, fecha, hora)
  values (perfil.id, trim(p_nombre), lower(trim(p_email)), coalesce(p_descripcion, ''), p_fecha, p_hora)
  returning * into nueva;

  return nueva;
exception
  when unique_violation then
    raise exception 'Ese horario ya fue reservado por alguien más, elige otro';
end;
$$;

grant execute on function public.crear_cita(text, text, text, text, date, time) to anon, authenticated;
