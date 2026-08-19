-- ============================================================
-- ClayKeeper
-- Coach Account Activation
--
-- Owner/admin creates an activation token for an existing
-- coach profile. The coach authenticates using the same email
-- stored on that coach record, then redeems the token.
--
-- Raw activation tokens are never stored in the database.
-- ============================================================


create table public.coach_account_invitations (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  coach_id uuid not null
    references public.coaches(id)
    on delete cascade,

  email text not null,

  token_hash text not null unique,

  expires_at timestamptz not null,

  used_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  constraint coach_account_invitation_email_not_blank
    check (length(trim(email)) > 0),

  constraint coach_account_invitation_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$')
);


create index coach_account_invitations_org_coach_idx
  on public.coach_account_invitations (
    organization_id,
    coach_id,
    created_at desc
  );


alter table public.coach_account_invitations
  enable row level security;


-- ------------------------------------------------------------
-- Owners/admins may inspect invitations for their organization.
-- ------------------------------------------------------------

create policy "Owners and admins can view coach invitations"
on public.coach_account_invitations
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);


-- ------------------------------------------------------------
-- Create an activation invitation.
--
-- The frontend generates a cryptographically random token and
-- sends only its SHA-256 hash to this function.
-- ------------------------------------------------------------

create or replace function public.create_coach_account_invitation(
  p_coach_id uuid,
  p_token_hash text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_email text;
  v_user_id uuid;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid activation token hash';
  end if;

  select
    c.organization_id,
    lower(trim(c.email)),
    c.user_id
  into
    v_organization_id,
    v_email,
    v_user_id
  from public.coaches c
  where c.id = p_coach_id
    and c.active = true;

  if not found then
    raise exception 'Coach not found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['owner', 'admin']
  ) then
    raise exception
      'Only an owner or administrator can activate coach accounts';
  end if;

  if v_email is null or v_email = '' then
    raise exception
      'The coach must have an email address before account activation';
  end if;

  if v_user_id is not null then
    raise exception
      'This coach already has a ClayKeeper account';
  end if;

  -- Invalidate previous unused invitations for this coach.
  update public.coach_account_invitations
  set used_at = now()
  where organization_id = v_organization_id
    and coach_id = p_coach_id
    and used_at is null;

  v_expires_at := now() + interval '7 days';

  insert into public.coach_account_invitations (
    organization_id,
    coach_id,
    email,
    token_hash,
    expires_at,
    created_by
  )
  values (
    v_organization_id,
    p_coach_id,
    v_email,
    p_token_hash,
    v_expires_at,
    auth.uid()
  );

  return v_expires_at;
end;
$$;


revoke all
on function public.create_coach_account_invitation(uuid, text)
from public;

grant execute
on function public.create_coach_account_invitation(uuid, text)
to authenticated;


-- ------------------------------------------------------------
-- Redeem an activation invitation.
--
-- Authentication must already exist.
-- Authenticated email must match the coach email.
-- Membership becomes coach.
-- Existing owner/admin roles are NEVER downgraded.
-- ------------------------------------------------------------

create or replace function public.redeem_coach_account_invitation(
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_auth_email text;
  v_invitation public.coach_account_invitations%rowtype;
  v_existing_role text;
  v_coach_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception
      'This coach activation link is invalid or has expired';
  end if;

  v_auth_email :=
    lower(trim(coalesce(auth.jwt() ->> 'email', '')));

  if v_auth_email = '' then
    raise exception 'Your account does not have an email address';
  end if;

  select *
  into v_invitation
  from public.coach_account_invitations
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception
      'This coach activation link is invalid or has expired';
  end if;

  if lower(trim(v_invitation.email)) <> v_auth_email then
    raise exception
      'Sign in using the email address that received this coach invitation';
  end if;

  select c.user_id
  into v_coach_user_id
  from public.coaches c
  where c.id = v_invitation.coach_id
    and c.organization_id = v_invitation.organization_id
    and c.active = true
  for update;

  if not found then
    raise exception 'Coach profile is no longer active';
  end if;

  if
    v_coach_user_id is not null
    and v_coach_user_id <> v_user_id
  then
    raise exception
      'This coach profile is already linked to another account';
  end if;

  select om.role
  into v_existing_role
  from public.organization_members om
  where om.organization_id = v_invitation.organization_id
    and om.user_id = v_user_id
  for update;

  if found then
    update public.organization_members
    set
      role = case
        when v_existing_role in ('owner', 'admin')
          then v_existing_role
        else 'coach'
      end,
      active = true,
      updated_at = now()
    where organization_id = v_invitation.organization_id
      and user_id = v_user_id;
  else
    insert into public.organization_members (
      organization_id,
      user_id,
      role,
      active
    )
    values (
      v_invitation.organization_id,
      v_user_id,
      'coach',
      true
    );
  end if;

  update public.coaches
  set
    user_id = v_user_id,
    updated_at = now()
  where id = v_invitation.coach_id
    and organization_id = v_invitation.organization_id;

  update public.coach_account_invitations
  set used_at = now()
  where id = v_invitation.id;

  return v_invitation.coach_id;
end;
$$;


revoke all
on function public.redeem_coach_account_invitation(text)
from public;

grant execute
on function public.redeem_coach_account_invitation(text)
to authenticated;


comment on table public.coach_account_invitations
is
  'One-time account activation invitations for existing ClayKeeper coach profiles.';

comment on function public.create_coach_account_invitation(uuid, text)
is
  'Allows an organization owner/admin to create a hashed one-time coach account activation invitation.';

comment on function public.redeem_coach_account_invitation(text)
is
  'Allows an authenticated user with the matching email to redeem a coach invitation and activate coach organization access.';
