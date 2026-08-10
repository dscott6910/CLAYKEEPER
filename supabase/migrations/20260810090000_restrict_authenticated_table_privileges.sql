-- Restrict unnecessary direct table privileges for authenticated clients.
--
-- Browser/API users require normal row-level CRUD privileges where RLS
-- permits them, but do not require TRUNCATE, TRIGGER, or REFERENCES.
--
-- Existing SELECT/INSERT/UPDATE/DELETE grants and all RLS policies remain
-- unchanged. service_role privileges are intentionally unchanged.

REVOKE TRUNCATE, TRIGGER, REFERENCES
ON TABLE
  public.athletes,
  public.classes,
  public.registration_shoots,
  public.registrations,
  public.squad_members,
  public.squads,
  public.teams,
  public.digital_scorecard_station_scores,
  public.digital_scorecards,
  public.score_entries,
  public.scorecard_templates,
  public.shoot_off_rounds,
  public.shoot_off_scores
FROM authenticated;

-- Prevent tables subsequently created by the migration role from
-- automatically granting these privileges to authenticated clients.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE TRUNCATE, TRIGGER, REFERENCES
ON TABLES
FROM authenticated;
