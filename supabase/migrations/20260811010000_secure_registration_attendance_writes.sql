-- Secure tournament-day registration attendance writes behind an
-- explicitly authorized RPC.
--
-- Attendance operations are available to organization owners, admins,
-- and coaches. Financial/refund fields are intentionally not handled here.

create or replace function public.update_registration_attendance(
  p_organization_id uuid,
  p_registration_ids uuid[],
  p_attendance_status text,
  p_attendance_notes text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_updated_count integer;
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

  if p_attendance_status not in (
    'expected',
    'checked_in',
    'late_arrival',
    'no_show',
    'withdrawn',
    'disqualified'
  ) then
    raise exception 'Invalid attendance status';
  end if;

  if p_registration_ids is null
     or cardinality(p_registration_ids) = 0 then
    raise exception 'At least one registration is required';
  end if;

  -- Reject the entire operation if any supplied registration does not
  -- belong to the requested organization. This avoids silently applying
  -- only part of a batch supplied by the client.
  if exists (
    select 1
    from unnest(p_registration_ids) as requested(id)
    where not exists (
      select 1
      from public.registrations as r
      where r.id = requested.id
        and r.organization_id = p_organization_id
    )
  ) then
    raise exception 'Registration not found in organization';
  end if;

  update public.registrations as r
  set
    attendance_status = p_attendance_status,
    attendance_notes = nullif(trim(p_attendance_notes), ''),
    checked_in =
      p_attendance_status in ('checked_in', 'late_arrival'),
    checked_in_at =
      case
        when p_attendance_status in ('checked_in', 'late_arrival')
          then coalesce(r.checked_in_at, clock_timestamp())
        else null
      end,
    checked_in_by =
      case
        when p_attendance_status in ('checked_in', 'late_arrival')
          then coalesce(r.checked_in_by, v_user_id)
        else null
      end
  where r.organization_id = p_organization_id
    and r.id = any(p_registration_ids);

  get diagnostics v_updated_count = row_count;

  return v_updated_count;
end;
$$;

revoke all on function public.update_registration_attendance(
  uuid,
  uuid[],
  text,
  text
)
from public, anon;

grant execute on function public.update_registration_attendance(
  uuid,
  uuid[],
  text,
  text
)
to authenticated, service_role;
