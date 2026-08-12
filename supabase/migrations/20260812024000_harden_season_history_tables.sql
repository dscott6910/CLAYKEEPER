-- Harden season history tables.
--
-- season_closeouts and season_final_records are historical/finalization
-- records. Authenticated users may read them and authorized workflows may
-- create them, but there are no authenticated RLS policies permitting direct
-- UPDATE or DELETE operations.
--
-- Season final records are additionally protected by an immutable trigger
-- and are created through the controlled finalize_season_records() workflow.
--
-- Remove unused UPDATE and DELETE table privileges while preserving SELECT
-- and INSERT privileges required by the existing application workflows.

revoke update, delete
on table public.season_closeouts
from authenticated;

revoke update, delete
on table public.season_final_records
from authenticated;

grant select, insert
on table public.season_closeouts
to authenticated;

grant select, insert
on table public.season_final_records
to authenticated;
