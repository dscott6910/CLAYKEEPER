-- Restrict obsolete season rollover RPC.
--
-- The application now uses close_season_and_rollover() for the combined
-- season close/rollover workflow.
--
-- close_season_and_prepare_next() is an older SECURITY DEFINER implementation
-- that is no longer referenced by the application. Authenticated sessions
-- therefore do not need permission to execute it.
--
-- Keep the function itself for migration/history compatibility and preserve
-- service_role access.

revoke execute
on function public.close_season_and_prepare_next(
  uuid,
  boolean,
  text,
  date,
  date
)
from authenticated;
