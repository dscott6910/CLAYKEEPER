-- ============================================================
-- ClayKeeper
-- Idempotent Participant Self-Signup
--
-- Email confirmation / React lifecycle behavior may cause the
-- participant completion RPC to be called more than once.
--
-- If the authenticated user already has a participant record
-- for the requested organization, return that record rather
-- than treating the repeat request as an error.
-- ============================================================

create or replace function public.register_participant_account(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_preferred_name text default null,
  p_birth_date date default null,
  p_phone text default null
)
returns public.athletes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_auth_email text;
  v_existing_membership_active boolean;
  v_participant public.athletes;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;


  -- Use the authenticated account's email address.
  v_auth_email :=
    nullif(
      trim(
        coalesce(
          auth.jwt()->>'email',
          ''
        )
      ),
      ''
    );


  -- ----------------------------------------------------------
  -- Validate required participant information.
  -- ----------------------------------------------------------

  if nullif(trim(p_first_name), '') is null then
    raise exception 'First name is required';
  end if;

  if nullif(trim(p_last_name), '') is null then
    raise exception 'Last name is required';
  end if;


  -- ----------------------------------------------------------
  -- Organization must exist and be active.
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.organizations as o
    where o.id = p_organization_id
      and o.active = true
  ) then
    raise exception 'Organization not found or inactive';
  end if;


  -- ----------------------------------------------------------
  -- Idempotent completion.
  --
  -- Confirmation redirects, React lifecycle behavior, browser
  -- reloads, or network retries may call this function again
  -- after the participant was successfully created.
  --
  -- Return the existing organization-specific participant
  -- instead of reporting a false signup failure.
  -- ----------------------------------------------------------

  select a.*
  into v_participant
  from public.athletes as a
  where a.organization_id = p_organization_id
    and a.user_id = v_user_id;

  if found then
    return v_participant;
  end if;


  -- ----------------------------------------------------------
  -- Respect existing membership state.
  --
  -- An intentionally deactivated membership may NOT reactivate
  -- itself through participant self-registration.
  -- ----------------------------------------------------------

  select om.active
  into v_existing_membership_active
  from public.organization_members as om
  where om.organization_id = p_organization_id
    and om.user_id = v_user_id;

  if found and v_existing_membership_active = false then
    raise exception
      'Your membership in this organization is inactive';
  end if;


  -- ----------------------------------------------------------
  -- Create low-privilege membership only when none exists.
  --
  -- Existing legitimate owner/admin/coach/etc. roles are
  -- preserved and never downgraded.
  -- ----------------------------------------------------------

  if not found then
    insert into public.organization_members (
      organization_id,
      user_id,
      role,
      active
    )
    values (
      p_organization_id,
      v_user_id,
      'member',
      true
    );
  end if;


  -- ----------------------------------------------------------
  -- Create organization-specific participant record.
  --
  -- participant_number is omitted intentionally. The existing
  -- database trigger assigns YYYY-##### automatically.
  -- ----------------------------------------------------------

  insert into public.athletes (
    organization_id,
    user_id,
    first_name,
    last_name,
    preferred_name,
    birth_date,
    email,
    phone,
    active
  )
  values (
    p_organization_id,
    v_user_id,
    trim(p_first_name),
    trim(p_last_name),
    nullif(trim(p_preferred_name), ''),
    p_birth_date,
    v_auth_email,
    nullif(trim(p_phone), ''),
    true
  )
  returning *
  into v_participant;


  return v_participant;
end;
$$;


revoke all
on function public.register_participant_account(
  uuid,
  text,
  text,
  text,
  date,
  text
)
from public, anon;

grant execute
on function public.register_participant_account(
  uuid,
  text,
  text,
  text,
  date,
  text
)
to authenticated;


comment on function public.register_participant_account(
  uuid,
  text,
  text,
  text,
  date,
  text
)
is 'Creates or returns the authenticated user''s organization-specific participant profile without granting administrative privileges.';
