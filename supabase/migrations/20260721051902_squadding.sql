-- ============================================================
-- ClayKeeper
-- Migration: Squadding
--
-- Creates:
--   squads
--   squad_members
--
-- Supports:
--   configurable squad capacity
--   trap posts
--   skeet houses and rotations
--   sporting clays courses and stations
--   bunker assignments
--   manual and automatic squadding
--   printable squad ordering
--   locked squads
--   organization-safe relationships
--   automatic assignment-status updates
--   row-level security
-- ============================================================


-- ============================================================
-- EXISTING TABLE: COMPOSITE KEY SUPPORT
-- ============================================================

-- Allows squad_members to verify that a registration-shoot
-- enrollment belongs to the same shoot and organization.

alter table public.registration_shoots
add constraint registration_shoots_id_shoot_organization_unique
unique (id, shoot_id, organization_id);


-- ============================================================
-- SQUADS
-- ============================================================

create table public.squads (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,
  shoot_id uuid not null,

  squad_number text not null,

  -- Optional human-readable label, such as:
  -- Squad 1, House 2-A, East Course Group 4, Flight B.
  name text,

  -- Discipline-aware assignment fields.
  house_number text,
  course_name text,
  station_name text,
  flight_name text,

  start_time time without time zone,

  capacity integer not null default 5,

  sort_order integer not null default 0,

  assignment_method text not null default 'manual',

  status text not null default 'open',

  is_locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid
    references auth.users(id)
    on delete set null,

  notes text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint squads_number_not_blank
    check (length(trim(squad_number)) > 0),

  constraint squads_name_not_blank
    check (
      name is null
      or length(trim(name)) > 0
    ),

  constraint squads_capacity_positive
    check (capacity > 0),

  constraint squads_sort_order_nonnegative
    check (sort_order >= 0),

  constraint squads_assignment_method_valid
    check (
      assignment_method in (
        'manual',
        'automatic',
        'imported'
      )
    ),

  constraint squads_status_valid
    check (
      status in (
        'open',
        'full',
        'ready',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  constraint squads_lock_consistent
    check (
      is_locked = true
      or (
        locked_at is null
        and locked_by is null
      )
    ),

  constraint squads_shoot_same_organization
    foreign key (shoot_id, organization_id)
    references public.shoots(id, organization_id)
    on delete cascade,

  constraint squads_id_shoot_organization_unique
    unique (id, shoot_id, organization_id),

  constraint squads_number_unique_per_shoot
    unique (shoot_id, squad_number)
);

comment on table public.squads
is 'Squads, groups, flights, or station assignments belonging to an individual shoot.';

comment on column public.squads.squad_number
is 'Human-readable squad identifier within the shoot, such as 1, 2, A1, or EAST-01.';

comment on column public.squads.house_number
is 'Optional skeet, trap, or bunker house identifier.';

comment on column public.squads.course_name
is 'Optional sporting clays course designation, such as East or West.';

comment on column public.squads.station_name
is 'Optional starting station, field, or rotation designation.';

comment on column public.squads.flight_name
is 'Optional flight, wave, or session designation.';

comment on column public.squads.capacity
is 'Maximum number of athletes allowed in this squad. This may vary by discipline and facility.';

comment on column public.squads.sort_order
is 'Controls display and print order independently of the squad number.';

comment on column public.squads.assignment_method
is 'Indicates whether the squad was created manually, automatically, or through an import.';

comment on column public.squads.is_locked
is 'Prevents squad membership changes after the squad has been finalized.';

create index squads_organization_shoot_idx
  on public.squads (
    organization_id,
    shoot_id
  );

create index squads_shoot_sort_idx
  on public.squads (
    shoot_id,
    sort_order,
    squad_number
  );

create index squads_shoot_status_idx
  on public.squads (
    shoot_id,
    status
  );

create index squads_shoot_start_time_idx
  on public.squads (
    shoot_id,
    start_time
  )
  where start_time is not null;

create index squads_house_idx
  on public.squads (
    shoot_id,
    house_number
  )
  where house_number is not null;

create index squads_course_idx
  on public.squads (
    shoot_id,
    course_name
  )
  where course_name is not null;

create trigger squads_set_updated_at
before update on public.squads
for each row
execute function public.set_updated_at();


-- ============================================================
-- SQUAD MEMBERS
-- ============================================================

create table public.squad_members (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,
  shoot_id uuid not null,

  squad_id uuid not null,
  registration_shoot_id uuid not null,

  -- Position is the athlete order within the squad.
  -- For trap this normally represents posts 1 through 5.
  position integer not null,

  -- Optional discipline-specific position label.
  -- Examples: Post 1, Station A, Rotation 2.
  position_label text,

  assignment_method text not null default 'manual',

  status text not null default 'assigned',

  is_squad_leader boolean not null default false,

  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid
    references auth.users(id)
    on delete set null,

  notes text,

  assigned_by uuid
    references auth.users(id)
    on delete set null,

  assigned_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint squad_members_position_positive
    check (position > 0),

  constraint squad_members_position_label_not_blank
    check (
      position_label is null
      or length(trim(position_label)) > 0
    ),

  constraint squad_members_assignment_method_valid
    check (
      assignment_method in (
        'manual',
        'automatic',
        'imported'
      )
    ),

  constraint squad_members_status_valid
    check (
      status in (
        'assigned',
        'confirmed',
        'withdrawn',
        'no_show',
        'completed',
        'disqualified'
      )
    ),

  constraint squad_members_checkin_consistent
    check (
      checked_in = true
      or (
        checked_in_at is null
        and checked_in_by is null
      )
    ),

  constraint squad_members_squad_same_shoot_org
    foreign key (
      squad_id,
      shoot_id,
      organization_id
    )
    references public.squads (
      id,
      shoot_id,
      organization_id
    )
    on delete cascade,

  constraint squad_members_registration_same_shoot_org
    foreign key (
      registration_shoot_id,
      shoot_id,
      organization_id
    )
    references public.registration_shoots (
      id,
      shoot_id,
      organization_id
    )
    on delete cascade,

  constraint squad_members_position_unique
    unique (squad_id, position),

  constraint squad_members_one_squad_per_shoot_entry
    unique (registration_shoot_id)
);

comment on table public.squad_members
is 'Assignments of registered athletes to squad positions for an individual shoot.';

comment on column public.squad_members.registration_shoot_id
is 'The athlete shoot enrollment being assigned to the squad.';

comment on column public.squad_members.position
is 'Numeric order within the squad. For American Trap this normally corresponds to posts 1 through 5.';

comment on column public.squad_members.position_label
is 'Optional display label for discipline-specific assignments, such as Post 1 or Station A.';

comment on column public.squad_members.assignment_method
is 'Indicates whether the athlete assignment was manual, automatic, or imported.';

comment on column public.squad_members.is_squad_leader
is 'Identifies an optional squad captain or primary contact.';

create index squad_members_organization_idx
  on public.squad_members (
    organization_id
  );

create index squad_members_shoot_idx
  on public.squad_members (
    shoot_id
  );

create index squad_members_squad_position_idx
  on public.squad_members (
    squad_id,
    position
  );

create index squad_members_registration_shoot_idx
  on public.squad_members (
    registration_shoot_id
  );

create index squad_members_shoot_status_idx
  on public.squad_members (
    shoot_id,
    status
  );

create index squad_members_shoot_checkin_idx
  on public.squad_members (
    shoot_id,
    checked_in
  );

create unique index squad_members_one_leader_per_squad_idx
  on public.squad_members (
    squad_id
  )
  where is_squad_leader = true
    and status not in ('withdrawn', 'no_show');

create trigger squad_members_set_updated_at
before update on public.squad_members
for each row
execute function public.set_updated_at();


-- ============================================================
-- DEFAULT SQUAD CAPACITY
-- ============================================================

-- When capacity is not explicitly provided, copy the shoot's
-- configured squad size. If the shoot has no squad size, use 5.

create or replace function public.set_squad_default_capacity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  configured_capacity integer;
begin
  if new.capacity is null then
    select s.squad_size
      into configured_capacity
    from public.shoots as s
    where s.id = new.shoot_id
      and s.organization_id = new.organization_id;

    new.capacity := coalesce(configured_capacity, 5);
  end if;

  return new;
end;
$$;

comment on function public.set_squad_default_capacity()
is 'Copies the shoot squad-size setting into a new squad when capacity is not explicitly supplied.';

create trigger squads_set_default_capacity
before insert on public.squads
for each row
execute function public.set_squad_default_capacity();


-- ============================================================
-- SQUAD LOCK TIMESTAMPS
-- ============================================================

create or replace function public.set_squad_lock_timestamp()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_locked = true
     and old.is_locked = false
     and new.locked_at is null then
    new.locked_at := now();
  end if;

  if new.is_locked = false then
    new.locked_at := null;
    new.locked_by := null;
  end if;

  return new;
end;
$$;

create trigger squads_set_lock_timestamp
before update on public.squads
for each row
execute function public.set_squad_lock_timestamp();


-- ============================================================
-- SQUAD MEMBER CHECK-IN TIMESTAMPS
-- ============================================================

create or replace function public.set_squad_member_checkin_timestamp()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.checked_in = true
     and old.checked_in = false
     and new.checked_in_at is null then
    new.checked_in_at := now();
  end if;

  if new.checked_in = false then
    new.checked_in_at := null;
    new.checked_in_by := null;
  end if;

  return new;
end;
$$;

create trigger squad_members_set_checkin_timestamp
before update on public.squad_members
for each row
execute function public.set_squad_member_checkin_timestamp();


-- ============================================================
-- LOCK AND CAPACITY ENFORCEMENT
-- ============================================================

create or replace function public.validate_squad_member_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_squad public.squads%rowtype;
  active_member_count integer;
begin
  select *
    into selected_squad
  from public.squads
  where id = new.squad_id
    and shoot_id = new.shoot_id
    and organization_id = new.organization_id
  for update;

  if not found then
    raise exception 'The selected squad does not exist for this shoot.';
  end if;

  if selected_squad.is_locked then
    raise exception 'This squad is locked and cannot be modified.';
  end if;

  if new.position > selected_squad.capacity then
    raise exception
      'Position % exceeds the squad capacity of %.',
      new.position,
      selected_squad.capacity;
  end if;

  select count(*)
    into active_member_count
  from public.squad_members
  where squad_id = new.squad_id
    and status not in ('withdrawn', 'no_show')
    and (
      tg_op = 'INSERT'
      or id <> new.id
    );

  if new.status not in ('withdrawn', 'no_show')
     and active_member_count >= selected_squad.capacity then
    raise exception
      'This squad is already at its capacity of %.',
      selected_squad.capacity;
  end if;

  return new;
end;
$$;

comment on function public.validate_squad_member_assignment()
is 'Prevents assignments to locked squads and enforces squad capacity and position limits.';

create trigger squad_members_validate_assignment
before insert or update on public.squad_members
for each row
execute function public.validate_squad_member_assignment();


-- Prevent deletion from a locked squad.

create or replace function public.prevent_locked_squad_member_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  squad_locked boolean;
begin
  select is_locked
    into squad_locked
  from public.squads
  where id = old.squad_id;

  if coalesce(squad_locked, false) then
    raise exception 'This squad is locked and cannot be modified.';
  end if;

  return old;
end;
$$;

create trigger squad_members_prevent_locked_delete
before delete on public.squad_members
for each row
execute function public.prevent_locked_squad_member_delete();


-- ============================================================
-- AUTOMATIC SQUAD STATUS
-- ============================================================

create or replace function public.refresh_squad_status(
  target_squad_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  member_count integer;
  squad_capacity integer;
  current_status text;
begin
  select capacity, status
    into squad_capacity, current_status
  from public.squads
  where id = target_squad_id;

  if not found then
    return;
  end if;

  -- Do not overwrite competition workflow statuses.
  if current_status in (
    'ready',
    'in_progress',
    'completed',
    'cancelled'
  ) then
    return;
  end if;

  select count(*)
    into member_count
  from public.squad_members
  where squad_id = target_squad_id
    and status not in ('withdrawn', 'no_show');

  update public.squads
  set status =
    case
      when member_count >= squad_capacity then 'full'
      else 'open'
    end
  where id = target_squad_id;
end;
$$;

comment on function public.refresh_squad_status(uuid)
is 'Updates a squad to open or full based on its active member count and configured capacity.';


create or replace function public.sync_squad_status_after_member_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_squad_status(old.squad_id);
    return old;
  end if;

  perform public.refresh_squad_status(new.squad_id);

  if tg_op = 'UPDATE'
     and old.squad_id is distinct from new.squad_id then
    perform public.refresh_squad_status(old.squad_id);
  end if;

  return new;
end;
$$;

create trigger squad_members_sync_squad_status
after insert or update or delete on public.squad_members
for each row
execute function public.sync_squad_status_after_member_change();


-- ============================================================
-- REGISTRATION SHOOT ASSIGNMENT STATUS
-- ============================================================

create or replace function public.sync_registration_squad_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_registration_shoot_id uuid;
  has_active_assignment boolean;
begin
  target_registration_shoot_id :=
    case
      when tg_op = 'DELETE' then old.registration_shoot_id
      else new.registration_shoot_id
    end;

  select exists (
    select 1
    from public.squad_members
    where registration_shoot_id = target_registration_shoot_id
      and status not in ('withdrawn', 'no_show')
  )
  into has_active_assignment;

  update public.registration_shoots
  set squad_assignment_status =
    case
      when has_active_assignment then 'assigned'
      else 'unassigned'
    end
  where id = target_registration_shoot_id
    and squad_assignment_status <> 'not_required';

  if tg_op = 'UPDATE'
     and old.registration_shoot_id
         is distinct from new.registration_shoot_id then

    select exists (
      select 1
      from public.squad_members
      where registration_shoot_id = old.registration_shoot_id
        and status not in ('withdrawn', 'no_show')
    )
    into has_active_assignment;

    update public.registration_shoots
    set squad_assignment_status =
      case
        when has_active_assignment then 'assigned'
        else 'unassigned'
      end
    where id = old.registration_shoot_id
      and squad_assignment_status <> 'not_required';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.sync_registration_squad_status()
is 'Keeps registration_shoots.squad_assignment_status synchronized with active squad assignments.';

create trigger squad_members_sync_registration_status
after insert or update or delete on public.squad_members
for each row
execute function public.sync_registration_squad_status();


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.squads enable row level security;
alter table public.squad_members enable row level security;


-- ============================================================
-- SQUADS POLICIES
-- ============================================================

create policy "Members can view organization squads"
on public.squads
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create squads"
on public.squads
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update squads"
on public.squads
for update
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
)
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners and admins can delete squads"
on public.squads
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ============================================================
-- SQUAD MEMBERS POLICIES
-- ============================================================

create policy "Members can view squad assignments"
on public.squad_members
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create squad assignments"
on public.squad_members
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update squad assignments"
on public.squad_members
for update
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
)
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners and admins can delete squad assignments"
on public.squad_members
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);