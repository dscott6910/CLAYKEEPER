-- ClayKeeper: public organization staff/volunteer access requests.
--
-- Allows coaches, scorekeepers, admins, and volunteers to create an
-- authenticated request without granting permissions automatically.

create table if not exists public.organization_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_role text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  message text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_access_requests_role_valid
    check (requested_role in ('coach','scorekeeper','admin','volunteer')),
  constraint organization_access_requests_status_valid
    check (status in ('pending','approved','declined','cancelled')),
  constraint organization_access_requests_first_name_not_blank
    check (length(trim(first_name)) > 0),
  constraint organization_access_requests_last_name_not_blank
    check (length(trim(last_name)) > 0)
);

create unique index if not exists organization_access_requests_pending_unique_idx
on public.organization_access_requests (organization_id, user_id)
where status = 'pending';

create index if not exists organization_access_requests_org_status_idx
on public.organization_access_requests (organization_id, status, created_at desc);

create trigger organization_access_requests_set_updated_at
before update on public.organization_access_requests
for each row
execute function public.set_updated_at();

alter table public.organization_access_requests enable row level security;

drop policy if exists "Users can view their own access requests" on public.organization_access_requests;
create policy "Users can view their own access requests"
on public.organization_access_requests
for select
using (user_id = auth.uid());

drop policy if exists "Owners and admins can view organization access requests" on public.organization_access_requests;
create policy "Owners and admins can view organization access requests"
on public.organization_access_requests
for select
using (public.has_organization_role(organization_id, array['owner','admin']));

drop policy if exists "Owners and admins can update organization access requests" on public.organization_access_requests;
create policy "Owners and admins can update organization access requests"
on public.organization_access_requests
for update
using (public.has_organization_role(organization_id, array['owner','admin']))
with check (public.has_organization_role(organization_id, array['owner','admin']));

create or replace function public.request_organization_access(
  p_organization_id uuid,
  p_requested_role text,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_message text default null
)
returns public.organization_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_auth_email text;
  v_request public.organization_access_requests;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_auth_email := nullif(trim(coalesce(auth.jwt()->>'email', '')), '');

  if p_requested_role not in ('coach','scorekeeper','admin','volunteer') then
    raise exception 'Requested role is invalid';
  end if;

  if nullif(trim(p_first_name), '') is null then
    raise exception 'First name is required';
  end if;

  if nullif(trim(p_last_name), '') is null then
    raise exception 'Last name is required';
  end if;

  if not exists (
    select 1
    from public.organizations as o
    where o.id = p_organization_id
      and o.active = true
  ) then
    raise exception 'Organization not found or inactive';
  end if;

  if exists (
    select 1
    from public.organization_members as om
    where om.organization_id = p_organization_id
      and om.user_id = v_user_id
      and om.active = true
  ) then
    raise exception 'This account already has access to this organization';
  end if;

  insert into public.organization_access_requests (
    organization_id,
    user_id,
    requested_role,
    first_name,
    last_name,
    email,
    phone,
    message,
    status
  )
  values (
    p_organization_id,
    v_user_id,
    p_requested_role,
    trim(p_first_name),
    trim(p_last_name),
    v_auth_email,
    nullif(trim(p_phone), ''),
    nullif(trim(p_message), ''),
    'pending'
  )
  on conflict (organization_id, user_id)
  where status = 'pending'
  do update set
    requested_role = excluded.requested_role,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    phone = excluded.phone,
    message = excluded.message,
    updated_at = now()
  returning *
  into v_request;

  return v_request;
end;
$$;

revoke all on function public.request_organization_access(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon;

grant execute on function public.request_organization_access(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;

comment on table public.organization_access_requests
is 'Pending public requests for coach, scorekeeper, admin, or volunteer access. Requests do not grant permissions automatically.';

comment on function public.request_organization_access(
  uuid,
  text,
  text,
  text,
  text,
  text
)
is 'Creates or updates the authenticated user''s pending organization staff/volunteer access request without granting permissions.';
