-- Harden anonymous database access.
--
-- Public browser access is provided exclusively through the explicitly
-- approved SECURITY DEFINER RPCs:
--
--   get_public_event_portal(uuid)
--   get_public_registration_events()
--   get_public_tournament_portal(text, uuid)
--
-- Anonymous clients do not require direct table or sequence access.
-- Authenticated and service_role privileges are intentionally unchanged.

-- ============================================================
-- Revoke direct table access from anon
-- ============================================================

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
FROM anon;

-- ============================================================
-- Revoke direct sequence access from anon
-- ============================================================

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
FROM anon;

-- ============================================================
-- Prevent future tables/sequences created by the migration role
-- from automatically restoring anonymous privileges.
-- ============================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON TABLES
FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON SEQUENCES
FROM anon;

-- Function EXECUTE privileges are intentionally not changed here.
-- Anonymous access remains available only to the explicitly public
-- RPC functions hardened by the preceding migrations.
