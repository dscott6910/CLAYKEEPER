-- Allow organization owners and administrators to correct event registrations.
-- Other registration mutations remain protected behind their existing RPCs.

grant update on table public.registrations to authenticated;

drop policy if exists "Owners and admins can update registrations" on public.registrations;

create policy "Owners and admins can update registrations"
on public.registrations
for update
to authenticated
using (
  (select public.has_organization_role(organization_id, array['owner', 'admin']))
)
with check (
  (select public.has_organization_role(organization_id, array['owner', 'admin']))
);
