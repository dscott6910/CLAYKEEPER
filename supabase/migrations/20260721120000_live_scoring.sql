-- ============================================================
-- ClayKeeper
-- Migration: Live scoring and shoot-offs
-- ============================================================

create table public.score_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null,
  shoot_id uuid not null,
  squad_member_id uuid not null,
  round_number integer not null,
  score integer,
  status text not null default 'entered',
  entered_by uuid references auth.users(id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint score_entries_round_positive check (round_number > 0),
  constraint score_entries_score_valid check (score is null or score between 0 and 100),
  constraint score_entries_status_valid check (status in ('entered','verified','corrected','disqualified')),
  constraint score_entries_shoot_same_organization
    foreign key (shoot_id, event_id, organization_id)
    references public.shoots(id, event_id, organization_id)
    on delete cascade,
  constraint score_entries_member_same_shoot_org
    foreign key (squad_member_id, shoot_id, organization_id)
    references public.squad_members(id, shoot_id, organization_id)
    on delete cascade,
  constraint score_entries_one_per_round unique (squad_member_id, round_number)
);

create index score_entries_shoot_round_idx on public.score_entries(shoot_id, round_number);
create index score_entries_member_idx on public.score_entries(squad_member_id);

create trigger score_entries_set_updated_at
before update on public.score_entries
for each row execute function public.set_updated_at();

create table public.shoot_off_rounds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null,
  shoot_id uuid not null,
  round_number integer not null,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint shoot_off_rounds_number_positive check (round_number > 0),
  constraint shoot_off_rounds_label_not_blank check (label is null or length(trim(label)) > 0),
  constraint shoot_off_rounds_shoot_same_organization
    foreign key (shoot_id, event_id, organization_id)
    references public.shoots(id, event_id, organization_id)
    on delete cascade,
  constraint shoot_off_rounds_unique unique (shoot_id, round_number)
);

create table public.shoot_off_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null,
  shoot_id uuid not null,
  shoot_off_round_id uuid not null references public.shoot_off_rounds(id) on delete cascade,
  squad_member_id uuid not null,
  score integer,
  entered_by uuid references auth.users(id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shoot_off_scores_score_valid check (score is null or score between 0 and 100),
  constraint shoot_off_scores_member_same_shoot_org
    foreign key (squad_member_id, shoot_id, organization_id)
    references public.squad_members(id, shoot_id, organization_id)
    on delete cascade,
  constraint shoot_off_scores_one_per_member_round unique (shoot_off_round_id, squad_member_id)
);

create index shoot_off_rounds_shoot_idx on public.shoot_off_rounds(shoot_id, round_number);
create index shoot_off_scores_shoot_idx on public.shoot_off_scores(shoot_id);

create trigger shoot_off_scores_set_updated_at
before update on public.shoot_off_scores
for each row execute function public.set_updated_at();

alter table public.score_entries enable row level security;
alter table public.shoot_off_rounds enable row level security;
alter table public.shoot_off_scores enable row level security;

create policy "Members can view score entries" on public.score_entries
for select to authenticated using ((select public.is_organization_member(organization_id)));
create policy "Authorized members can create score entries" on public.score_entries
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));
create policy "Authorized members can update score entries" on public.score_entries
for update to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin','coach'])))
with check ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));
create policy "Owners and admins can delete score entries" on public.score_entries
for delete to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin'])));

create policy "Members can view shoot-off rounds" on public.shoot_off_rounds
for select to authenticated using ((select public.is_organization_member(organization_id)));
create policy "Authorized members can create shoot-off rounds" on public.shoot_off_rounds
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));
create policy "Authorized members can update shoot-off rounds" on public.shoot_off_rounds
for update to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin','coach'])))
with check ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));
create policy "Owners admins and coaches can delete shoot-off rounds" on public.shoot_off_rounds
for delete to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));

create policy "Members can view shoot-off scores" on public.shoot_off_scores
for select to authenticated using ((select public.is_organization_member(organization_id)));
create policy "Authorized members can create shoot-off scores" on public.shoot_off_scores
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));
create policy "Authorized members can update shoot-off scores" on public.shoot_off_scores
for update to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin','coach'])))
with check ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));
create policy "Owners admins and coaches can delete shoot-off scores" on public.shoot_off_scores
for delete to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));
