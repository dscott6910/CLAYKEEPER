-- ClayKeeper: seasons and historical spreadsheet import tracking

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'planning',
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_name_not_blank check (length(trim(name)) > 0),
  constraint seasons_date_range_valid check (end_date >= start_date),
  constraint seasons_status_valid check (status in ('planning','active','closed','archived')),
  constraint seasons_unique_name unique (organization_id, name),
  constraint seasons_id_org_unique unique (id, organization_id)
);

create unique index if not exists seasons_one_active_per_org_idx
  on public.seasons(organization_id) where status = 'active';
create index if not exists seasons_org_dates_idx
  on public.seasons(organization_id, start_date desc);

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function public.set_updated_at();

alter table public.events add column if not exists season_id uuid;
alter table public.events drop constraint if exists events_season_same_organization;
alter table public.events add constraint events_season_same_organization
  foreign key (season_id, organization_id)
  references public.seasons(id, organization_id)
  on delete restrict;
create index if not exists events_season_idx on public.events(season_id, start_date);

create table if not exists public.historical_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  season_id uuid,
  event_id uuid,
  file_name text not null,
  worksheet_name text,
  status text not null default 'previewed',
  row_count integer not null default 0,
  imported_row_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  column_mapping jsonb not null default '{}'::jsonb,
  import_summary jsonb not null default '{}'::jsonb,
  source_rows jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint historical_imports_status_valid check (status in ('previewed','importing','completed','completed_with_warnings','failed','reversed')),
  constraint historical_imports_counts_valid check (row_count >= 0 and imported_row_count >= 0 and warning_count >= 0 and error_count >= 0),
  constraint historical_imports_season_same_org foreign key (season_id, organization_id) references public.seasons(id, organization_id) on delete restrict,
  constraint historical_imports_event_same_org foreign key (event_id, organization_id) references public.events(id, organization_id) on delete set null
);
create index if not exists historical_imports_org_created_idx on public.historical_imports(organization_id, created_at desc);

alter table public.seasons enable row level security;
alter table public.historical_imports enable row level security;

create policy "Members can view seasons" on public.seasons
for select to authenticated using ((select public.is_organization_member(organization_id)));
create policy "Owners and admins can create seasons" on public.seasons
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin'])));
create policy "Owners and admins can update seasons" on public.seasons
for update to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin'])))
with check ((select public.has_organization_role(organization_id, array['owner','admin'])));
create policy "Owners and admins can delete seasons" on public.seasons
for delete to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin'])));

create policy "Members can view historical imports" on public.historical_imports
for select to authenticated using ((select public.is_organization_member(organization_id)));
create policy "Owners and admins can create historical imports" on public.historical_imports
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin'])));
create policy "Owners and admins can update historical imports" on public.historical_imports
for update to authenticated using ((select public.has_organization_role(organization_id, array['owner','admin'])))
with check ((select public.has_organization_role(organization_id, array['owner','admin'])));

create or replace function public.activate_season(p_season_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.seasons where id = p_season_id;
  if v_org is null then raise exception 'Season not found'; end if;
  if not public.has_organization_role(v_org, array['owner','admin']) then raise exception 'Not authorized'; end if;
  update public.seasons set status = 'closed', closed_at = coalesce(closed_at, now()), closed_by = coalesce(closed_by, auth.uid())
    where organization_id = v_org and status = 'active' and id <> p_season_id;
  update public.seasons set status = 'active', closed_at = null, closed_by = null where id = p_season_id;
end; $$;

create or replace function public.close_season(p_season_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.seasons where id = p_season_id;
  if v_org is null then raise exception 'Season not found'; end if;
  if not public.has_organization_role(v_org, array['owner','admin']) then raise exception 'Not authorized'; end if;
  update public.events set status = case when status in ('cancelled','archived') then status else 'archived' end, active = false
    where season_id = p_season_id;
  update public.seasons set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = p_season_id;
end; $$;
