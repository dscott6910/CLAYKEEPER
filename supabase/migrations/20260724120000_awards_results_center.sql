-- ClayKeeper Sprint 15: Awards & Results Center

create table if not exists public.award_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  shoot_id uuid not null references public.shoots(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','published','locked')),
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint award_publications_one_per_shoot unique (shoot_id)
);

create table if not exists public.award_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  shoot_id uuid not null references public.shoots(id) on delete cascade,
  registration_shoot_id uuid not null references public.registration_shoots(id) on delete cascade,
  award_group text not null check (award_group in ('overall','class','team','squad')),
  award_key text not null,
  placement integer not null check (placement > 0),
  title text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint award_overrides_unique_placement unique (shoot_id, award_group, award_key, placement),
  constraint award_overrides_unique_participant unique (shoot_id, award_group, award_key, registration_shoot_id)
);

create index if not exists award_publications_event_idx on public.award_publications(event_id);
create index if not exists award_overrides_shoot_idx on public.award_overrides(shoot_id);

alter table public.award_publications enable row level security;
alter table public.award_overrides enable row level security;

create policy "Members can view award publications" on public.award_publications
for select to authenticated using ((select public.is_organization_member(organization_id)));
create policy "Owners and admins can create award publications" on public.award_publications
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin'])));
create policy "Owners and admins can update award publications" on public.award_publications
for update to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin'])))
with check ((select public.has_organization_role(organization_id, array['owner','admin'])));
create policy "Owners and admins can delete award publications" on public.award_publications
for delete to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin'])));

create policy "Members can view award overrides" on public.award_overrides
for select to authenticated using ((select public.is_organization_member(organization_id)));
create policy "Owners and admins can create award overrides" on public.award_overrides
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin'])));
create policy "Owners and admins can update award overrides" on public.award_overrides
for update to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin'])))
with check ((select public.has_organization_role(organization_id, array['owner','admin'])));
create policy "Owners and admins can delete award overrides" on public.award_overrides
for delete to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin'])));

create trigger award_publications_set_updated_at
before update on public.award_publications
for each row execute function public.set_updated_at();

create trigger award_overrides_set_updated_at
before update on public.award_overrides
for each row execute function public.set_updated_at();
