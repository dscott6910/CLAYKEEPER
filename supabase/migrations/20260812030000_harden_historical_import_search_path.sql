-- Harden the active historical-import deletion SECURITY DEFINER function.
--
-- delete_historical_import_v4(uuid) schema-qualifies its application
-- tables and authorization helper and performs explicit owner/admin
-- authorization.
--
-- Use an empty search_path to prevent unexpected object resolution.
--
-- The function body and EXECUTE privileges remain unchanged.

alter function public.delete_historical_import_v4(uuid)
set search_path = '';
