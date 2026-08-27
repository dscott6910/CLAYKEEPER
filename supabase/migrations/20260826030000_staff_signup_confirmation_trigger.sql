-- ClayKeeper: create pending staff access requests after email confirmation.
--
-- Staff signup details are stored in auth user metadata before email
-- confirmation. This trigger makes the database create the pending
-- access request as soon as the user's email is confirmed, even if the
-- browser does not return to the staff signup page.

create or replace function public.create_staff_access_request_from_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_signup jsonb;
  v_organization_id text;
  v_requested_role text;
  v_first_name text;
  v_last_name text;
  v_phone text;
  v_message text;
begin
  v_signup := new.raw_user_meta_data->'staff_signup';

  if v_signup is null
     or jsonb_typeof(v_signup) <> 'object'
     or new.email_confirmed_at is null then
    return new;
  end if;

  v_organization_id := nullif(trim(v_signup->>'organizationId'), '');
  v_requested_role := nullif(trim(v_signup->>'requestedRole'), '');
  v_first_name := nullif(trim(v_signup->>'firstName'), '');
  v_last_name := nullif(trim(v_signup->>'lastName'), '');
  v_phone := nullif(trim(v_signup->>'phone'), '');
  v_message := nullif(trim(v_signup->>'message'), '');

  if v_organization_id is null
     or v_organization_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_requested_role not in ('coach','scorekeeper','admin','volunteer')
     or v_first_name is null
     or v_last_name is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.organizations as o
    where o.id = v_organization_id::uuid
      and o.active = true
  ) then
    return new;
  end if;

  if exists (
    select 1
    from public.organization_members as om
    where om.organization_id = v_organization_id::uuid
      and om.user_id = new.id
      and om.active = true
  ) then
    return new;
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
    v_organization_id::uuid,
    new.id,
    v_requested_role,
    v_first_name,
    v_last_name,
    nullif(trim(new.email), ''),
    v_phone,
    v_message,
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
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists auth_users_create_staff_access_request
on auth.users;

create trigger auth_users_create_staff_access_request
after insert or update of email_confirmed_at, raw_user_meta_data
on auth.users
for each row
execute function public.create_staff_access_request_from_auth_metadata();

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
select
  (signup.metadata->>'organizationId')::uuid,
  users.id,
  signup.metadata->>'requestedRole',
  trim(signup.metadata->>'firstName'),
  trim(signup.metadata->>'lastName'),
  nullif(trim(users.email), ''),
  nullif(trim(signup.metadata->>'phone'), ''),
  nullif(trim(signup.metadata->>'message'), ''),
  'pending'
from auth.users as users
cross join lateral (
  select users.raw_user_meta_data->'staff_signup' as metadata
) as signup
where users.email_confirmed_at is not null
  and signup.metadata is not null
  and jsonb_typeof(signup.metadata) = 'object'
  and nullif(trim(signup.metadata->>'organizationId'), '') is not null
  and (signup.metadata->>'organizationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and signup.metadata->>'requestedRole' in (
    'coach',
    'scorekeeper',
    'admin',
    'volunteer'
  )
  and nullif(trim(signup.metadata->>'firstName'), '') is not null
  and nullif(trim(signup.metadata->>'lastName'), '') is not null
  and exists (
    select 1
    from public.organizations as o
    where o.id = (signup.metadata->>'organizationId')::uuid
      and o.active = true
  )
  and not exists (
    select 1
    from public.organization_members as om
    where om.organization_id =
      (signup.metadata->>'organizationId')::uuid
      and om.user_id = users.id
      and om.active = true
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
  updated_at = now();

revoke all
on function public.create_staff_access_request_from_auth_metadata()
from public, anon, authenticated;

comment on function public.create_staff_access_request_from_auth_metadata()
is 'Creates a pending staff access request from Supabase Auth metadata after email confirmation.';
