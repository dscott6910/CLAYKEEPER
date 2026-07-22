-- ============================================================
-- ClayKeeper
-- Initial database schema
--
-- Creates:
--   organizations
--   organization_members
--   classes
--   locations
--
-- Also creates:
--   updated_at trigger function
--   automatic default class creation
--   indexes
--   row-level security policies
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- SHARED FUNCTIONS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at()
is 'Automatically sets updated_at to the current timestamp before a row is updated.';


-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null,

  email text,
  phone text,
  website text,

  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country_code text not null default 'US',

  logo_url text,
  timezone text not null default 'America/Los_Angeles',

  active boolean not null default true,

  created_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organizations_name_not_blank
    check (length(trim(name)) > 0),

  constraint organizations_slug_not_blank
    check (length(trim(slug)) > 0),

  constraint organizations_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint organizations_country_code_format
    check (country_code ~ '^[A-Z]{2}$')
);

comment on table public.organizations
is 'Clubs, teams, associations, or other organizations using ClayKeeper.';

comment on column public.organizations.slug
is 'URL-safe unique identifier for the organization.';

create unique index organizations_slug_unique_idx
  on public.organizations (lower(slug));

create index organizations_active_idx
  on public.organizations (active);

create index organizations_created_by_idx
  on public.organizations (created_by);

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();


-- ============================================================
-- ORGANIZATION MEMBERS
-- ============================================================

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null default 'member',

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_members_role_valid
    check (
      role in (
        'owner',
        'admin',
        'coach',
        'scorekeeper',
        'member'
      )
    ),

  constraint organization_members_unique_user
    unique (organization_id, user_id)
);

comment on table public.organization_members
is 'Connects authenticated users to organizations and defines their organization-level role.';

create index organization_members_user_id_idx
  on public.organization_members (user_id);

create index organization_members_organization_id_idx
  on public.organization_members (organization_id);

create index organization_members_active_idx
  on public.organization_members (organization_id, active);

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();


-- ============================================================
-- CLASSES
-- ============================================================

create table public.classes (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  code text not null,
  display_name text not null,
  description text,

  display_order integer not null default 0,

  active boolean not null default true,
  is_system_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint classes_code_not_blank
    check (length(trim(code)) > 0),

  constraint classes_display_name_not_blank
    check (length(trim(display_name)) > 0),

  constraint classes_display_order_nonnegative
    check (display_order >= 0),

  constraint classes_unique_code_per_organization
    unique (organization_id, code)
);

comment on table public.classes
is 'Competition classifications available within an organization, such as IA, IE, Rookie, Junior Varsity, Varsity, and Young Adult.';

comment on column public.classes.code
is 'Short class abbreviation displayed throughout ClayKeeper.';

comment on column public.classes.display_name
is 'Expanded human-readable class name.';

create index classes_organization_id_idx
  on public.classes (organization_id);

create index classes_active_order_idx
  on public.classes (
    organization_id,
    active,
    display_order
  );

create trigger classes_set_updated_at
before update on public.classes
for each row
execute function public.set_updated_at();


-- ============================================================
-- LOCATIONS
-- ============================================================

create table public.locations (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  name text not null,

  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country_code text not null default 'US',

  number_of_fields integer,

  latitude numeric(9, 6),
  longitude numeric(9, 6),

  notes text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint locations_name_not_blank
    check (length(trim(name)) > 0),

  constraint locations_number_of_fields_positive
    check (
      number_of_fields is null
      or number_of_fields > 0
    ),

  constraint locations_latitude_valid
    check (
      latitude is null
      or latitude between -90 and 90
    ),

  constraint locations_longitude_valid
    check (
      longitude is null
      or longitude between -180 and 180
    ),

  constraint locations_country_code_format
    check (country_code ~ '^[A-Z]{2}$')
);

comment on table public.locations
is 'Physical shooting locations used by shoots. Events may contain shoots at different locations.';

comment on column public.locations.number_of_fields
is 'Number of available shooting fields at the location.';

create index locations_organization_id_idx
  on public.locations (organization_id);

create index locations_active_name_idx
  on public.locations (
    organization_id,
    active,
    name
  );

create trigger locations_set_updated_at
before update on public.locations
for each row
execute function public.set_updated_at();


-- ============================================================
-- DEFAULT CLASSES
-- ============================================================

create or replace function public.create_default_organization_classes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.classes (
    organization_id,
    code,
    display_name,
    display_order,
    is_system_default
  )
  values
    (new.id, 'IA', 'IA', 10, true),
    (new.id, 'IE', 'IE', 20, true),
    (new.id, 'R',  'Rookie', 30, true),
    (new.id, 'JV', 'Junior Varsity', 40, true),
    (new.id, 'VR', 'Varsity', 50, true),
    (new.id, 'YA', 'Young Adult', 60, true)
  on conflict (organization_id, code) do nothing;

  return new;
end;
$$;

comment on function public.create_default_organization_classes()
is 'Creates the standard ClayKeeper classes whenever a new organization is created.';

create trigger organizations_create_default_classes
after insert on public.organizations
for each row
execute function public.create_default_organization_classes();


-- ============================================================
-- AUTHORIZATION HELPER FUNCTIONS
-- ============================================================

create or replace function public.is_organization_member(
  requested_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = requested_organization_id
      and user_id = (select auth.uid())
      and active = true
  );
$$;

comment on function public.is_organization_member(uuid)
is 'Returns true when the authenticated user is an active member of the requested organization.';


create or replace function public.has_organization_role(
  requested_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = requested_organization_id
      and user_id = (select auth.uid())
      and active = true
      and role = any(allowed_roles)
  );
$$;

comment on function public.has_organization_role(uuid, text[])
is 'Returns true when the authenticated user has one of the requested roles in the organization.';


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.classes enable row level security;
alter table public.locations enable row level security;


-- ------------------------------------------------------------
-- Organizations
-- ------------------------------------------------------------

create policy "Members can view their organizations"
on public.organizations
for select
to authenticated
using (
  (select public.is_organization_member(id))
  or created_by = (select auth.uid())
);

create policy "Authenticated users can create organizations"
on public.organizations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
);

create policy "Organization owners and admins can update organizations"
on public.organizations
for update
to authenticated
using (
  (select public.has_organization_role(
    id,
    array['owner', 'admin']
  ))
)
with check (
  (select public.has_organization_role(
    id,
    array['owner', 'admin']
  ))
);

create policy "Organization owners can delete organizations"
on public.organizations
for delete
to authenticated
using (
  (select public.has_organization_role(
    id,
    array['owner']
  ))
);


-- ------------------------------------------------------------
-- Organization members
-- ------------------------------------------------------------

create policy "Members can view organization memberships"
on public.organization_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_organization_member(organization_id))
);

create policy "Organization owners and admins can add members"
on public.organization_members
for insert
to authenticated
with check (
  (
    (select public.has_organization_role(
      organization_id,
      array['owner', 'admin']
    ))
  )
  or (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1
      from public.organizations
      where organizations.id = organization_id
        and organizations.created_by = (select auth.uid())
    )
  )
);

create policy "Organization owners and admins can update members"
on public.organization_members
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

create policy "Organization owners and admins can remove members"
on public.organization_members
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ------------------------------------------------------------
-- Classes
-- ------------------------------------------------------------

create policy "Members can view organization classes"
on public.classes
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Organization owners and admins can create classes"
on public.classes
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);

create policy "Organization owners and admins can update classes"
on public.classes
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

create policy "Organization owners and admins can delete classes"
on public.classes
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ------------------------------------------------------------
-- Locations
-- ------------------------------------------------------------

create policy "Members can view organization locations"
on public.locations
for select
to authenticated
using (
  (select public.is_organization_member(organization_id))
);

create policy "Organization owners and admins can create locations"
on public.locations
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);

create policy "Organization owners and admins can update locations"
on public.locations
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

create policy "Organization owners and admins can delete locations"
on public.locations
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  ))
);


-- ============================================================
-- AUTOMATIC ORGANIZATION OWNER MEMBERSHIP
-- ============================================================

create or replace function public.create_organization_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.organization_members (
      organization_id,
      user_id,
      role
    )
    values (
      new.id,
      new.created_by,
      'owner'
    )
    on conflict (organization_id, user_id)
    do update set
      role = 'owner',
      active = true,
      updated_at = now();
  end if;

  return new;
end;
$$;

comment on function public.create_organization_owner_membership()
is 'Automatically makes the organization creator an active owner.';

create trigger organizations_create_owner_membership
after insert on public.organizations
for each row
execute function public.create_organization_owner_membership();