-- Registration refund metadata is financial data and may only be changed
-- by organization owners and administrators.
--
-- This RPC preserves the existing Check-In Center refund behavior while
-- moving the write behind a server-side authorization boundary.

create or replace function public.update_registration_refund(
  p_organization_id uuid,
  p_registration_id uuid,
  p_refund_status text,
  p_refund_amount numeric,
  p_refund_reason text default null,
  p_refund_notes text default null
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
    array['owner', 'admin']
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if p_refund_status not in (
    'not_applicable',
    'pending_review',
    'no_refund',
    'partial_refund',
    'full_refund_due',
    'refunded'
  ) then
    raise exception 'Invalid refund status';
  end if;

  if p_refund_amount is null then
    raise exception 'Refund amount is required';
  end if;

  if not exists (
    select 1
    from public.registrations as r
    where r.id = p_registration_id
      and r.organization_id = p_organization_id
  ) then
    raise exception 'Registration not found in organization';
  end if;

  update public.registrations as r
  set
    refund_status = p_refund_status,
    refund_amount = greatest(0::numeric, p_refund_amount),
    refund_reason = nullif(trim(p_refund_reason), ''),
    refund_notes = nullif(trim(p_refund_notes), ''),
    refund_processed_at =
      case
        when p_refund_status = 'refunded'
          then clock_timestamp()
        else null
      end,
    refund_processed_by =
      case
        when p_refund_status = 'refunded'
          then v_user_id
        else null
      end
  where r.id = p_registration_id
    and r.organization_id = p_organization_id;

  get diagnostics v_updated_count = row_count;

  return v_updated_count;
end;
$$;

revoke all on function public.update_registration_refund(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text
)
from public, anon;

grant execute on function public.update_registration_refund(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text
)
to authenticated, service_role;
