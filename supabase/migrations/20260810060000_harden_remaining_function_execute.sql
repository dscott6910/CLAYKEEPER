-- Harden remaining public function EXECUTE privileges.
--
-- Only the explicitly public spectator/registration RPCs retain
-- anonymous EXECUTE access.
--
-- Administrative, membership helper, operational helper, and trigger
-- functions do not need to be directly executable by anonymous clients.

-- ============================================================
-- Administrative season functions
-- ============================================================

REVOKE ALL ON FUNCTION public.activate_season(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.activate_season(uuid)
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.close_season(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.close_season(uuid)
TO authenticated, service_role;


-- ============================================================
-- Organization authorization helpers
-- ============================================================

REVOKE ALL ON FUNCTION public.has_organization_role(uuid, text[])
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_organization_role(uuid, text[])
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_organization_member(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid)
TO authenticated, service_role;


-- ============================================================
-- Operational helper
-- ============================================================

REVOKE ALL ON FUNCTION public.refresh_squad_status(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.refresh_squad_status(uuid)
TO authenticated, service_role;


-- ============================================================
-- Trigger functions
--
-- PostgreSQL triggers invoke these internally. Browser/API clients
-- do not need direct EXECUTE privileges.
-- ============================================================

REVOKE ALL ON FUNCTION public.assign_registration_number()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.prevent_locked_squad_member_delete()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_registration_shoot_checkin_timestamp()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_registration_status_timestamps()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_squad_default_capacity()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_squad_lock_timestamp()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_squad_member_checkin_timestamp()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_registration_squad_status()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_squad_status_after_member_change()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_squad_member_assignment()
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- Intentionally public RPCs
--
-- Anonymous access is retained for:
--
-- get_public_event_portal(uuid)
-- get_public_registration_events()
-- get_public_tournament_portal(text, uuid)
-- ============================================================
