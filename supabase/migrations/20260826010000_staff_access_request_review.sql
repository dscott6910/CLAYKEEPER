-- ClayKeeper: owner/admin review workflow for staff access requests.
--
-- Approving a request grants the requested organization role. Volunteer
-- requests are granted as the existing low-privilege member role.

grant select on public.organization_access_requests to authenticated;

create or replace function public.approve_organization_access_request(
  p_request_id uuid,
  p_approved_role text default null
)
returns public.organization_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_request public.organization_access_requests;
  v_role text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_request
  from public.organization_access_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Access request not found';
  end if;

  if not public.has_organization_role(
    v_request.organization_id,
    array['owner', 'admin']
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This access request has already been reviewed';
  end if;

  v_role := coalesce(
    nullif(trim(p_approved_role), ''),
    case
      when v_request.requested_role = 'volunteer' then 'member'
      else v_request.requested_role
    end
  );

  if v_role not in ('admin', 'coach', 'scorekeeper', 'member') then
    raise exception 'Approved role is invalid';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    active
  )
  values (
    v_request.organization_id,
    v_request.user_id,
    v_role,
    true
  )
  on conflict (organization_id, user_id)
  do update set
    role = excluded.role,
    active = true,
    updated_at = now();

  update public.organization_access_requests
  set
    status = 'approved',
    reviewed_by = v_user_id,
    reviewed_at = now()
  where id = p_request_id
  returning *
  into v_request;

  return v_request;
end;
$$;

create or replace function public.decline_organization_access_request(
  p_request_id uuid
)
returns public.organization_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_request public.organization_access_requests;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_request
  from public.organization_access_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Access request not found';
  end if;

  if not public.has_organization_role(
    v_request.organization_id,
    array['owner', 'admin']
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This access request has already been reviewed';
  end if;

  update public.organization_access_requests
  set
    status = 'declined',
    reviewed_by = v_user_id,
    reviewed_at = now()
  where id = p_request_id
  returning *
  into v_request;

  return v_request;
end;
$$;

revoke all on function public.approve_organization_access_request(
  uuid,
  text
) from public, anon;

grant execute on function public.approve_organization_access_request(
  uuid,
  text
) to authenticated;

revoke all on function public.decline_organization_access_request(
  uuid
) from public, anon;

grant execute on function public.decline_organization_access_request(
  uuid
) to authenticated;

comment on function public.approve_organization_access_request(
  uuid,
  text
)
is 'Allows an organization owner or administrator to approve a pending staff access request and grant an organization membership role.';

comment on function public.decline_organization_access_request(uuid)
is 'Allows an organization owner or administrator to decline a pending staff access request.';
