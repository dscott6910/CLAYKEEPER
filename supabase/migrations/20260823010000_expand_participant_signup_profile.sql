-- ClayKeeper: expanded youth participant self-signup profile.
--
-- Keeps the existing safe self-registration behavior while allowing
-- the public youth shooter form to store the profile fields already
-- present on public.athletes.

create or replace function public.register_participant_account(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_preferred_name text default null,
  p_birth_date date default null,
  p_phone text default null,
  p_gender text default null,
  p_graduation_year integer default null,
  p_cyssa_number text default null,
  p_ata_number text default null,
  p_nssa_number text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_notes text default null
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

  v_auth_email :=
    nullif(trim(coalesce(auth.jwt()->>'email', '')), '');

  if nullif(trim(p_first_name), '') is null then
    raise exception 'First name is required';
  end if;

  if nullif(trim(p_last_name), '') is null then
    raise exception 'Last name is required';
  end if;

  if p_graduation_year is not null
     and (p_graduation_year < 1900 or p_graduation_year > 2200) then
    raise exception 'Graduation year is invalid';
  end if;

  if not exists (
    select 1
    from public.organizations as o
    where o.id = p_organization_id
      and o.active = true
  ) then
    raise exception 'Organization not found or inactive';
  end if;

  select a.*
  into v_participant
  from public.athletes as a
  where a.organization_id = p_organization_id
    and a.user_id = v_user_id;

  if found then
    return v_participant;
  end if;

  select om.active
  into v_existing_membership_active
  from public.organization_members as om
  where om.organization_id = p_organization_id
    and om.user_id = v_user_id;

  if found and v_existing_membership_active = false then
    raise exception
      'Your membership in this organization is inactive';
  end if;

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

  insert into public.athletes (
    organization_id,
    user_id,
    first_name,
    last_name,
    preferred_name,
    birth_date,
    gender,
    graduation_year,
    cyssa_number,
    ata_number,
    nssa_number,
    email,
    phone,
    emergency_contact_name,
    emergency_contact_phone,
    notes,
    active
  )
  values (
    p_organization_id,
    v_user_id,
    trim(p_first_name),
    trim(p_last_name),
    nullif(trim(p_preferred_name), ''),
    p_birth_date,
    nullif(trim(p_gender), ''),
    p_graduation_year,
    nullif(trim(p_cyssa_number), ''),
    nullif(trim(p_ata_number), ''),
    nullif(trim(p_nssa_number), ''),
    v_auth_email,
    nullif(trim(p_phone), ''),
    nullif(trim(p_emergency_contact_name), ''),
    nullif(trim(p_emergency_contact_phone), ''),
    nullif(trim(p_notes), ''),
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
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
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
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

comment on function public.register_participant_account(
  uuid,
  text,
  text,
  text,
  date,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
)
is 'Creates or returns the authenticated user''s organization-specific participant profile from the expanded youth signup form without granting administrative privileges.';
