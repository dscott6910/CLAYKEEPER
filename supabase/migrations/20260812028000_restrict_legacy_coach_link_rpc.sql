-- Restrict obsolete automatic coach-linking RPC.
--
-- link_current_user_to_coach() was introduced for the original coach portal
-- to automatically associate an existing coach profile with the signed-in
-- user when their email addresses matched.
--
-- The current application no longer references this RPC. Because it is a
-- SECURITY DEFINER function that updates the coaches table, authenticated
-- application sessions should not retain unnecessary EXECUTE permission.
--
-- Keep the function itself for migration/history compatibility and preserve
-- service_role access.

revoke execute
on function public.link_current_user_to_coach()
from authenticated;
