-- ClayKeeper Awards Engine v3 workflow

alter table public.award_publications
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

alter table public.award_publications
  drop constraint if exists award_publications_status_check;

update public.award_publications
set status = case
  when status = 'draft' then 'provisional'
  when status = 'locked' then 'published'
  else status
end;

alter table public.award_publications
  add constraint award_publications_status_check
  check (status in ('provisional', 'approved', 'published'));

alter table public.award_publications
  alter column status set default 'provisional';

create index if not exists award_publications_event_status_idx
  on public.award_publications (event_id, status);
