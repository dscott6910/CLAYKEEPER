-- ============================================================
-- ClayKeeper
-- Participant Self-Data RLS
--
-- Administrative / operational roles retain organization-wide
-- read access.
--
-- Ordinary member accounts may read only their own:
--   participant
--   registrations
--   registration shoot enrollments
--   squad assignments
--   digital scorecards
-- ============================================================


-- ------------------------------------------------------------
-- ATHLETES
-- ------------------------------------------------------------

drop policy if exists
  "Members can view organization athletes"
on public.athletes;

create policy
  "Authorized users can view athletes"
on public.athletes
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array[
      'owner',
      'admin',
      'coach',
      'scorekeeper'
    ]
  )
  or user_id = (select auth.uid())
);


-- ------------------------------------------------------------
-- REGISTRATIONS
-- ------------------------------------------------------------

drop policy if exists
  "Members can view organization registrations"
on public.registrations;

create policy
  "Authorized users can view registrations"
on public.registrations
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array[
      'owner',
      'admin',
      'coach',
      'scorekeeper'
    ]
  )
  or exists (
    select 1
    from public.athletes a
    where a.id = registrations.athlete_id
      and a.organization_id =
        registrations.organization_id
      and a.user_id = (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- REGISTRATION SHOOTS
-- ------------------------------------------------------------

drop policy if exists
  "Members can view registration shoot enrollments"
on public.registration_shoots;

create policy
  "Authorized users can view registration shoot enrollments"
on public.registration_shoots
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array[
      'owner',
      'admin',
      'coach',
      'scorekeeper'
    ]
  )
  or exists (
    select 1
    from public.registrations r
    join public.athletes a
      on a.id = r.athlete_id
     and a.organization_id = r.organization_id
    where r.id = registration_shoots.registration_id
      and r.organization_id =
        registration_shoots.organization_id
      and a.user_id = (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- SQUAD MEMBERS
-- ------------------------------------------------------------

drop policy if exists
  "Members can view squad assignments"
on public.squad_members;

create policy
  "Authorized users can view squad assignments"
on public.squad_members
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array[
      'owner',
      'admin',
      'coach',
      'scorekeeper'
    ]
  )
  or exists (
    select 1
    from public.registration_shoots rs
    join public.registrations r
      on r.id = rs.registration_id
     and r.organization_id = rs.organization_id
    join public.athletes a
      on a.id = r.athlete_id
     and a.organization_id = r.organization_id
    where rs.id = squad_members.registration_shoot_id
      and rs.organization_id =
        squad_members.organization_id
      and a.user_id = (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- DIGITAL SCORECARDS
-- ------------------------------------------------------------

drop policy if exists
  "digital_scorecards_members_select"
on public.digital_scorecards;

create policy
  "Authorized users can view digital scorecards"
on public.digital_scorecards
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array[
      'owner',
      'admin',
      'coach',
      'scorekeeper'
    ]
  )
  or exists (
    select 1
    from public.squad_members sm
    join public.registration_shoots rs
      on rs.id = sm.registration_shoot_id
     and rs.organization_id = sm.organization_id
    join public.registrations r
      on r.id = rs.registration_id
     and r.organization_id = rs.organization_id
    join public.athletes a
      on a.id = r.athlete_id
     and a.organization_id = r.organization_id
    where sm.id = digital_scorecards.squad_member_id
      and sm.organization_id =
        digital_scorecards.organization_id
      and a.user_id = (select auth.uid())
  )
);

