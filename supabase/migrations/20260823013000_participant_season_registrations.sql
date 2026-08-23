-- ClayKeeper: participant season registration requirements.
--
-- Returning shooters keep their permanent participant profile, but
-- must complete a season-level registration for each active season.

create table if not exists public.participant_season_registrations (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  season_id uuid not null,
  athlete_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'pending',
  payment_status text not null default 'pending',

  selected_disciplines text[] not null default '{}'::text[],
  waivers_accepted jsonb not null default '{}'::jsonb,
  signature_type text,
  signature_value text,
  profile_confirmed_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint participant_season_registrations_status_valid
    check (status in ('pending', 'completed', 'cancelled')),

  constraint participant_season_registrations_payment_status_valid
    check (payment_status in ('pending', 'paid', 'waived', 'failed')),

  constraint participant_season_registrations_signature_type_valid
    check (
      signature_type is null
      or signature_type in ('drawn', 'typed')
    ),

  constraint participant_season_registrations_season_same_org
    foreign key (season_id, organization_id)
    references public.seasons(id, organization_id)
    on delete cascade,

  constraint participant_season_registrations_athlete_same_org
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete cascade,

  constraint participant_season_registrations_unique_season_athlete
    unique (season_id, athlete_id)
);

comment on table public.participant_season_registrations
is 'Season-level registration proof for returning and new participant profiles.';

create index if not exists participant_season_registrations_user_idx
  on public.participant_season_registrations(user_id, organization_id, season_id);

create trigger participant_season_registrations_set_updated_at
before update on public.participant_season_registrations
for each row execute function public.set_updated_at();

alter table public.participant_season_registrations enable row level security;

create policy "Participants view their season registrations"
on public.participant_season_registrations
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.has_organization_role(organization_id, array['owner','admin','coach']))
);

create policy "Participants create their season registrations"
on public.participant_season_registrations
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.athletes as a
    where a.id = athlete_id
      and a.organization_id = organization_id
      and a.user_id = (select auth.uid())
  )
);

create policy "Participants update their pending season registrations"
on public.participant_season_registrations
for update to authenticated
using (
  user_id = (select auth.uid())
  or (select public.has_organization_role(organization_id, array['owner','admin']))
)
with check (
  user_id = (select auth.uid())
  or (select public.has_organization_role(organization_id, array['owner','admin']))
);

create or replace function public.get_participant_season_registration_status(
  p_organization_id uuid default null
)
returns table (
  registration_required boolean,
  organization_id uuid,
  organization_slug text,
  organization_name text,
  season_id uuid,
  season_name text,
  athlete_id uuid,
  participant_number text,
  first_name text,
  last_name text,
  email text,
  phone text,
  registration_id uuid,
  registration_status text,
  payment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_organization_id is not null then
    v_org_id := p_organization_id;
  else
    select om.organization_id
    into v_org_id
    from public.organization_members as om
    join public.organizations as o on o.id = om.organization_id
    where om.user_id = v_user_id
      and om.active = true
      and o.active = true
    order by om.created_at
    limit 1;
  end if;

  if v_org_id is null then
    return;
  end if;

  return query
  with active_season as (
    select s.*
    from public.seasons as s
    where s.organization_id = v_org_id
      and s.status = 'active'
    order by s.start_date desc
    limit 1
  ),
  participant as (
    select a.*
    from public.athletes as a
    where a.organization_id = v_org_id
      and a.user_id = v_user_id
      and a.active = true
    order by a.created_at desc
    limit 1
  )
  select
    case
      when s.id is null then false
      when a.id is null then false
      when psr.id is null then true
      when psr.status <> 'completed' then true
      when psr.payment_status not in ('paid', 'waived') then true
      else false
    end as registration_required,
    o.id as organization_id,
    o.slug as organization_slug,
    o.name as organization_name,
    s.id as season_id,
    s.name as season_name,
    a.id as athlete_id,
    a.participant_number,
    a.first_name,
    a.last_name,
    a.email,
    a.phone,
    psr.id as registration_id,
    psr.status as registration_status,
    psr.payment_status
  from public.organizations as o
  left join active_season as s on true
  left join participant as a on true
  left join public.participant_season_registrations as psr
    on psr.organization_id = o.id
   and psr.season_id = s.id
   and psr.athlete_id = a.id
  where o.id = v_org_id;
end;
$$;

revoke all on function public.get_participant_season_registration_status(uuid)
from public, anon;

grant execute on function public.get_participant_season_registration_status(uuid)
to authenticated;

create or replace function public.complete_participant_season_registration(
  p_organization_id uuid,
  p_selected_disciplines text[] default '{}'::text[],
  p_waivers_accepted jsonb default '{}'::jsonb,
  p_signature_type text default null,
  p_signature_value text default null
)
returns public.participant_season_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_season public.seasons;
  v_athlete public.athletes;
  v_registration public.participant_season_registrations;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_season
  from public.seasons
  where organization_id = p_organization_id
    and status = 'active'
  order by start_date desc
  limit 1;

  if not found then
    raise exception 'No active season is available for registration';
  end if;

  select *
  into v_athlete
  from public.athletes
  where organization_id = p_organization_id
    and user_id = v_user_id
    and active = true
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'No participant profile was found for this account';
  end if;

  if nullif(trim(coalesce(p_signature_value, '')), '') is null then
    raise exception 'Digital signature is required';
  end if;

  insert into public.participant_season_registrations (
    organization_id,
    season_id,
    athlete_id,
    user_id,
    status,
    payment_status,
    selected_disciplines,
    waivers_accepted,
    signature_type,
    signature_value,
    profile_confirmed_at,
    completed_at
  )
  values (
    p_organization_id,
    v_season.id,
    v_athlete.id,
    v_user_id,
    'completed',
    'waived',
    coalesce(p_selected_disciplines, '{}'::text[]),
    coalesce(p_waivers_accepted, '{}'::jsonb),
    nullif(trim(p_signature_type), ''),
    nullif(trim(p_signature_value), ''),
    now(),
    now()
  )
  on conflict (season_id, athlete_id)
  do update set
    status = excluded.status,
    payment_status = excluded.payment_status,
    selected_disciplines = excluded.selected_disciplines,
    waivers_accepted = excluded.waivers_accepted,
    signature_type = excluded.signature_type,
    signature_value = excluded.signature_value,
    profile_confirmed_at = excluded.profile_confirmed_at,
    completed_at = excluded.completed_at
  returning *
  into v_registration;

  return v_registration;
end;
$$;

revoke all on function public.complete_participant_season_registration(
  uuid,
  text[],
  jsonb,
  text,
  text
)
from public, anon;

grant execute on function public.complete_participant_season_registration(
  uuid,
  text[],
  jsonb,
  text,
  text
)
to authenticated;
