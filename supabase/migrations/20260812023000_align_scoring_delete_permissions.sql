-- Align scoring delete permissions with scoring write permissions.
--
-- Live Scoring represents clearing an entered score by deleting the
-- corresponding score row. Users who are authorized to enter and update
-- scoring data therefore also need permission to clear an incorrect score.
--
-- Shoot-off round deletion cascades to its associated shoot_off_scores
-- through the existing foreign key.
--
-- Authorized scoring roles:
--   owner
--   admin
--   coach
--   scorekeeper

drop policy if exists
  "Owners and admins can delete score entries"
on public.score_entries;

create policy "Authorized members can delete score entries"
on public.score_entries
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach', 'scorekeeper']
  ))
);

drop policy if exists
  "Owners admins and coaches can delete shoot-off rounds"
on public.shoot_off_rounds;

create policy "Authorized members can delete shoot-off rounds"
on public.shoot_off_rounds
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach', 'scorekeeper']
  ))
);

drop policy if exists
  "Owners admins and coaches can delete shoot-off scores"
on public.shoot_off_scores;

create policy "Authorized members can delete shoot-off scores"
on public.shoot_off_scores
for delete
to authenticated
using (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach', 'scorekeeper']
  ))
);
