-- ============================================================
-- ClayKeeper
-- Migration: Events and Shoots
--
-- Creates:
--   events
--   shoots
--
-- Design:
--   An event is an umbrella competition.
--   An event may contain one or more shoots.
--   Each shoot may use its own location, date, discipline,
--   schedule, fees, and scoring configuration.
-- ============================================================


-- ============================================================
-- EXISTING TABLE: COMPOSITE KEY SUPPORT
-- ============================================================

-- Allows a shoot to reference a location while guaranteeing
-- that the shoot and location belong to the same organization.

alter table public.locations
add constraint locations_id_organization_unique
unique (id, organization_id);


-- ============================================================
-- EVENTS
-- ============================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  name text not null,

  description text,

  series_name text,
  sponsor_name text,

  start_date date,
  end_date date,

  registration_opens_at timestamptz,
  registration_closes_at timestamptz,

  status text not null default 'draft',

  external_id text,

  notes text,

  active boolean not null default true,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_name_not_blank
    check (length(trim(name)) > 0),

  constraint events_date_range_valid
    check (
      end_date is null
      or start_date is null
      or end_date >= start_date
    ),

  constraint events_registration_range_valid
    check (
      registration_closes_at is null
      or registration_opens_at is null
      or registration_closes_at >= registration_opens_at
    ),

  constraint events_status_valid
    check (
      status in (
        'draft',
        'published',
        'registration_open',
        'registration_closed',
        'in_progress',
        'completed',
        'cancelled',
        'archived'
      )
    ),

  constraint events_id_organization_unique
    unique (id, organization_id)
);

comment on table public.events
is 'Umbrella competitions that may contain one or more shoots. Locations are assigned to the individual shoots rather than the event.';

comment on column public.events.series_name
is 'Optional series or circuit name, such as Trap Series or Sporting Clays Series.';

comment on column public.events.sponsor_name
is 'Optional event-level sponsor name. A shoot may override this with its own sponsor.';

comment on column public.events.status
is 'Current administrative and competition status of the event.';

comment on column public.events.external_id
is 'Optional identifier from ActiveNet, a spreadsheet, or another external system.';

create unique index events_external_id_unique_idx
  on public.events (
    organization_id,
    external_id
  )
  where external_id is not null;

create index events_organization_status_date_idx
  on public.events (
    organization_id,
    status,
    start_date
  );

create index events_organization_active_name_idx
  on public.events (
    organization_id,
    active,
    name
  );

create index events_series_name_idx
  on public.events (
    organization_id,
    series_name
  )
  where series_name is not null;

create trigger events_set_updated_at
before update on public.events
for each row
execute function public.set_updated_at();


-- ============================================================
-- SHOOTS
-- ============================================================

create table public.shoots (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,

  event_id uuid not null,
  location_id uuid,

  name text not null,

  discipline text not null,
  competition_type text,

  shoot_date date not null,
  start_time time without time zone,
  timezone text,

  sponsor_name text,

  entry_fee numeric(10, 2) not null default 0,
  organization_fee numeric(10, 2) not null default 0,

  targets_per_round integer not null default 25,
  number_of_rounds integer not null default 4,

  squad_size integer,
  registration_capacity integer,

  allow_waitlist boolean not null default false,
  allow_online_registration boolean not null default true,
  allow_score_entry boolean not null default false,

  status text not null default 'draft',

  external_id text,

  notes text,

  active boolean not null default true,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shoots_name_not_blank
    check (length(trim(name)) > 0),

  constraint shoots_discipline_valid
    check (
      discipline in (
        'american_trap',
        'skeet',
        'sporting_clays',
        'bunker'
      )
    ),

  constraint shoots_competition_type_not_blank
    check (
      competition_type is null
      or length(trim(competition_type)) > 0
    ),

  constraint shoots_entry_fee_nonnegative
    check (entry_fee >= 0),

  constraint shoots_organization_fee_nonnegative
    check (organization_fee >= 0),

  constraint shoots_targets_per_round_positive
    check (targets_per_round > 0),

  constraint shoots_number_of_rounds_positive
    check (number_of_rounds > 0),

  constraint shoots_squad_size_positive
    check (
      squad_size is null
      or squad_size > 0
    ),

  constraint shoots_registration_capacity_positive
    check (
      registration_capacity is null
      or registration_capacity > 0
    ),

  constraint shoots_status_valid
    check (
      status in (
        'draft',
        'published',
        'registration_open',
        'registration_closed',
        'in_progress',
        'completed',
        'cancelled',
        'archived'
      )
    ),

  constraint shoots_event_same_organization
    foreign key (event_id, organization_id)
    references public.events(id, organization_id)
    on delete cascade,

  constraint shoots_location_same_organization
    foreign key (location_id, organization_id)
    references public.locations(id, organization_id)
    on delete restrict,

  constraint shoots_id_organization_unique
    unique (id, organization_id)
);

comment on table public.shoots
is 'Individual competitions contained within an event. Each shoot has its own location, discipline, date, fees, and scoring configuration.';

comment on column public.shoots.discipline
is 'Primary shooting discipline: american_trap, skeet, sporting_clays, or bunker.';

comment on column public.shoots.competition_type
is 'Discipline-specific competition type, such as Singles, Handicap, Doubles, East Course, or West Course.';

comment on column public.shoots.organization_fee
is 'Additional organization fee associated with each registration, such as the CYSSA fee.';

comment on column public.shoots.targets_per_round
is 'Number of targets in one scoring round. ClayKeeper defaults this to 25.';

comment on column public.shoots.number_of_rounds
is 'Number of standard scoring rounds included in the shoot.';

comment on column public.shoots.squad_size
is 'Maximum number of athletes normally assigned to one squad.';

comment on column public.shoots.timezone
is 'Optional IANA timezone override. When null, the organization timezone should be used.';

comment on column public.shoots.external_id
is 'Optional identifier from ActiveNet, a spreadsheet, or another external system.';

create unique index shoots_external_id_unique_idx
  on public.shoots (
    organization_id,
    external_id
  )
  where external_id is not null;

create index shoots_event_date_idx
  on public.shoots (
    event_id,
    shoot_date,
    start_time
  );

create index shoots_location_date_idx
  on public.shoots (
    location_id,
    shoot_date
  )
  where location_id is not null;

create index shoots_organization_status_date_idx
  on public.shoots (
    organization_id,
    status,
    shoot_date
  );

create index shoots_organization_discipline_idx
  on public.shoots (
    organization_id,
    discipline
  );

create index shoots_organization_active_name_idx
  on public.shoots (
    organization_id,
    active,
    name
  );

create trigger shoots_set_updated_at
before update on public.shoots
for each row
execute function public.set_updated_at();


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.events enable row level security;
alter table public.shoots enable row level security;


-- ============================================================
-- EVENTS POLICIES
-- ============================================================

create policy "Members can view organization events"
on public.events
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create events"
on public.events
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update events"
on public.events
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

create policy "Owners and admins can delete events"
on public.events
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ============================================================
-- SHOOTS POLICIES
-- ============================================================

create policy "Members can view organization shoots"
on public.shoots
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create shoots"
on public.shoots
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update shoots"
on public.shoots
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

create policy "Owners and admins can delete shoots"
on public.shoots
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);