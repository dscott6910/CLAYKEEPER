# ClayKeeper v2.4.1 — Event Maintenance

Adds an owner/admin maintenance page for inspecting duplicate and orphaned events.

## Features

- Lists every event with its date, status, creation time, external ID, and import file.
- Shows counts for shoots, registrations, score entries, and linked import records.
- Flags duplicate event names and import-style events without a linked import record.
- Safely deletes an event through the `delete_event_maintenance` Supabase function.
- Preserves shared participants, teams, classes, and locations.

## Required SQL

Run `RUN_THIS_SQL_FIRST_event_maintenance_delete.sql` in the Supabase SQL Editor before using Delete Event.
