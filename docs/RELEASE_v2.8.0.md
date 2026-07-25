# ClayKeeper v2.8.0 — ActiveNet Participant Match Center

- Moves ActiveNet out of Seasons & Historical Imports.
- Adds a dedicated ActiveNet Participant Import page.
- Imports participant name, gender, guardian, season, session, and age only.
- Compares each ActiveNet record with the existing participant directory.
- Supports exact matches, reviewed possible matches, new participants, and skipped records.
- Stores ActiveNet registration history separately from shoots, scores, squads, and events.
- Requires migration `20260729120000_activenet_participant_registry.sql`.
