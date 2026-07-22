-- ============================================================
-- ClayKeeper
-- Migration: Registrations
--
-- Creates:
--   registrations
--   registration_shoots
--
-- Design:
--   A registration enrolls one athlete in an event.
--   A registration may include one or more shoots.
--
--   Team and class values are preserved as snapshots so that
--   historical reports remain accurate even when an athlete
--   changes teams or classes later.
--
-- Includes:
--   manual and imported registrations
--   payment tracking
--   check-in tracking
--   waitlist support
--   fee snapshots
--   organization-safe foreign keys
--   indexes
--   triggers
--   row-level security
-- ============================================================


-- ============================================================
-- EXISTING TABLES: COMPOSITE KEY SUPPORT
-- ============================================================

-- Allows registration_shoots to guarantee that its shoot
-- belongs to the same event and organization as its parent
-- registration.

alter table public.shoots
add constraint shoots_id_event_organization_unique
unique (id, event_id, organization_id);


-- ============================================================
-- REGISTRATIONS
-- ============================================================

create table public.registrations (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,

  event_id uuid not null,
  athlete_id uuid not null,

  -- Historical snapshots recorded at registration time.
  team_id uuid,
  class_id uuid,

  registration_number text,

  status text not null default 'registered',
  registration_source text not null default 'manual',

  external_id text,
  external_source text,

  registered_at timestamptz not null default now(),

  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid
    references auth.users(id)
    on delete set null,

  payment_status text not null default 'unpaid',
  payment_method text,

  registration_fee numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  amount_paid numeric(10, 2) not null default 0,

  payment_reference text,
  paid_at timestamptz,

  waiver_received boolean not null default false,
  waiver_received_at timestamptz,

  notes text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registrations_status_valid
    check (
      status in (
        'pending',
        'registered',
        'waitlisted',
        'withdrawn',
        'cancelled',
        'completed',
        'disqualified'
      )
    ),

  constraint registrations_source_valid
    check (
      registration_source in (
        'manual',
        'online',
        'activenet',
        'spreadsheet',
        'csv',
        'api',
        'historical_import'
      )
    ),

  constraint registrations_payment_status_valid
    check (
      payment_status in (
        'unpaid',
        'partial',
        'paid',
        'refunded',
        'partially_refunded',
        'waived',
        'not_required'
      )
    ),

  constraint registrations_payment_method_valid
    check (
      payment_method is null
      or payment_method in (
        'cash',
        'check',
        'credit_card',
        'debit_card',
        'ach',
        'online',
        'complimentary',
        'other'
      )
    ),

  constraint registrations_registration_fee_nonnegative
    check (registration_fee >= 0),

  constraint registrations_discount_amount_nonnegative
    check (discount_amount >= 0),

  constraint registrations_amount_paid_nonnegative
    check (amount_paid >= 0),

  constraint registrations_discount_not_greater_than_fee
    check (discount_amount <= registration_fee),

  constraint registrations_checkin_consistent
    check (
      checked_in = true
      or (
        checked_in_at is null
        and checked_in_by is null
      )
    ),

  constraint registrations_waiver_consistent
    check (
      waiver_received = true
      or waiver_received_at is null
    ),

  constraint registrations_event_same_organization
    foreign key (event_id, organization_id)
    references public.events(id, organization_id)
    on delete cascade,

  constraint registrations_athlete_same_organization
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete restrict,

  constraint registrations_team_same_organization
    foreign key (team_id, organization_id)
    references public.teams(id, organization_id)
    on delete restrict,

  constraint registrations_class_same_organization
    foreign key (class_id, organization_id)
    references public.classes(id, organization_id)
    on delete restrict,

  constraint registrations_id_event_organization_unique
    unique (id, event_id, organization_id),

  constraint registrations_one_athlete_per_event
    unique (event_id, athlete_id)
);

comment on table public.registrations
is 'Event-level registrations. One athlete may have one registration per event and may enroll in multiple shoots through registration_shoots.';

comment on column public.registrations.team_id
is 'Team snapshot recorded when the athlete registered. This preserves historical team affiliation.';

comment on column public.registrations.class_id
is 'Competition class snapshot recorded when the athlete registered. This preserves historical class reporting.';

comment on column public.registrations.registration_number
is 'Optional human-readable registration or confirmation number.';

comment on column public.registrations.registration_source
is 'How the registration entered ClayKeeper, such as manual, online, ActiveNet, spreadsheet, CSV, API, or historical import.';

comment on column public.registrations.external_id
is 'Registration identifier supplied by an external system.';

comment on column public.registrations.registration_fee
is 'Optional event-level fee that is separate from individual shoot entry fees.';

comment on column public.registrations.discount_amount
is 'Discount applied to the event-level registration fee. Shoot-level adjustments are stored in registration_shoots.';

create unique index registrations_number_unique_idx
  on public.registrations (
    organization_id,
    registration_number
  )
  where registration_number is not null;

create unique index registrations_external_id_unique_idx
  on public.registrations (
    organization_id,
    external_source,
    external_id
  )
  where external_id is not null;

create index registrations_event_status_idx
  on public.registrations (
    event_id,
    status
  );

create index registrations_event_checkin_idx
  on public.registrations (
    event_id,
    checked_in
  );

create index registrations_event_payment_idx
  on public.registrations (
    event_id,
    payment_status
  );

create index registrations_athlete_history_idx
  on public.registrations (
    athlete_id,
    registered_at
  );

create index registrations_team_event_idx
  on public.registrations (
    team_id,
    event_id
  )
  where team_id is not null;

create index registrations_class_event_idx
  on public.registrations (
    class_id,
    event_id
  )
  where class_id is not null;

create index registrations_organization_registered_at_idx
  on public.registrations (
    organization_id,
    registered_at
  );

create trigger registrations_set_updated_at
before update on public.registrations
for each row
execute function public.set_updated_at();


-- ============================================================
-- REGISTRATION SHOOTS
-- ============================================================

create table public.registration_shoots (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,
  event_id uuid not null,

  registration_id uuid not null,
  shoot_id uuid not null,

  status text not null default 'registered',

  -- Fee snapshots preserve the amount charged at registration.
  entry_fee numeric(10, 2) not null default 0,
  organization_fee numeric(10, 2) not null default 0,
  fee_adjustment numeric(10, 2) not null default 0,

  total_fee numeric(10, 2)
    generated always as (
      entry_fee + organization_fee + fee_adjustment
    ) stored,

  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid
    references auth.users(id)
    on delete set null,

  waitlist_position integer,

  squad_assignment_status text not null default 'unassigned',

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registration_shoots_status_valid
    check (
      status in (
        'pending',
        'registered',
        'waitlisted',
        'withdrawn',
        'cancelled',
        'completed',
        'disqualified'
      )
    ),

  constraint registration_shoots_entry_fee_nonnegative
    check (entry_fee >= 0),

  constraint registration_shoots_organization_fee_nonnegative
    check (organization_fee >= 0),

  constraint registration_shoots_total_fee_nonnegative
    check (
      entry_fee + organization_fee + fee_adjustment >= 0
    ),

  constraint registration_shoots_waitlist_position_positive
    check (
      waitlist_position is null
      or waitlist_position > 0
    ),

  constraint registration_shoots_waitlist_consistent
    check (
      waitlist_position is null
      or status = 'waitlisted'
    ),

  constraint registration_shoots_squad_status_valid
    check (
      squad_assignment_status in (
        'unassigned',
        'assigned',
        'locked',
        'not_required'
      )
    ),

  constraint registration_shoots_checkin_consistent
    check (
      checked_in = true
      or (
        checked_in_at is null
        and checked_in_by is null
      )
    ),

  constraint registration_shoots_registration_same_event_org
    foreign key (
      registration_id,
      event_id,
      organization_id
    )
    references public.registrations (
      id,
      event_id,
      organization_id
    )
    on delete cascade,

  constraint registration_shoots_shoot_same_event_org
    foreign key (
      shoot_id,
      event_id,
      organization_id
    )
    references public.shoots (
      id,
      event_id,
      organization_id
    )
    on delete cascade,

  constraint registration_shoots_one_entry_per_shoot
    unique (registration_id, shoot_id)
);

comment on table public.registration_shoots
is 'Connects an event registration to one or more individual shoots and preserves shoot-level fee snapshots.';

comment on column public.registration_shoots.entry_fee
is 'Snapshot of the shoot entry fee when the athlete was enrolled.';

comment on column public.registration_shoots.organization_fee
is 'Snapshot of the organization fee, such as the CYSSA fee, when the athlete was enrolled.';

comment on column public.registration_shoots.fee_adjustment
is 'Positive or negative manual adjustment applied to this shoot enrollment.';

comment on column public.registration_shoots.total_fee
is 'Automatically calculated shoot total: entry fee plus organization fee plus fee adjustment.';

comment on column public.registration_shoots.squad_assignment_status
is 'Tracks whether the athlete still needs to be assigned to a squad for this shoot.';

create index registration_shoots_registration_idx
  on public.registration_shoots (
    registration_id
  );

create index registration_shoots_shoot_status_idx
  on public.registration_shoots (
    shoot_id,
    status
  );

create index registration_shoots_shoot_checkin_idx
  on public.registration_shoots (
    shoot_id,
    checked_in
  );

create index registration_shoots_shoot_squad_status_idx
  on public.registration_shoots (
    shoot_id,
    squad_assignment_status
  );

create index registration_shoots_event_idx
  on public.registration_shoots (
    event_id
  );

create index registration_shoots_organization_idx
  on public.registration_shoots (
    organization_id
  );

create unique index registration_shoots_waitlist_position_unique_idx
  on public.registration_shoots (
    shoot_id,
    waitlist_position
  )
  where waitlist_position is not null;

create trigger registration_shoots_set_updated_at
before update on public.registration_shoots
for each row
execute function public.set_updated_at();


-- ============================================================
-- REGISTRATION NUMBER GENERATION
-- ============================================================

create sequence if not exists public.registration_number_seq
start with 1000
increment by 1;

create or replace function public.assign_registration_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.registration_number is null
     or length(trim(new.registration_number)) = 0 then

    new.registration_number :=
      'CK-' || lpad(
        nextval('public.registration_number_seq')::text,
        7,
        '0'
      );

  end if;

  return new;
end;
$$;

comment on function public.assign_registration_number()
is 'Assigns a human-readable ClayKeeper registration number when one is not supplied.';

create trigger registrations_assign_number
before insert on public.registrations
for each row
execute function public.assign_registration_number();


-- ============================================================
-- AUTOMATIC TIMESTAMP CONSISTENCY
-- ============================================================

create or replace function public.set_registration_status_timestamps()
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

  if new.waiver_received = true
     and old.waiver_received = false
     and new.waiver_received_at is null then
    new.waiver_received_at := now();
  end if;

  if new.waiver_received = false then
    new.waiver_received_at := null;
  end if;

  if new.payment_status = 'paid'
     and old.payment_status is distinct from 'paid'
     and new.paid_at is null then
    new.paid_at := now();
  end if;

  return new;
end;
$$;

create trigger registrations_set_status_timestamps
before update on public.registrations
for each row
execute function public.set_registration_status_timestamps();


create or replace function public.set_registration_shoot_checkin_timestamp()
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

create trigger registration_shoots_set_checkin_timestamp
before update on public.registration_shoots
for each row
execute function public.set_registration_shoot_checkin_timestamp();


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.registrations enable row level security;
alter table public.registration_shoots enable row level security;


-- ============================================================
-- REGISTRATIONS POLICIES
-- ============================================================

create policy "Members can view organization registrations"
on public.registrations
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create registrations"
on public.registrations
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update registrations"
on public.registrations
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

create policy "Owners and admins can delete registrations"
on public.registrations
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ============================================================
-- REGISTRATION SHOOTS POLICIES
-- ============================================================

create policy "Members can view registration shoot enrollments"
on public.registration_shoots
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create shoot enrollments"
on public.registration_shoots
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update shoot enrollments"
on public.registration_shoots
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

create policy "Owners and admins can delete shoot enrollments"
on public.registration_shoots
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);