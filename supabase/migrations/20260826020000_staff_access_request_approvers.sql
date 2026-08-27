-- ClayKeeper: restrict staff access request review to owners and selected admins.
--
-- Organization owners can choose which existing admins may approve or
-- decline staff access requests. Owners always retain review access.

create table if not exists public.organization_access_request_reviewers (
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  primary key (organization_id, user_id)
);

comment on table public.organization_access_request_reviewers
is 'Organization admins selected by an owner to approve or decline staff access requests.';

alter table public.organization_access_request_reviewers
  enable row level security;

drop policy if exists "Owners and admins can view staff request reviewers"
on public.organization_access_request_reviewers;

create policy "Owners and admins can view staff request reviewers"
on public.organization_access_request_reviewers
for select
to authenticated
using (
  public.has_organization_role(organization_id, array['owner','admin'])
);

drop policy if exists "Owners can add staff request reviewers"
on public.organization_access_request_reviewers;

create policy "Owners can add staff request reviewers"
on public.organization_access_request_reviewers
for insert
to authenticated
with check (
  public.has_organization_role(organization_id, array['owner'])
);

drop policy if exists "Owners can remove staff request reviewers"
on public.organization_access_request_reviewers;

create policy "Owners can remove staff request reviewers"
on public.organization_access_request_reviewers
for delete
to authenticated
using (
  public.has_organization_role(organization_id, array['owner'])
);

insert into public.organization_access_request_reviewers (
  organization_id,
  user_id
)
select
  om.organization_id,
  om.user_id
from public.organization_members as om
where om.active = true
  and om.role = 'admin'
on conflict (organization_id, user_id)
do nothing;

create or replace function public.can_review_organization_access_requests(
  requested_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_organization_role(
      requested_organization_id,
      array['owner']
    )
    or exists (
      select 1
      from public.organization_members as om
      join public.organization_access_request_reviewers as reviewer
        on reviewer.organization_id = om.organization_id
       and reviewer.user_id = om.user_id
      where om.organization_id = requested_organization_id
        and om.user_id = auth.uid()
        and om.active = true
        and om.role = 'admin'
    );
$$;

comment on function public.can_review_organization_access_requests(uuid)
is 'Returns true when the authenticated user is an organization owner or an admin selected to review staff access requests.';

create or replace function public.list_staff_access_request_reviewers(
  p_organization_id uuid
)
returns table (
  user_id uuid,
  email text,
  role text,
  is_reviewer boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin']
  ) then
    raise exception 'Only an owner or administrator can view staff request approvers';
  end if;

  return query
  select
    om.user_id,
    coalesce(au.email, '')::text as email,
    om.role,
    reviewer.user_id is not null as is_reviewer
  from public.organization_members as om
  join auth.users as au
    on au.id = om.user_id
  left join public.organization_access_request_reviewers as reviewer
    on reviewer.organization_id = om.organization_id
   and reviewer.user_id = om.user_id
  where om.organization_id = p_organization_id
    and om.active = true
    and om.role = 'admin'
  order by lower(coalesce(au.email, '')), om.created_at;
end;
$$;

create or replace function public.set_staff_access_request_reviewer(
  p_organization_id uuid,
  p_user_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_organization_role(
    p_organization_id,
    array['owner']
  ) then
    raise exception 'Only an organization owner can manage staff request approvers';
  end if;

  if not exists (
    select 1
    from public.organization_members as om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.active = true
      and om.role = 'admin'
  ) then
    raise exception 'Only active organization admins can be staff request approvers';
  end if;

  if p_enabled then
    insert into public.organization_access_request_reviewers (
      organization_id,
      user_id,
      created_by
    )
    values (
      p_organization_id,
      p_user_id,
      auth.uid()
    )
    on conflict (organization_id, user_id)
    do nothing;
  else
    delete from public.organization_access_request_reviewers
    where organization_id = p_organization_id
      and user_id = p_user_id;
  end if;
end;
$$;

drop policy if exists "Owners and admins can view organization access requests"
on public.organization_access_requests;

create policy "Selected reviewers can view organization access requests"
on public.organization_access_requests
for select
to authenticated
using (
  public.can_review_organization_access_requests(organization_id)
);

drop policy if exists "Owners and admins can update organization access requests"
on public.organization_access_requests;

create policy "Selected reviewers can update organization access requests"
on public.organization_access_requests
for update
to authenticated
using (
  public.can_review_organization_access_requests(organization_id)
)
with check (
  public.can_review_organization_access_requests(organization_id)
);

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

  if not public.can_review_organization_access_requests(
    v_request.organization_id
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

  if not public.can_review_organization_access_requests(
    v_request.organization_id
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

revoke all
on function public.can_review_organization_access_requests(uuid)
from public, anon;

grant execute
on function public.can_review_organization_access_requests(uuid)
to authenticated;

revoke all
on function public.list_staff_access_request_reviewers(uuid)
from public, anon;

grant execute
on function public.list_staff_access_request_reviewers(uuid)
to authenticated;

revoke all
on function public.set_staff_access_request_reviewer(uuid, uuid, boolean)
from public, anon;

grant execute
on function public.set_staff_access_request_reviewer(uuid, uuid, boolean)
to authenticated;
