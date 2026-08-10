-- Harden operational RLS policy role scopes.
--
-- Explicitly restrict policies requiring authenticated organization
-- membership to the authenticated database role.
--
-- Scorecard template writes are restricted to owner/admin because
-- ordinary organization members should not modify scoring configuration.

-- course_stations

drop policy if exists
  course_stations_select_members
on public.course_stations;

create policy course_stations_select_members
on public.course_stations
for select
to authenticated
using (
  public.is_organization_member(organization_id)
);


-- event_courses

drop policy if exists
  event_courses_select_members
on public.event_courses;

create policy event_courses_select_members
on public.event_courses
for select
to authenticated
using (
  public.is_organization_member(organization_id)
);

drop policy if exists
  event_courses_delete_admins
on public.event_courses;

create policy event_courses_delete_admins
on public.event_courses
for delete
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);


-- scorecard_templates

drop policy if exists
  scorecard_templates_select_members
on public.scorecard_templates;

create policy scorecard_templates_select_members
on public.scorecard_templates
for select
to authenticated
using (
  public.is_organization_member(organization_id)
);

drop policy if exists
  scorecard_templates_insert_members
on public.scorecard_templates;

create policy scorecard_templates_insert_admins
on public.scorecard_templates
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);

drop policy if exists
  scorecard_templates_update_members
on public.scorecard_templates;

create policy scorecard_templates_update_admins
on public.scorecard_templates
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);

drop policy if exists
  scorecard_templates_delete_admins
on public.scorecard_templates;

create policy scorecard_templates_delete_admins
on public.scorecard_templates
for delete
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);
