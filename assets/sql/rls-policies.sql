-- ============================================================
-- RLS POLICIES
-- Ejecutar después de schema.sql y functions.sql
-- Principio: deny by default, mínimo privilegio, dueño = auth.uid() = user_id
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
drop policy if exists "profiles_select_publico_o_dueno" on public.profiles;
create policy "profiles_select_publico_o_dueno" on public.profiles
  for select
  using (
    activo = true
    or auth.uid() = user_id
  );

drop policy if exists "profiles_insert_dueno" on public.profiles;
create policy "profiles_insert_dueno" on public.profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_dueno" on public.profiles;
create policy "profiles_update_dueno" on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_dueno" on public.profiles;
create policy "profiles_delete_dueno" on public.profiles
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- gallery_images (visible si el perfil dueño está activo, o si eres el dueño)
-- ------------------------------------------------------------
drop policy if exists "gallery_select_publico_o_dueno" on public.gallery_images;
create policy "gallery_select_publico_o_dueno" on public.gallery_images
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = gallery_images.profile_id
        and (p.activo = true or p.user_id = auth.uid())
    )
  );

drop policy if exists "gallery_insert_dueno" on public.gallery_images;
create policy "gallery_insert_dueno" on public.gallery_images
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = gallery_images.profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "gallery_update_dueno" on public.gallery_images;
create policy "gallery_update_dueno" on public.gallery_images
  for update
  using (
    exists (select 1 from public.profiles p where p.id = gallery_images.profile_id and p.user_id = auth.uid())
  );

drop policy if exists "gallery_delete_dueno" on public.gallery_images;
create policy "gallery_delete_dueno" on public.gallery_images
  for delete
  using (
    exists (select 1 from public.profiles p where p.id = gallery_images.profile_id and p.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- citas: solo el dueño del perfil puede leer sus propias solicitudes.
-- No hay política de INSERT pública a propósito: la escritura pasa
-- siempre por la función public.crear_cita() (SECURITY DEFINER, ver
-- functions.sql), que valida horario disponible y evita duplicados
-- antes de insertar, sin exponer la tabla directamente al visitante.
-- ------------------------------------------------------------
drop policy if exists "citas_select_dueno" on public.citas;
create policy "citas_select_dueno" on public.citas
  for select
  using (
    exists (select 1 from public.profiles p where p.id = citas.profile_id and p.user_id = auth.uid())
  );

drop policy if exists "citas_delete_dueno" on public.citas;
create policy "citas_delete_dueno" on public.citas
  for delete
  using (
    exists (select 1 from public.profiles p where p.id = citas.profile_id and p.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- slugs_reservados: solo lectura pública, sin escritura desde cliente
-- ------------------------------------------------------------
drop policy if exists "slugs_reservados_select_publico" on public.slugs_reservados;
create policy "slugs_reservados_select_publico" on public.slugs_reservados
  for select
  using (true);

-- ============================================================
-- STORAGE: buckets y políticas
-- Estructura de paths: {user_id}/archivo.ext
-- Los buckets se crean aquí mismo (idempotente); si ya existen no falla.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

drop policy if exists "avatars_lectura_publica" on storage.objects;
create policy "avatars_lectura_publica" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_escritura_dueno" on storage.objects;
create policy "avatars_escritura_dueno" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_dueno" on storage.objects;
create policy "avatars_update_dueno" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_dueno" on storage.objects;
create policy "avatars_delete_dueno" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "gallery_lectura_publica" on storage.objects;
create policy "gallery_lectura_publica" on storage.objects
  for select using (bucket_id = 'gallery');

drop policy if exists "gallery_escritura_dueno" on storage.objects;
create policy "gallery_escritura_dueno" on storage.objects
  for insert with check (
    bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "gallery_delete_dueno" on storage.objects;
create policy "gallery_delete_dueno" on storage.objects
  for delete using (
    bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text
  );
