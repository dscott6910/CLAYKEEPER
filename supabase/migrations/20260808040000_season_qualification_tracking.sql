-- ClayKeeper: preserve season qualification tracking schema in source control.

alter table public.seasons
  add column if not exists qualification_enabled boolean not null default false,
  add column if not exists qualification_min_events integer not null default 3,
  add column if not exists qualification_notes text;

alter table public.seasons
  drop constraint if exists seasons_qualification_min_events_valid;

alter table public.seasons
  add constraint seasons_qualification_min_events_valid
  check (qualification_min_events between 1 and 100);
