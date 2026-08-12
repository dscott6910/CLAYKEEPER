-- Harden the Event Maintenance SECURITY DEFINER function.
--
-- delete_event_maintenance(uuid) already schema-qualifies its application
-- tables and performs explicit owner/admin authorization.
--
-- Use an empty search_path so object resolution cannot be influenced by
-- caller-controlled or otherwise unexpected schemas.
--
-- The function body and EXECUTE privileges remain unchanged.

alter function public.delete_event_maintenance(uuid)
set search_path = '';
