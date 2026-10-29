-- Private buckets for sky photos and Live clips; each user owns the folder named after their uid.
insert into storage.buckets (id, name, public) values ('photos','photos',false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('live','live',false) on conflict (id) do nothing;

create policy "own photo objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own live objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'live' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'live' and (storage.foldername(name))[1] = auth.uid()::text);
