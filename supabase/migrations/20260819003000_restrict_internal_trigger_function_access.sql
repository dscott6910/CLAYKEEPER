-- ============================================================
-- ClayKeeper
-- Restrict Internal Trigger Function Access
--
-- These functions are invoked only by database triggers. Browser
-- and application roles must not be able to execute them directly.
-- ============================================================

revoke execute
on function public.invalidate_awards_for_shoot(uuid)
from public;

revoke execute
on function public.invalidate_awards_for_shoot(uuid)
from anon;

revoke execute
on function public.invalidate_awards_for_shoot(uuid)
from authenticated;

revoke execute
on function public.invalidate_awards_from_competitive_change()
from public;

revoke execute
on function public.invalidate_awards_from_competitive_change()
from anon;

revoke execute
on function public.invalidate_awards_from_competitive_change()
from authenticated;

revoke execute
on function public.sync_squad_member_from_enrollment_status()
from public;

revoke execute
on function public.sync_squad_member_from_enrollment_status()
from anon;

revoke execute
on function public.sync_squad_member_from_enrollment_status()
from authenticated;
