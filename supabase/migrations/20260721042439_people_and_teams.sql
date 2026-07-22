-- ============================================================
-- ClayKeeper
-- Migration: People and Teams
--
-- Creates:
--   teams
--   coaches
--   athletes
--   athlete_teams
--   team_coaches
--
-- Includes:
--   historical team memberships
--   historical coaching assignments
--   organization consistency constraints
--   indexes
--   updated_at triggers
--   row-level security policies
-- ============================================================


-- ============================================================
-- CLASSES: COMPOSITE KEY SUPPORT
-- ============================================================

-- This allows athletes to reference a class while guaranteeing
-- that the athlete and class belong to the same organization.

alter table public.classes
add constraint classes_id_organization_unique
unique (id, organization_id);


-- ============================================================
-- TEAMS
-- ============================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  name text not null,

  school_club_name text,
  mascot text,

  primary_color text,
  secondary_color text,

  external_id text,

  notes text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint teams_name_not_blank
    check (length(trim(name)) > 0),

  constraint teams_primary_color_format
    check (
      primary_color is null
      or primary_color ~ '^#[0-9A-Fa-f]{6}$'
    ),

  constraint teams_secondary_color_format
    check (
      secondary_color is null
      or secondary_color ~ '^#[0-9A-Fa-f]{6}$'
    ),

  constraint teams_id_organization_unique
    unique (id, organization_id)
);

comment on table public.teams
is 'Teams, schools, clubs, or shooting programs participating in ClayKeeper competitions.';

comment on column public.teams.school_club_name
is 'Optional formal school, club, or organization name associated with the team.';

comment on column public.teams.external_id
is 'Optional identifier from an imported or external system.';

create unique index teams_name_unique_per_organization_idx
  on public.teams (
    organization_id,
    lower(name)
  );

create unique index teams_external_id_unique_idx
  on public.teams (
    organization_id,
    external_id
  )
  where external_id is not null;

create index teams_organization_active_name_idx
  on public.teams (
    organization_id,
    active,
    name
  );

create trigger teams_set_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();


-- ============================================================
-- COACHES
-- ============================================================

create table public.coaches (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  first_name text not null,
  last_name text not null,
  preferred_name text,

  email text,
  phone text,

  external_id text,

  notes text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint coaches_first_name_not_blank
    check (length(trim(first_name)) > 0),

  constraint coaches_last_name_not_blank
    check (length(trim(last_name)) > 0),

  constraint coaches_email_not_blank
    check (
      email is null
      or length(trim(email)) > 0
    ),

  constraint coaches_id_organization_unique
    unique (id, organization_id)
);

comment on table public.coaches
is 'Coaches who may be assigned to one or more teams over time.';

comment on column public.coaches.external_id
is 'Optional identifier from an imported or external system.';

create unique index coaches_email_unique_per_organization_idx
  on public.coaches (
    organization_id,
    lower(email)
  )
  where email is not null;

create unique index coaches_external_id_unique_idx
  on public.coaches (
    organization_id,
    external_id
  )
  where external_id is not null;

create index coaches_organization_active_name_idx
  on public.coaches (
    organization_id,
    active,
    last_name,
    first_name
  );

create trigger coaches_set_updated_at
before update on public.coaches
for each row
execute function public.set_updated_at();


-- ============================================================
-- ATHLETES
-- ============================================================

create table public.athletes (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  class_id uuid,

  first_name text not null,
  last_name text not null,
  preferred_name text,

  birth_date date,
  gender text,

  graduation_year integer,

  cyssa_number text,
  ata_number text,
  nssa_number text,

  external_id text,

  email text,
  phone text,

  emergency_contact_name text,
  emergency_contact_phone text,

  notes text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint athletes_first_name_not_blank
    check (length(trim(first_name)) > 0),

  constraint athletes_last_name_not_blank
    check (length(trim(last_name)) > 0),

  constraint athletes_graduation_year_valid
    check (
      graduation_year is null
      or graduation_year between 1900 and 2200
    ),

  constraint athletes_email_not_blank
    check (
      email is null
      or length(trim(email)) > 0
    ),

  constraint athletes_id_organization_unique
    unique (id, organization_id),

  constraint athletes_class_same_organization
    foreign key (class_id, organization_id)
    references public.classes(id, organization_id)
    on delete restrict
);

comment on table public.athletes
is 'Athletes participating in shoots and competitions. Team history is stored separately in athlete_teams.';

comment on column public.athletes.class_id
is 'The athlete current or default competition class. Event registration may later preserve the class used for a specific shoot.';

comment on column public.athletes.cyssa_number
is 'Optional CYSSA athlete identification number.';

comment on column public.athletes.ata_number
is 'Optional Amateur Trapshooting Association identification number.';

comment on column public.athletes.nssa_number
is 'Optional National Skeet Shooting Association identification number.';

comment on column public.athletes.external_id
is 'Optional identifier from an imported or external system.';

create unique index athletes_external_id_unique_idx
  on public.athletes (
    organization_id,
    external_id
  )
  where external_id is not null;

create unique index athletes_cyssa_number_unique_idx
  on public.athletes (
    organization_id,
    cyssa_number
  )
  where cyssa_number is not null;

create unique index athletes_ata_number_unique_idx
  on public.athletes (
    organization_id,
    ata_number
  )
  where ata_number is not null;

create unique index athletes_nssa_number_unique_idx
  on public.athletes (
    organization_id,
    nssa_number
  )
  where nssa_number is not null;

create index athletes_organization_active_name_idx
  on public.athletes (
    organization_id,
    active,
    last_name,
    first_name
  );

create index athletes_class_id_idx
  on public.athletes (
    class_id
  );

create index athletes_graduation_year_idx
  on public.athletes (
    organization_id,
    graduation_year
  );

create trigger athletes_set_updated_at
before update on public.athletes
for each row
execute function public.set_updated_at();


-- ============================================================
-- ATHLETE TEAM HISTORY
-- ============================================================

create table public.athlete_teams (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,

  athlete_id uuid not null,
  team_id uuid not null,

  start_date date,
  end_date date,

  is_primary boolean not null default true,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint athlete_teams_date_range_valid
    check (
      end_date is null
      or start_date is null
      or end_date >= start_date
    ),

  constraint athlete_teams_athlete_same_organization
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete cascade,

  constraint athlete_teams_team_same_organization
    foreign key (team_id, organization_id)
    references public.teams(id, organization_id)
    on delete cascade,

  constraint athlete_teams_assignment_unique
    unique (
      athlete_id,
      team_id,
      start_date
    )
);

comment on table public.athlete_teams
is 'Historical record of athlete membership on teams. This preserves team affiliation when athletes change teams over time.';

comment on column public.athlete_teams.is_primary
is 'Indicates the athlete primary team when the athlete belongs to multiple teams during the same period.';

create index athlete_teams_organization_id_idx
  on public.athlete_teams (
    organization_id
  );

create index athlete_teams_athlete_history_idx
  on public.athlete_teams (
    athlete_id,
    start_date,
    end_date
  );

create index athlete_teams_team_history_idx
  on public.athlete_teams (
    team_id,
    start_date,
    end_date
  );

create unique index athlete_teams_one_current_primary_idx
  on public.athlete_teams (
    athlete_id
  )
  where end_date is null
    and is_primary = true;

create trigger athlete_teams_set_updated_at
before update on public.athlete_teams
for each row
execute function public.set_updated_at();


-- ============================================================
-- TEAM COACH HISTORY
-- ============================================================

create table public.team_coaches (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,

  team_id uuid not null,
  coach_id uuid not null,

  role text not null default 'coach',

  start_date date,
  end_date date,

  is_head_coach boolean not null default false,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_coaches_role_not_blank
    check (length(trim(role)) > 0),

  constraint team_coaches_date_range_valid
    check (
      end_date is null
      or start_date is null
      or end_date >= start_date
    ),

  constraint team_coaches_team_same_organization
    foreign key (team_id, organization_id)
    references public.teams(id, organization_id)
    on delete cascade,

  constraint team_coaches_coach_same_organization
    foreign key (coach_id, organization_id)
    references public.coaches(id, organization_id)
    on delete cascade,

  constraint team_coaches_assignment_unique
    unique (
      team_id,
      coach_id,
      start_date
    )
);

comment on table public.team_coaches
is 'Historical assignments of coaches to teams. A coach may work with multiple teams over time.';

comment on column public.team_coaches.role
is 'Coach assignment title, such as coach, assistant coach, or team manager.';

create index team_coaches_organization_id_idx
  on public.team_coaches (
    organization_id
  );

create index team_coaches_team_history_idx
  on public.team_coaches (
    team_id,
    start_date,
    end_date
  );

create index team_coaches_coach_history_idx
  on public.team_coaches (
    coach_id,
    start_date,
    end_date
  );

create trigger team_coaches_set_updated_at
before update on public.team_coaches
for each row
execute function public.set_updated_at();


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.teams enable row level security;
alter table public.coaches enable row level security;
alter table public.athletes enable row level security;
alter table public.athlete_teams enable row level security;
alter table public.team_coaches enable row level security;


-- ============================================================
-- TEAMS POLICIES
-- ============================================================

create policy "Members can view organization teams"
on public.teams
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create teams"
on public.teams
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update teams"
on public.teams
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

create policy "Owners and admins can delete teams"
on public.teams
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ============================================================
-- COACHES POLICIES
-- ============================================================

create policy "Members can view organization coaches"
on public.coaches
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners and admins can create coaches"
on public.coaches
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);

create policy "Owners and admins can update coaches"
on public.coaches
for update
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
)
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);

create policy "Owners and admins can delete coaches"
on public.coaches
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ============================================================
-- ATHLETES POLICIES
-- ============================================================

create policy "Members can view organization athletes"
on public.athletes
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create athletes"
on public.athletes
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update athletes"
on public.athletes
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

create policy "Owners and admins can delete athletes"
on public.athletes
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ============================================================
-- ATHLETE TEAMS POLICIES
-- ============================================================

create policy "Members can view athlete team history"
on public.athlete_teams
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners admins and coaches can create athlete team assignments"
on public.athlete_teams
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

create policy "Owners admins and coaches can update athlete team assignments"
on public.athlete_teams
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

create policy "Owners and admins can delete athlete team assignments"
on public.athlete_teams
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ============================================================
-- TEAM COACHES POLICIES
-- ============================================================

create policy "Members can view team coach history"
on public.team_coaches
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Owners and admins can create team coach assignments"
on public.team_coaches
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);

create policy "Owners and admins can update team coach assignments"
on public.team_coaches
for update
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
)
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);

create policy "Owners and admins can delete team coach assignments"
on public.team_coaches
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);