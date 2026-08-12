-- Harden the create_season SECURITY DEFINER function.
--
-- create_season(text, date, date, boolean) schema-qualifies its application
-- tables and performs explicit authenticated owner/admin authorization.
--
-- Use an empty search_path to prevent unexpected object resolution.
--
-- The function body and EXECUTE privileges remain unchanged.

alter function public.create_season(
  text,
  date,
  date,
  boolean
)
set search_path = '';
