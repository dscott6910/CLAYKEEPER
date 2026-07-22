-- ClayKeeper Sprint 13: season close-out audit and rollover
create table if not exists public.season_closeouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  next_season_id uuid references public.seasons(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz not null default now(),
  constraint season_closeouts_unique unique (season_id)
);

alter table public.season_closeouts enable row level security;
create policy "Members can view season closeouts" on public.season_closeouts
for select to authenticated using ((select public.is_organization_member(organization_id)));
create policy "Owners and admins can create season closeouts" on public.season_closeouts
for insert to authenticated with check ((select public.has_organization_role(organization_id, array['owner','admin'])));

create or replace function public.close_season_and_rollover(
  p_season_id uuid,
  p_create_next boolean default false,
  p_next_name text default null,
  p_next_start_date date default null,
  p_next_end_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_next_id uuid;
  v_event_count integer;
  v_registration_count integer;
  v_shoot_count integer;
  v_score_count integer;
  v_summary jsonb;
begin
  select organization_id into v_org from public.seasons where id = p_season_id;
  if v_org is null then raise exception 'Season not found'; end if;
  if not public.has_organization_role(v_org, array['owner','admin']) then
    raise exception 'Only an organization owner or administrator can close a season';
  end if;

  select count(*) into v_event_count from public.events where season_id = p_season_id;
  select count(*) into v_shoot_count from public.shoots s join public.events e on e.id = s.event_id where e.season_id = p_season_id;
  select count(*) into v_registration_count from public.registrations r join public.events e on e.id = r.event_id where e.season_id = p_season_id;
  select count(*) into v_score_count from public.score_entries se join public.events e on e.id = se.event_id where e.season_id = p_season_id;

  update public.events
     set status = case when status in ('cancelled','archived') then status else 'archived' end,
         active = false
   where season_id = p_season_id;

  update public.seasons
     set status = 'closed', closed_at = now(), closed_by = auth.uid()
   where id = p_season_id;

  if p_create_next then
    if nullif(trim(p_next_name), '') is null or p_next_start_date is null or p_next_end_date is null then
      raise exception 'Next season name and dates are required';
    end if;
    if p_next_end_date < p_next_start_date then raise exception 'Next season end date must be on or after its start date'; end if;
    update public.seasons set status='closed', closed_at=coalesce(closed_at,now()), closed_by=coalesce(closed_by,auth.uid())
      where organization_id=v_org and status='active' and id<>p_season_id;
    insert into public.seasons (organization_id,name,start_date,end_date,status,created_by)
    values (v_org,trim(p_next_name),p_next_start_date,p_next_end_date,'active',auth.uid())
    returning id into v_next_id;
  end if;

  v_summary := jsonb_build_object(
    'events', v_event_count,
    'shoots', v_shoot_count,
    'registrations', v_registration_count,
    'scores', v_score_count,
    'closedSeasonId', p_season_id,
    'nextSeasonId', v_next_id
  );

  insert into public.season_closeouts (organization_id,season_id,next_season_id,summary,closed_by)
  values (v_org,p_season_id,v_next_id,v_summary,auth.uid())
  on conflict (season_id) do update set next_season_id=excluded.next_season_id, summary=excluded.summary, closed_by=excluded.closed_by, closed_at=now();

  return v_summary;
end;
$$;

grant execute on function public.close_season_and_rollover(uuid, boolean, text, date, date) to authenticated;
