-- Harden the active season rollover SECURITY DEFINER function.
--
-- close_season_and_rollover(uuid, boolean, text, date, date)
-- schema-qualifies its application tables and authorization helper and
-- performs explicit owner/admin authorization.
--
-- Use an empty search_path to prevent unexpected object resolution.
--
-- The function body and EXECUTE privileges remain unchanged.

alter function public.close_season_and_rollover(
  uuid,
  boolean,
  text,
  date,
  date
)
set search_path = '';
