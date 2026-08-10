-- ClayKeeper security hardening
-- Restrict Course Builder mutations to operational roles while preserving
-- read access for organization members.

drop policy if exists "event_courses_insert_members"
on public.event_courses;

create policy "event_courses_insert_operational_roles"
on public.event_courses
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['owner','admin','coach']::text[]
  )
);

drop policy if exists "event_courses_update_members"
on public.event_courses;

create policy "event_courses_update_operational_roles"
on public.event_courses
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner','admin','coach']::text[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner','admin','coach']::text[]
  )
);

drop policy if exists "course_stations_insert_members"
on public.course_stations;

create policy "course_stations_insert_operational_roles"
on public.course_stations
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['owner','admin','coach']::text[]
  )
);

drop policy if exists "course_stations_update_members"
on public.course_stations;

create policy "course_stations_update_operational_roles"
on public.course_stations
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner','admin','coach']::text[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner','admin','coach']::text[]
  )
);

drop policy if exists "course_stations_delete_members"
on public.course_stations;

create policy "course_stations_delete_operational_roles"
on public.course_stations
for delete
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner','admin','coach']::text[]
  )
);
