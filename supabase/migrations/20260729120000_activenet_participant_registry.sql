create table if not exists public.activenet_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  row_count integer not null default 0,
  matched_count integer not null default 0,
  new_count integer not null default 0,
  skipped_count integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.activenet_participant_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid not null references public.activenet_imports(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete set null,
  participant_name text not null,
  gender text,
  guardian_name text,
  season_name text,
  session_name text,
  participant_age numeric,
  source_row_number integer,
  match_status text not null check (match_status in ('exact_match','reviewed_match','created_new','skipped')),
  created_at timestamptz not null default now(),
  unique(import_id, participant_name, season_name, session_name)
);

create index if not exists activenet_records_athlete_idx on public.activenet_participant_records(athlete_id);
create index if not exists activenet_records_season_session_idx on public.activenet_participant_records(organization_id, season_name, session_name);

alter table public.activenet_imports enable row level security;
alter table public.activenet_participant_records enable row level security;

create policy "organization members manage activenet imports" on public.activenet_imports for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy "organization members manage activenet participant records" on public.activenet_participant_records for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
