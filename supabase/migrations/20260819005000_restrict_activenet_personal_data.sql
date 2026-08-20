-- ============================================================
-- ClayKeeper
-- Restrict ActiveNet Personal Data
--
-- ActiveNet import records contain participant and guardian data.
-- The application exposes import management only to organization
-- owners and admins, so database read access must match that model.
-- ============================================================

drop policy if exists
  "organization members view activenet imports"
on public.activenet_imports;

create policy
  "Owners and admins can view ActiveNet imports"
on public.activenet_imports
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);

drop policy if exists
  "organization members view activenet participant records"
on public.activenet_participant_records;

create policy
  "Owners and admins can view ActiveNet participant records"
on public.activenet_participant_records
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);
