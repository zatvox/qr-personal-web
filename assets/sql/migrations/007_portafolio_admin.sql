-- ============================================================
-- MIGRACIÓN 007 — Portafolio (ítems con varias fotos) + planes + panel admin
--
-- Es IDEMPOTENTE: se puede correr varias veces sin romper nada.
-- Se ejecuta COMPLETA en el SQL Editor de Supabase (corre como
-- "postgres", por eso auth.uid() es NULL y los topes de plan no
-- frenan la migración de datos de la galería antigua).
--
-- Instalaciones nuevas: correr schema.sql → functions.sql →
-- rls-policies.sql → migraciones 001…006 → ESTA (007).
--
-- Qué hace:
--   1) profiles: 4 campos de portafolio + plan / plan_vence_en
--      (las columnas de plan quedan BLINDADAS: solo el admin las cambia)
--   2) admins + es_admin() + plan_efectivo()
--   3) portfolio_items y portfolio_images
--   4) Topes por plan forzados EN LA BASE (no solo en el JS)
--   5) RLS (los ítems 'privado' NUNCA llegan al visitante)
--   6) pagos + RPCs del panel admin
--   7) Migra gallery_images → portfolio_items (1 a 1, sin perder nada)
--
-- DESPUÉS de correrlo, ejecutar a mano (una vez) con TU correo:
--   insert into public.admins (user_id)
--     select id from auth.users where email = 'TU_CORREO' on conflict do nothing;
--   update public.profiles set plan = 'pro', plan_vence_en = null
--     where user_id in (select user_id from public.admins);
-- (no va en este archivo para no dejar tu correo en un repo público)
-- ============================================================


-- ------------------------------------------------------------
-- 1) profiles: campos de portafolio y de plan
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists portafolio_titulo  text    not null default 'Portafolio',
  add column if not exists portafolio_label_a text    not null default '',
  add column if not exists portafolio_label_b text    not null default '',
  add column if not exists mostrar_portafolio boolean not null default true,
  add column if not exists plan               text    not null default 'gratis',
  add column if not exists plan_vence_en      date;

alter table public.profiles drop constraint if exists plan_valido;
alter table public.profiles
  add constraint plan_valido check (plan in ('gratis', 'pro'));


-- ------------------------------------------------------------
-- 2) Admin y plan efectivo
-- ------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Sin policies a propósito: nadie la lee ni escribe desde el cliente.
-- Solo se llena desde el SQL Editor.

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- Plan que de verdad aplica hoy: 'pro' solo si no venció.
-- (plan_vence_en NULL = Pro sin vencimiento)
create or replace function public.plan_efectivo(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when p.plan = 'pro'
            and (p.plan_vence_en is null
                 or p.plan_vence_en >= (now() at time zone 'America/Lima')::date)
           then 'pro' else 'gratis'
         end
  from public.profiles p
  where p.id = p_profile_id;
$$;
revoke all on function public.plan_efectivo(uuid) from public, anon;
grant execute on function public.plan_efectivo(uuid) to authenticated;

-- Blindaje: un usuario normal NO puede cambiarse el plan desde la
-- consola del navegador (la policy de update de profiles le deja
-- editar toda su fila). Si lo intenta, el valor se ignora en silencio.
-- Pasan: el SQL Editor / service role (auth.uid() NULL) y el admin.
create or replace function public.proteger_columnas_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'gratis';
    new.plan_vence_en := null;
  else
    new.plan := old.plan;
    new.plan_vence_en := old.plan_vence_en;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_plan on public.profiles;
create trigger trg_proteger_plan
  before insert or update on public.profiles
  for each row execute function public.proteger_columnas_plan();


-- ------------------------------------------------------------
-- 3) Tablas del portafolio
-- ------------------------------------------------------------
create table if not exists public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  titulo      text not null check (char_length(btrim(titulo)) between 1 and 80),
  subtitulo   text not null default '' check (char_length(subtitulo) <= 120),
  descripcion text not null default '' check (char_length(descripcion) <= 600),
  url_link    text not null default '' check (url_link = '' or url_link ~* '^https?://'),
  cta_texto   text not null default 'Ver más' check (char_length(cta_texto) <= 30),
  estado      text not null default 'funcional' check (estado in ('funcional', 'desarrollo', 'privado')),
  orden       int  not null default 0,
  legacy_gallery_id uuid unique,          -- trazabilidad de la migración desde gallery_images
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_pitems_profile_orden on public.portfolio_items (profile_id, orden);

create table if not exists public.portfolio_images (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.portfolio_items(id) on delete cascade,
  storage_path text not null,
  caption      text not null default '' check (char_length(caption) <= 200),
  orden        int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_pimages_item_orden on public.portfolio_images (item_id, orden);

create or replace function public.portafolio_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pitems_updated_at on public.portfolio_items;
create trigger trg_pitems_updated_at
  before update on public.portfolio_items
  for each row execute function public.portafolio_touch_updated_at();


-- ------------------------------------------------------------
-- 4) Topes por plan (forzados en la BD)
--    Gratis: 3 ítems × 2 fotos · Pro: 30 ítems × 8 fotos · privados solo Pro
--    Los topes solo frenan ALTAS nuevas (quien ya tenía más por la
--    migración conserva lo suyo). Con auth.uid() NULL (SQL Editor)
--    no se aplican, así la migración de datos no se bloquea.
-- ------------------------------------------------------------
create or replace function public.limitar_portafolio_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_total int;
  v_max   int;
begin
  if auth.uid() is null then
    return new;
  end if;

  v_plan := public.plan_efectivo(new.profile_id);

  if tg_op = 'INSERT' then
    select count(*) into v_total from public.portfolio_items where profile_id = new.profile_id;
    v_max := case when v_plan = 'pro' then 30 else 3 end;
    if v_total >= v_max then
      raise exception 'Tu plan permite hasta % trabajo(s) en el portafolio.', v_max;
    end if;
  end if;

  if new.estado = 'privado' and v_plan <> 'pro'
     and (tg_op = 'INSERT' or old.estado is distinct from 'privado') then
    raise exception 'Los trabajos privados son una función del plan Pro.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limitar_items on public.portfolio_items;
create trigger trg_limitar_items
  before insert or update on public.portfolio_items
  for each row execute function public.limitar_portafolio_items();

create or replace function public.limitar_portafolio_fotos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
  v_plan    text;
  v_total   int;
  v_max     int;
begin
  if auth.uid() is null then
    return new;
  end if;

  select profile_id into v_profile from public.portfolio_items where id = new.item_id;
  v_plan := public.plan_efectivo(v_profile);
  select count(*) into v_total from public.portfolio_images where item_id = new.item_id;
  v_max := case when v_plan = 'pro' then 8 else 2 end;

  if v_total >= v_max then
    raise exception 'Tu plan permite hasta % foto(s) por trabajo.', v_max;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_fotos on public.portfolio_images;
create trigger trg_limitar_fotos
  before insert on public.portfolio_images
  for each row execute function public.limitar_portafolio_fotos();


-- ------------------------------------------------------------
-- 5) RLS
--    Visible al público solo si: perfil activo + portafolio visible
--    + el ítem NO es privado. El dueño siempre ve lo suyo.
-- ------------------------------------------------------------
alter table public.portfolio_items  enable row level security;
alter table public.portfolio_images enable row level security;

drop policy if exists "pitems_select" on public.portfolio_items;
create policy "pitems_select" on public.portfolio_items
  for select
  using (
    exists (select 1 from public.profiles p
            where p.id = portfolio_items.profile_id and p.user_id = auth.uid())
    or (
      portfolio_items.estado <> 'privado'
      and exists (select 1 from public.profiles p
                  where p.id = portfolio_items.profile_id
                    and p.activo = true and p.mostrar_portafolio = true)
    )
  );

drop policy if exists "pitems_insert" on public.portfolio_items;
create policy "pitems_insert" on public.portfolio_items
  for insert
  with check (
    exists (select 1 from public.profiles p
            where p.id = portfolio_items.profile_id and p.user_id = auth.uid())
  );

drop policy if exists "pitems_update" on public.portfolio_items;
create policy "pitems_update" on public.portfolio_items
  for update
  using (
    exists (select 1 from public.profiles p
            where p.id = portfolio_items.profile_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p
            where p.id = portfolio_items.profile_id and p.user_id = auth.uid())
  );

drop policy if exists "pitems_delete" on public.portfolio_items;
create policy "pitems_delete" on public.portfolio_items
  for delete
  using (
    exists (select 1 from public.profiles p
            where p.id = portfolio_items.profile_id and p.user_id = auth.uid())
  );

drop policy if exists "pimages_select" on public.portfolio_images;
create policy "pimages_select" on public.portfolio_images
  for select
  using (
    exists (
      select 1
      from public.portfolio_items i
      join public.profiles p on p.id = i.profile_id
      where i.id = portfolio_images.item_id
        and (
          p.user_id = auth.uid()
          or (i.estado <> 'privado' and p.activo = true and p.mostrar_portafolio = true)
        )
    )
  );

drop policy if exists "pimages_insert" on public.portfolio_images;
create policy "pimages_insert" on public.portfolio_images
  for insert
  with check (
    exists (
      select 1 from public.portfolio_items i
      join public.profiles p on p.id = i.profile_id
      where i.id = portfolio_images.item_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "pimages_update" on public.portfolio_images;
create policy "pimages_update" on public.portfolio_images
  for update
  using (
    exists (
      select 1 from public.portfolio_items i
      join public.profiles p on p.id = i.profile_id
      where i.id = portfolio_images.item_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolio_items i
      join public.profiles p on p.id = i.profile_id
      where i.id = portfolio_images.item_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "pimages_delete" on public.portfolio_images;
create policy "pimages_delete" on public.portfolio_images
  for delete
  using (
    exists (
      select 1 from public.portfolio_items i
      join public.profiles p on p.id = i.profile_id
      where i.id = portfolio_images.item_id and p.user_id = auth.uid()
    )
  );

-- Reordenar en una sola llamada (security invoker: la RLS de arriba
-- sigue mandando, solo se mueven filas propias).
create or replace function public.reordenar_portafolio(p_ids uuid[])
returns void
language sql
as $$
  update public.portfolio_items i
     set orden = t.ord::int - 1
    from unnest(p_ids) with ordinality as t(id, ord)
   where i.id = t.id;
$$;
revoke all on function public.reordenar_portafolio(uuid[]) from public, anon;
grant execute on function public.reordenar_portafolio(uuid[]) to authenticated;

create or replace function public.reordenar_portafolio_fotos(p_ids uuid[])
returns void
language sql
as $$
  update public.portfolio_images im
     set orden = t.ord::int - 1
    from unnest(p_ids) with ordinality as t(id, ord)
   where im.id = t.id;
$$;
revoke all on function public.reordenar_portafolio_fotos(uuid[]) from public, anon;
grant execute on function public.reordenar_portafolio_fotos(uuid[]) to authenticated;


-- ------------------------------------------------------------
-- 6) Pagos y RPCs del panel admin
-- ------------------------------------------------------------
create table if not exists public.pagos (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  monto       numeric(10,2) not null check (monto >= 0),
  moneda      text not null default 'PEN',
  metodo      text not null default 'yape'
              check (metodo in ('yape', 'plin', 'transferencia', 'efectivo', 'otro')),
  periodo     text not null default 'mensual'
              check (periodo in ('mensual', 'anual', 'otro')),
  fecha_pago  date not null default ((now() at time zone 'America/Lima')::date),
  vence_en    date,                       -- vencimiento del plan que dejó este pago
  referencia  text not null default '',   -- Nº de operación, etc.
  notas       text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists idx_pagos_profile_fecha on public.pagos (profile_id, fecha_pago desc);

alter table public.pagos enable row level security;

drop policy if exists "pagos_select" on public.pagos;
create policy "pagos_select" on public.pagos
  for select
  using (
    public.es_admin()
    or exists (select 1 from public.profiles p
               where p.id = pagos.profile_id and p.user_id = auth.uid())
  );

drop policy if exists "pagos_insert_admin" on public.pagos;
create policy "pagos_insert_admin" on public.pagos
  for insert with check (public.es_admin());

drop policy if exists "pagos_update_admin" on public.pagos;
create policy "pagos_update_admin" on public.pagos
  for update using (public.es_admin()) with check (public.es_admin());

drop policy if exists "pagos_delete_admin" on public.pagos;
create policy "pagos_delete_admin" on public.pagos
  for delete using (public.es_admin());

-- Lista de usuarios para el panel (incluye email, que vive en auth.users)
create or replace function public.admin_listar_usuarios()
returns table (
  profile_id      uuid,
  user_id         uuid,
  email           text,
  slug            text,
  nombre_completo text,
  activo          boolean,
  plan            text,
  plan_vence_en   date,
  plan_efectivo   text,
  items           bigint,
  fotos           bigint,
  ultimo_pago     date,
  total_pagado    numeric,
  creado          timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
#variable_conflict use_column
begin
  if not public.es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.user_id,
    u.email::text,
    p.slug::text,
    p.nombre_completo::text,
    p.activo,
    p.plan::text,
    p.plan_vence_en,
    (case when p.plan = 'pro'
           and (p.plan_vence_en is null
                or p.plan_vence_en >= (now() at time zone 'America/Lima')::date)
          then 'pro' else 'gratis' end)::text,
    (select count(*) from public.portfolio_items i where i.profile_id = p.id),
    (select count(*) from public.portfolio_images im
       join public.portfolio_items i2 on i2.id = im.item_id
      where i2.profile_id = p.id),
    (select max(pg.fecha_pago) from public.pagos pg where pg.profile_id = p.id),
    (select coalesce(sum(pg2.monto), 0) from public.pagos pg2 where pg2.profile_id = p.id),
    u.created_at
  from public.profiles p
  left join auth.users u on u.id = p.user_id
  order by u.created_at desc nulls last;
end;
$$;
revoke all on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;

-- Cambiar plan a mano (activar, extender, bajar a gratis)
create or replace function public.admin_cambiar_plan(
  p_profile_id uuid,
  p_plan       text,
  p_vence_en   date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_plan not in ('gratis', 'pro') then
    raise exception 'Plan inválido';
  end if;

  update public.profiles
     set plan = p_plan,
         plan_vence_en = case when p_plan = 'pro' then p_vence_en else null end
   where id = p_profile_id;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;
end;
$$;
revoke all on function public.admin_cambiar_plan(uuid, text, date) from public, anon;
grant execute on function public.admin_cambiar_plan(uuid, text, date) to authenticated;

-- Suspender / reactivar un perfil (activo = visible al público)
create or replace function public.admin_activar_perfil(p_profile_id uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.profiles set activo = p_activo where id = p_profile_id;
  if not found then
    raise exception 'Perfil no encontrado';
  end if;
end;
$$;
revoke all on function public.admin_activar_perfil(uuid, boolean) from public, anon;
grant execute on function public.admin_activar_perfil(uuid, boolean) to authenticated;

-- Registrar un pago Y activar/extender Pro en una sola operación atómica.
-- Si el usuario ya es Pro vigente, el nuevo periodo se suma al vencimiento
-- actual (no pierde días). Devuelve la nueva fecha de vencimiento.
create or replace function public.admin_registrar_pago(
  p_profile_id uuid,
  p_monto      numeric,
  p_metodo     text default 'yape',
  p_periodo    text default 'mensual',
  p_fecha_pago date default null,
  p_vence_en   date default null,   -- opcional: forzar el vencimiento (obligatorio si periodo = 'otro')
  p_referencia text default '',
  p_notas      text default ''
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_fecha  date;
  v_base   date;
  v_nuevo  date;
  v_plan   text;
  v_actual date;
begin
  if not public.es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select plan, plan_vence_en into v_plan, v_actual
    from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  v_fecha := coalesce(p_fecha_pago, v_hoy);

  if p_vence_en is not null then
    v_nuevo := p_vence_en;
  elsif p_periodo = 'otro' then
    raise exception 'Con periodo "otro" debes indicar la fecha de vencimiento';
  else
    v_base := case
                when v_plan = 'pro' and v_actual is not null and v_actual >= v_fecha then v_actual
                else v_fecha
              end;
    v_nuevo := case p_periodo
                 when 'anual' then (v_base + interval '1 year')::date
                 else (v_base + interval '1 month')::date
               end;
  end if;

  insert into public.pagos (profile_id, monto, metodo, periodo, fecha_pago, vence_en, referencia, notas)
  values (p_profile_id, p_monto, p_metodo, p_periodo, v_fecha, v_nuevo, coalesce(p_referencia, ''), coalesce(p_notas, ''));

  update public.profiles
     set plan = 'pro', plan_vence_en = v_nuevo
   where id = p_profile_id;

  return v_nuevo;
end;
$$;
revoke all on function public.admin_registrar_pago(uuid, numeric, text, text, date, date, text, text) from public, anon;
grant execute on function public.admin_registrar_pago(uuid, numeric, text, text, date, date, text, text) to authenticated;


-- ------------------------------------------------------------
-- 7) Migración de datos: gallery_images → portfolio_items (1 a 1)
--    Idempotente (legacy_gallery_id evita duplicar). La tabla
--    gallery_images NO se toca ni se borra.
-- ------------------------------------------------------------
insert into public.portfolio_items
  (profile_id, titulo, descripcion, url_link, orden, estado, legacy_gallery_id)
select
  g.profile_id,
  left(coalesce(nullif(btrim(g.titulo), ''), 'Trabajo ' || (g.orden + 1)), 80),
  left(coalesce(g.descripcion, ''), 600),
  case when coalesce(g.url_link, '') ~* '^https?://' then g.url_link else '' end,
  g.orden,
  'funcional',
  g.id
from public.gallery_images g
where not exists (
  select 1 from public.portfolio_items i where i.legacy_gallery_id = g.id
);

insert into public.portfolio_images (item_id, storage_path, caption, orden)
select i.id, g.storage_path, '', 0
from public.portfolio_items i
join public.gallery_images g on g.id = i.legacy_gallery_id
where not exists (
  select 1 from public.portfolio_images im where im.item_id = i.id
);

-- ============================================================
-- Verificación rápida (opcional, correr aparte):
--   select (select count(*) from gallery_images)   as galeria_vieja,
--          (select count(*) from portfolio_items)  as items_nuevos,
--          (select count(*) from portfolio_images) as fotos_nuevas;
-- ============================================================
