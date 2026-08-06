-- ClayKeeper digital station-by-station scoring

create table if not exists public.digital_scorecards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  shoot_id uuid not null references public.shoots(id) on delete cascade,
  squad_member_id uuid not null references public.squad_members(id) on delete cascade,
  course_id uuid not null references public.event_courses(id) on delete restrict,
  status text not null default 'draft',
  malfunction_count integer not null default 0,
  verified_by_1 text,
  verified_by_2 text,
  entered_by_name text,
  notes text,
  total_score integer not null default 0,
  total_targets integer not null default 0,
  finalized_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_scorecards_status_check check (status in ('draft','finalized')),
  constraint digital_scorecards_malfunction_check check (malfunction_count between 0 and 3),
  constraint digital_scorecards_total_check check (total_score >= 0 and total_targets >= 0 and total_score <= total_targets),
  constraint digital_scorecards_member_unique unique (squad_member_id)
);

create table if not exists public.digital_scorecard_station_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  shoot_id uuid not null references public.shoots(id) on delete cascade,
  scorecard_id uuid not null references public.digital_scorecards(id) on delete cascade,
  station_id uuid not null references public.course_stations(id) on delete restrict,
  hits integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_station_scores_hits_check check (hits >= 0),
  constraint digital_station_scores_unique unique (scorecard_id, station_id)
);

create index if not exists digital_scorecards_event_idx on public.digital_scorecards(event_id, status);
create index if not exists digital_scorecards_shoot_idx on public.digital_scorecards(shoot_id, status);
create index if not exists digital_station_scores_scorecard_idx on public.digital_scorecard_station_scores(scorecard_id);

alter table public.digital_scorecards enable row level security;
alter table public.digital_scorecard_station_scores enable row level security;

drop policy if exists "digital_scorecards_members_all" on public.digital_scorecards;
create policy "digital_scorecards_members_all" on public.digital_scorecards
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists "digital_station_scores_members_all" on public.digital_scorecard_station_scores;
create policy "digital_station_scores_members_all" on public.digital_scorecard_station_scores
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
