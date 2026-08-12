-- Harden the season finalization SECURITY DEFINER function.
--
-- finalize_season_records(...) schema-qualifies its application tables,
-- authorization helper, and auth.uid() calls and performs explicit
-- owner/admin authorization.
--
-- Use an empty search_path to prevent unexpected object resolution.
--
-- The function body and EXECUTE privileges remain unchanged.

alter function public.finalize_season_records(
  uuid,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
set search_path = '';
