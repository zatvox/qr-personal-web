-- ============================================================
-- 008 — Estadísticas de visitas/QR + diseño de la tarjeta imprimible
-- Idempotente: se puede correr más de una vez.
--
-- Qué hace:
--   1) profiles.tarjeta_config (jsonb): diseño elegido para el PDF
--      (layout, colores, fuentes, tamaños). Lo edita el dueño.
--   2) visitas_diarias: contador por perfil/día/origen ('qr' | 'link').
--      NO guarda IP ni datos personales: solo números.
--   3) visitas_detalle: filas por visita (dispositivo, idioma, referrer).
--      Solo se llena si CONFIG.ESTADISTICAS.guardarDetalle = true
--      (hoy 'false' = deshabilitado). Nunca guarda la IP.
--   4) RPC registrar_visita(slug, origen, detalle)  -> pública (anon)
--      RPC estadisticas_perfil(dias)                -> solo el dueño
-- ============================================================

-- 1) Diseño de tarjeta ----------------------------------------
alter table public.profiles
  add column if not exists tarjeta_config jsonb not null default '{}'::jsonb;

-- 2) Contador diario ------------------------------------------
create table if not exists public.visitas_diarias (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dia        date not null,
  origen     text not null check (origen in ('qr','link')),
  total      integer not null default 0,
  primary key (profile_id, dia, origen)
);

alter table public.visitas_diarias enable row level security;

drop policy if exists "visitas_diarias_select_dueno" on public.visitas_diarias;
create policy "visitas_diarias_select_dueno" on public.visitas_diarias
  for select
  using (exists (select 1 from public.profiles p
                 where p.id = visitas_diarias.profile_id and p.user_id = auth.uid()));
-- Sin policies de insert/update/delete: solo escribe la RPC (security definer).

-- 3) Detalle opcional (deshabilitado por defecto desde el front) --
create table if not exists public.visitas_detalle (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  origen      text not null check (origen in ('qr','link')),
  dispositivo text,
  idioma      text,
  referrer    text
);
create index if not exists visitas_detalle_profile_idx
  on public.visitas_detalle (profile_id, creado_en desc);

alter table public.visitas_detalle enable row level security;

drop policy if exists "visitas_detalle_select_dueno" on public.visitas_detalle;
create policy "visitas_detalle_select_dueno" on public.visitas_detalle
  for select
  using (exists (select 1 from public.profiles p
                 where p.id = visitas_detalle.profile_id and p.user_id = auth.uid()));

-- 4) Registrar visita (la llama el perfil público) --------------
create or replace function public.registrar_visita(
  p_slug    text,
  p_origen  text default 'link',
  p_detalle jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_user   uuid;
  v_origen text := case when p_origen = 'qr' then 'qr' else 'link' end;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
begin
  select id, user_id into v_id, v_user
  from public.profiles
  where slug = p_slug and activo = true;

  if v_id is null then return; end if;
  -- El dueño viendo su propia tarjeta no cuenta.
  if v_user is not null and v_user = auth.uid() then return; end if;

  insert into public.visitas_diarias (profile_id, dia, origen, total)
  values (v_id, v_hoy, v_origen, 1)
  on conflict (profile_id, dia, origen)
  do update set total = public.visitas_diarias.total + 1;

  if p_detalle is not null then
    insert into public.visitas_detalle (profile_id, origen, dispositivo, idioma, referrer)
    values (
      v_id, v_origen,
      left(coalesce(p_detalle->>'dispositivo', ''), 20),
      left(coalesce(p_detalle->>'idioma', ''), 12),
      left(coalesce(p_detalle->>'referrer', ''), 200)
    );
  end if;
end;
$$;
revoke all on function public.registrar_visita(text, text, jsonb) from public;
grant execute on function public.registrar_visita(text, text, jsonb) to anon, authenticated;

-- 5) Estadísticas del dueño -------------------------------------
-- Gratis: ve solo los totales. Pro: además la serie por día.
create or replace function public.estadisticas_perfil(p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_pro   boolean;
  v_desde date;
  v_total integer;
  v_qr    integer;
  v_serie jsonb := '[]'::jsonb;
begin
  select id into v_id from public.profiles where user_id = auth.uid();
  if v_id is null then
    return jsonb_build_object('pro', false, 'total', 0, 'qr', 0, 'link', 0, 'serie', '[]'::jsonb);
  end if;

  p_dias  := greatest(1, least(coalesce(p_dias, 30), 90));
  v_desde := (now() at time zone 'America/Lima')::date - (p_dias - 1);
  v_pro   := public.plan_efectivo(v_id) = 'pro';

  select coalesce(sum(total), 0),
         coalesce(sum(total) filter (where origen = 'qr'), 0)
    into v_total, v_qr
  from public.visitas_diarias
  where profile_id = v_id and dia >= v_desde;

  if v_pro then
    select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'qr', q, 'link', l) order by d), '[]'::jsonb)
      into v_serie
    from (
      select g::date as d,
             coalesce(sum(v.total) filter (where v.origen = 'qr'), 0)   as q,
             coalesce(sum(v.total) filter (where v.origen = 'link'), 0) as l
      from generate_series(v_desde, (now() at time zone 'America/Lima')::date, interval '1 day') g
      left join public.visitas_diarias v
             on v.profile_id = v_id and v.dia = g::date
      group by g
    ) s;
  end if;

  return jsonb_build_object(
    'pro', v_pro, 'dias', p_dias,
    'total', v_total, 'qr', v_qr, 'link', v_total - v_qr,
    'serie', v_serie
  );
end;
$$;
revoke all on function public.estadisticas_perfil(integer) from public, anon;
grant execute on function public.estadisticas_perfil(integer) to authenticated;
