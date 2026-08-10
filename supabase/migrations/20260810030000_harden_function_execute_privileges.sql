-- ClayKeeper security hardening:
-- Restrict direct execution of privileged SECURITY DEFINER functions.
--
-- Public spectator/registration RPCs intentionally retain anonymous access.

-- ============================================================
-- Administrative season functions
-- ============================================================

REVOKE ALL ON FUNCTION public.close_season_and_prepare_next(
  uuid, boolean, text, date, date
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.close_season_and_prepare_next(
  uuid, boolean, text, date, date
) TO authenticated, service_role;


REVOKE ALL ON FUNCTION public.close_season_and_rollover(
  uuid, boolean, text, date, date
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.close_season_and_rollover(
  uuid, boolean, text, date, date
) TO authenticated, service_role;


REVOKE ALL ON FUNCTION public.create_season(
  text, date, date, boolean
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_season(
  text, date, date, boolean
) TO authenticated, service_role;


-- ============================================================
-- Event maintenance
-- ============================================================

REVOKE ALL ON FUNCTION public.delete_event_maintenance(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.delete_event_maintenance(uuid)
TO authenticated, service_role;


-- ============================================================
-- Historical import cleanup
-- ============================================================

REVOKE ALL ON FUNCTION public.delete_historical_import(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.delete_historical_import_v2(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.delete_historical_import_v3(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.delete_historical_import_v4(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.delete_historical_import(uuid)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.delete_historical_import_v2(uuid)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.delete_historical_import_v3(uuid)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.delete_historical_import_v4(uuid)
TO authenticated, service_role;


-- ============================================================
-- Organization trigger functions
--
-- PostgreSQL triggers can continue invoking these functions.
-- Browser/API clients do not need direct EXECUTE privileges.
-- ============================================================

REVOKE ALL ON FUNCTION public.create_default_organization_classes()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_organization_owner_membership()
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- Coach account linking
-- ============================================================

REVOKE ALL ON FUNCTION public.link_current_user_to_coach()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.link_current_user_to_coach()
TO authenticated, service_role;


-- ============================================================
-- IMPORTANT:
-- Do NOT revoke anonymous access from intentionally public RPCs:
--
-- get_public_event_portal(uuid)
-- get_public_registration_events()
-- get_public_tournament_portal(text, uuid)
-- ============================================================
