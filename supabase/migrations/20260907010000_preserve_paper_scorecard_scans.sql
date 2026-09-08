-- Keep the reviewed paper scorecard alongside the finalized digital result.
alter table public.digital_scorecards
  add column if not exists scan_storage_path text;

insert into storage.buckets (id, name, public)
values ('scorecard-scans', 'scorecard-scans', false)
on conflict (id) do update set public = false;

drop policy if exists "scorecard scans members can read" on storage.objects;
create policy "scorecard scans members can read" on storage.objects
for select to authenticated
using (
  bucket_id = 'scorecard-scans'
  and public.is_organization_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "scorecard scans scoring roles can upload" on storage.objects;
create policy "scorecard scans scoring roles can upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'scorecard-scans'
  and public.has_organization_role((storage.foldername(name))[1]::uuid, array['owner','admin','coach','scorekeeper'])
);

drop policy if exists "scorecard scans scoring roles can update" on storage.objects;
create policy "scorecard scans scoring roles can update" on storage.objects
for update to authenticated
using (
  bucket_id = 'scorecard-scans'
  and public.has_organization_role((storage.foldername(name))[1]::uuid, array['owner','admin','coach','scorekeeper'])
)
with check (
  bucket_id = 'scorecard-scans'
  and public.has_organization_role((storage.foldername(name))[1]::uuid, array['owner','admin','coach','scorekeeper'])
);

drop policy if exists "scorecard scans scoring roles can delete" on storage.objects;
create policy "scorecard scans scoring roles can delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'scorecard-scans'
  and public.has_organization_role((storage.foldername(name))[1]::uuid, array['owner','admin','coach','scorekeeper'])
);
