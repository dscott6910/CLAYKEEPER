-- ClayKeeper: frozen season championship records and controlled finalization.

create table if not exists public.season_final_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  season_name text not null,
  season_start_date date not null,
  season_end_date date not null,
  scoring_rule text not null,
  individual_standings jsonb not null default '[]'::jsonb,
  team_standings jsonb not null default '[]'::jsonb,
  qualification_snapshot jsonb not null default '{}'::jsonb,
  event_snapshot jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint season_final_records_unique_season unique (season_id),
  constraint season_final_records_id_org_unique unique (id, organization_id)
);

create index if not exists season_final_records_org_finalized_idx
  on public.season_final_records(organization_id, finalized_at desc);

alter table public.season_final_records enable row level security;

drop policy if exists "Members can view season final records" on public.season_final_records;
create policy "Members can view season final records" on public.season_final_records
for select to authenticated using ((select public.is_organization_member(organization_id)));

drop policy if exists "Owners and admins can create season final records" on public.season_final_records;
create policy "Owners and admins can create season final records" on public.season_final_records
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin'])));

create or replace function public.finalize_season_records(
  p_season_id uuid,
  p_scoring_rule text,
  p_individual_standings jsonb,
  p_team_standings jsonb,
  p_qualification_snapshot jsonb,
  p_event_snapshot jsonb,
  p_summary jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.seasons%rowtype;
  v_record_id uuid;
  v_incomplete integer;
  v_unavailable integer;
begin
  select * into v_season
  from public.seasons
  where id = p_season_id
  for update;

  if v_season.id is null then
    raise exception 'Season not found';
  end if;

  if not public.has_organization_role(v_season.organization_id, array['owner','admin']) then
    raise exception 'Only an organization owner or administrator can finalize a season';
  end if;

  if exists (select 1 from public.season_final_records where season_id = p_season_id) then
    raise exception 'This season has already been finalized';
  end if;

  v_incomplete := coalesce((p_summary ->> 'incompleteResults')::integer, 0);
  v_unavailable := coalesce((p_summary ->> 'unavailableEvents')::integer, 0);

  if v_incomplete > 0 then
    raise exception 'Season cannot be finalized while athlete results are incomplete';
  end if;

  if v_unavailable > 0 then
    raise exception 'Season cannot be finalized while event scoring data is unavailable';
  end if;

  insert into public.season_final_records (
    organization_id,
    season_id,
    season_name,
    season_start_date,
    season_end_date,
    scoring_rule,
    individual_standings,
    team_standings,
    qualification_snapshot,
    event_snapshot,
    summary,
    finalized_by
  ) values (
    v_season.organization_id,
    v_season.id,
    v_season.name,
    v_season.start_date,
    v_season.end_date,
    p_scoring_rule,
    coalesce(p_individual_standings, '[]'::jsonb),
    coalesce(p_team_standings, '[]'::jsonb),
    coalesce(p_qualification_snapshot, '{}'::jsonb),
    coalesce(p_event_snapshot, '[]'::jsonb),
    coalesce(p_summary, '{}'::jsonb),
    auth.uid()
  )
  returning id into v_record_id;

  update public.seasons
  set status = 'archived',
      closed_at = coalesce(closed_at, now()),
      closed_by = coalesce(closed_by, auth.uid())
  where id = p_season_id;

  return v_record_id;
end;
$$;

grant execute on function public.finalize_season_records(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
