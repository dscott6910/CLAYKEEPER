-- ============================================================
-- ClayKeeper
-- Restrict Coach Personal Data
--
-- Operational roles may view organization coach records. Ordinary
-- member accounts may view only the coach record linked to their
-- own authenticated account.
-- ============================================================

drop policy if exists
  "Members can view organization coaches"
on public.coaches;

create policy
  "Authorized users can view coaches"
on public.coaches
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array[
      'owner',
      'admin',
      'coach',
      'scorekeeper'
    ]
  )
  or user_id = (select auth.uid())
);
