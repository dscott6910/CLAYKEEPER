-- Marking a participant as a no-show from Live Scoring must also update the
-- event registration so the Registration page immediately displays both
-- "Not Checked In" and "No-Show".

create or replace function public.mark_registration_no_show_from_scoring(
  p_organization_id uuid,
  p_squad_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_registration_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'coach']
  ) then
    raise exception 'Insufficient permissions';
  end if;

  select rs.registration_id
    into v_registration_id
  from public.squad_members as sm
  join public.registration_shoots as rs
    on rs.id = sm.registration_shoot_id
  where sm.id = p_squad_member_id
    and sm.organization_id = p_organization_id
    and rs.organization_id = p_organization_id;

  if v_registration_id is null then
    raise exception 'The participant assignment could not be found.';
  end if;

  -- Write every attendance field explicitly. The existing no-show trigger
  -- enforces the same values for all other registration workflows.
  update public.registrations
  set
    status = 'withdrawn',
    attendance_status = 'no_show',
    checked_in = false,
    checked_in_at = null,
    checked_in_by = null,
    attendance_notes = 'Marked as a no-show from round score entry.'
  where id = v_registration_id
    and organization_id = p_organization_id;

  if not found then
    raise exception 'The participant registration could not be found.';
  end if;

  -- A registration is event-wide, so release any of this participant's squad
  -- positions for the event while preserving member rows and scoring history.
  update public.squad_members as sm
  set
    status = 'no_show',
    assignment_method = 'manual'
  where sm.organization_id = p_organization_id
    and sm.registration_shoot_id in (
      select rs.id
      from public.registration_shoots as rs
      where rs.organization_id = p_organization_id
        and rs.registration_id = v_registration_id
    )
    and sm.status not in ('withdrawn', 'no_show', 'disqualified');

  return v_registration_id;
end;
$$;

revoke all on function public.mark_registration_no_show_from_scoring(uuid, uuid)
from public, anon;

grant execute on function public.mark_registration_no_show_from_scoring(uuid, uuid)
to authenticated, service_role;

comment on function public.mark_registration_no_show_from_scoring(uuid, uuid)
is 'Atomically marks a Live Scoring participant as an event no-show, clears check-in, and releases active squad positions.';
