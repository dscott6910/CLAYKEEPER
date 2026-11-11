-- ============================================================
-- ClayKeeper
-- Preserve complete ActiveNet registration reports
-- ============================================================

alter table public.activenet_imports
  add column if not exists participant_count integer not null default 0,
  add column if not exists updated_count integer not null default 0;

alter table public.activenet_participant_records
  add column if not exists participant_external_id text,
  add column if not exists source_data jsonb not null default '{}'::jsonb;

update public.activenet_imports
set participant_count = matched_count + new_count
where participant_count = 0
  and matched_count + new_count > 0;

comment on column public.activenet_imports.participant_count
is 'Number of unique ActiveNet participants reviewed in the import.';

comment on column public.activenet_imports.updated_count
is 'Number of existing ClayKeeper participant profiles that received previously blank values.';

comment on column public.activenet_participant_records.participant_external_id
is 'Stable participant identifier supplied by ActiveNet.';

comment on column public.activenet_participant_records.source_data
is 'Complete nonblank source row keyed by the original ActiveNet column headings.';

do $$
declare
  duplicate_constraint text;
begin
  select c.conname
    into duplicate_constraint
  from pg_constraint c
  where c.conrelid = 'public.activenet_participant_records'::regclass
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) like '%(import_id, participant_name, season_name, session_name)%'
  limit 1;

  if duplicate_constraint is not null then
    execute format(
      'alter table public.activenet_participant_records drop constraint %I',
      duplicate_constraint
    );
  end if;
end
$$;

create unique index if not exists activenet_records_source_row_unique_idx
  on public.activenet_participant_records (
    import_id,
    source_row_number
  )
  where source_row_number is not null;

create unique index if not exists activenet_records_legacy_registration_unique_idx
  on public.activenet_participant_records (
    import_id,
    coalesce(participant_external_id, ''),
    participant_name,
    coalesce(season_name, ''),
    coalesce(session_name, '')
  )
  where source_row_number is null;

create index if not exists activenet_records_external_participant_idx
  on public.activenet_participant_records (
    organization_id,
    participant_external_id
  )
  where participant_external_id is not null;
