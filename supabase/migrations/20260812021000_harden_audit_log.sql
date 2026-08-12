-- Harden audit_log access.
--
-- The application does not write directly to public.audit_log from
-- authenticated client sessions. Audit records are maintained through
-- privileged database/server-side mechanisms.
--
-- Authenticated users retain only the SELECT privilege. Row-level security
-- continues to determine which audit records authorized roles may view.

revoke insert, update, delete, truncate, references, trigger
on table public.audit_log
from authenticated;

grant select
on table public.audit_log
to authenticated;
