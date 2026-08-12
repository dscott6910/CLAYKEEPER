-- Payment transaction mutations must go through authorized server-side
-- functions such as record_manual_registration_transaction.
--
-- Authenticated users retain SELECT access for authorized organizations,
-- but cannot directly insert, update, delete, or truncate ledger rows.

drop policy if exists
  "Authorized users can create payment transactions"
on public.payment_transactions;

drop policy if exists
  "Authorized users can update payment transactions"
on public.payment_transactions;

drop policy if exists
  "Authorized users can delete payment transactions"
on public.payment_transactions;

-- Remove direct mutation privileges from normal authenticated sessions.
-- SELECT remains available and continues to be restricted by RLS.
revoke insert, update, delete, truncate
on table public.payment_transactions
from authenticated;

-- REFERENCES and TRIGGER are not required by the application role either.
revoke references, trigger
on table public.payment_transactions
from authenticated;

-- Explicitly preserve read access.
grant select
on table public.payment_transactions
to authenticated;

-- Keep the RPC callable by authenticated users. Authorization is enforced
-- inside the SECURITY DEFINER function.
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
