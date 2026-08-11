-- Least-privilege operational read API.
--
-- These SECURITY DEFINER functions expose only the fields required by
-- scoring/event operations. Sensitive athlete contact/emergency data and
-- registration financial/refund data are intentionally excluded.
--
-- Authorization is checked explicitly before reading the base tables.

create or replace function public.get_operational_athletes(
  p_organization_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  first_name text,
  last_name text,
  preferred_name text,
  cyssa_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'coach', 'scorekeeper']
  ) then
    raise exception 'Insufficient permissions';
  end if;

  return query
  select
    a.id,
    a.organization_id,
    a.first_name,
    a.last_name,
    a.preferred_name,
    a.cyssa_number
  from public.athletes a
  where a.organization_id = p_organization_id;
end;
$$;


create or replace function public.get_operational_registrations(
  p_organization_id uuid,
  p_event_id uuid default null
)
returns table (
  id uuid,
  organization_id uuid,
  event_id uuid,
  athlete_id uuid,
  team_id uuid,
  class_id uuid,
  registration_number text,
  status text,
  checked_in boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'coach', 'scorekeeper']
  ) then
    raise exception 'Insufficient permissions';
  end if;

  return query
  select
    r.id,
    r.organization_id,
    r.event_id,
    r.athlete_id,
    r.team_id,
    r.class_id,
    r.registration_number,
    r.status,
    r.checked_in
  from public.registrations r
  where r.organization_id = p_organization_id
    and (
      p_event_id is null
      or r.event_id = p_event_id
    );
end;
$$;


create or replace function public.get_operational_registration_shoots(
  p_organization_id uuid,
  p_event_id uuid default null
)
returns table (
  id uuid,
  organization_id uuid,
  event_id uuid,
  registration_id uuid,
  shoot_id uuid,
  status text,
  checked_in boolean,
  squad_assignment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'coach', 'scorekeeper']
  ) then
    raise exception 'Insufficient permissions';
  end if;

  return query
  select
    rs.id,
    rs.organization_id,
    rs.event_id,
    rs.registration_id,
    rs.shoot_id,
    rs.status,
    rs.checked_in,
    rs.squad_assignment_status
  from public.registration_shoots rs
  where rs.organization_id = p_organization_id
    and (
      p_event_id is null
      or rs.event_id = p_event_id
    );
end;
$$;


-- No anonymous/public execution.

revoke all on function public.get_operational_athletes(uuid)
from public, anon;

revoke all on function public.get_operational_registrations(uuid, uuid)
from public, anon;

revoke all on function public.get_operational_registration_shoots(uuid, uuid)
from public, anon;


-- Application users and backend service role may execute.

grant execute on function public.get_operational_athletes(uuid)
to authenticated, service_role;

grant execute on function public.get_operational_registrations(uuid, uuid)
to authenticated, service_role;

grant execute on function public.get_operational_registration_shoots(uuid, uuid)
to authenticated, service_role;
