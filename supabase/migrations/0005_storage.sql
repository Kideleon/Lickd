-- Storage buckets and access rules.
--   avatars : public bucket for avatars, covers, group/event covers (non-sensitive, CDN-cached)
--   media   : PRIVATE bucket for post/story/album/message media; served via signed URLs,
--             readable only when public.can_read_media(path) says the viewer may see the content.
-- Object paths are always  <owner uuid>/<random>.<ext>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('media',   'media',   false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.auth_active());
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.can_read_media(name));
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text and public.auth_active());
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
