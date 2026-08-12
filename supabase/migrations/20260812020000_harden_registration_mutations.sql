-- Harden registration mutations.
--
-- Registration attendance, refund, and payment-summary updates now flow
-- through authorized SECURITY DEFINER functions.
--
-- Direct INSERT remains temporarily available because manual registration,
-- historical imports, and ActiveNet imports still create registrations
-- directly from authenticated application sessions.
--
-- Direct UPDATE and DELETE are no longer required by the application and
-- are removed from normal authenticated sessions.

drop policy if exists
  "Owners admins and coaches can update registrations"
on public.registrations;

drop policy if exists
  "Owners and admins can delete registrations"
on public.registrations;

revoke update, delete, truncate
on table public.registrations
from authenticated;

revoke references, trigger
on table public.registrations
from authenticated;

-- Preserve application reads and registration creation.
grant select, insert
on table public.registrations
to authenticated;

-- Preserve the registration creation policy while direct INSERT remains.
drop policy if exists
  "Owners admins and coaches can create registrations"
on public.registrations;

create policy "Owners admins and coaches can create registrations"
on public.registrations
for insert
to authenticated
with check (
  (select public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach']
  ))
);

-- Reassert RPC execution boundaries used for registration mutations.

revoke all on function public.update_registration_attendance(
  uuid,
  uuid[],
  text,
  text
)
from public, anon;

grant execute on function public.update_registration_attendance(
  uuid,
  uuid[],
  text,
  text
)
to authenticated, service_role;

revoke all on function public.update_registration_refund(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text
)
from public, anon;

grant execute on function public.update_registration_refund(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text
)
to authenticated, service_role;

revoke all on function public.record_manual_registration_transaction(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  text
)
from public, anon;

grant execute on function public.record_manual_registration_transaction(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  text
)
to authenticated, service_role;
