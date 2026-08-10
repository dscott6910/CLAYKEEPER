-- Harden financial and registration configuration access.
--
-- Financial transaction details are restricted to organization
-- owners, admins, and treasurers.
--
-- Registration settings and discount-code administration are
-- restricted to organization owners and admins.
--
-- Public registration continues through the explicitly public RPCs.

-- ============================================================
-- Payment transactions
-- ============================================================

drop policy if exists
  "Members view payment transactions"
on public.payment_transactions;

drop policy if exists
  "Owners admins manage payment transactions"
on public.payment_transactions;

drop policy if exists
  "Authorized users can view payment transactions"
on public.payment_transactions;

drop policy if exists
  "Authorized users can create payment transactions"
on public.payment_transactions;

drop policy if exists
  "Authorized users can update payment transactions"
on public.payment_transactions;

drop policy if exists
  "Authorized users can delete payment transactions"
on public.payment_transactions;

create policy "Authorized users can view payment transactions"
on public.payment_transactions
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'treasurer']
  )
);

create policy "Authorized users can create payment transactions"
on public.payment_transactions
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'treasurer']
  )
);

create policy "Authorized users can update payment transactions"
on public.payment_transactions
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'treasurer']
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'treasurer']
  )
);

create policy "Authorized users can delete payment transactions"
on public.payment_transactions
for delete
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);


-- ============================================================
-- Discount codes
-- ============================================================

drop policy if exists
  "Members view discount codes"
on public.discount_codes;

drop policy if exists
  "Owners admins manage discount codes"
on public.discount_codes;

create policy "Owners admins manage discount codes"
on public.discount_codes
for all
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


-- ============================================================
-- Event registration settings
-- ============================================================

drop policy if exists
  "Members view registration settings"
on public.event_registration_settings;

drop policy if exists
  "Owners admins manage registration settings"
on public.event_registration_settings;

create policy "Owners admins manage registration settings"
on public.event_registration_settings
for all
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
