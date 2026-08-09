create table if not exists public.event_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  discipline text not null,
  course_side text not null default 'Custom',
  template_name text,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_courses_course_side_check check (course_side in ('East','West','Custom')),
  constraint event_courses_discipline_check check (discipline in ('american_trap','skeet','sporting_clays','bunker'))
);

create unique index if not exists event_courses_event_name_unique on public.event_courses (event_id, lower(name));
create index if not exists event_courses_event_idx on public.event_courses (organization_id, event_id);

create table if not exists public.course_stations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid not null references public.event_courses(id) on delete cascade,
  station_number integer not null,
  bird_count integer not null default 0,
  notes text,
  target_type text,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_stations_station_number_check check (station_number between 1 and 15),
  constraint course_stations_bird_count_check check (bird_count between 0 and 10)
);

create unique index if not exists course_stations_course_station_unique on public.course_stations (course_id, station_number);
create index if not exists course_stations_course_idx on public.course_stations (organization_id, course_id, display_order);

alter table public.event_courses enable row level security;
alter table public.course_stations enable row level security;

drop policy if exists "event_courses_select_members" on public.event_courses;
create policy "event_courses_select_members" on public.event_courses for select using (public.is_organization_member(organization_id));
drop policy if exists "event_courses_insert_members" on public.event_courses;
create policy "event_courses_insert_members" on public.event_courses for insert with check (public.is_organization_member(organization_id));
drop policy if exists "event_courses_update_members" on public.event_courses;
create policy "event_courses_update_members" on public.event_courses for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists "event_courses_delete_admins" on public.event_courses;
create policy "event_courses_delete_admins" on public.event_courses for delete using (public.has_organization_role(organization_id, array['owner','admin']::text[]));

drop policy if exists "course_stations_select_members" on public.course_stations;
create policy "course_stations_select_members" on public.course_stations for select using (public.is_organization_member(organization_id));
drop policy if exists "course_stations_insert_members" on public.course_stations;
create policy "course_stations_insert_members" on public.course_stations for insert with check (public.is_organization_member(organization_id));
drop policy if exists "course_stations_update_members" on public.course_stations;
create policy "course_stations_update_members" on public.course_stations for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists "course_stations_delete_members" on public.course_stations;
create policy "course_stations_delete_members" on public.course_stations for delete using (public.is_organization_member(organization_id));
