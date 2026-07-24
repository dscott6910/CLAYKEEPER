# ClayKeeper v2.3.6 — Import Progress and Full Cleanup

- Adds a live percentage progress bar during Trap Series imports.
- Shows processed entries and current import stage.
- Shows a compact progress bar for active imports in history.
- Links the event to the import immediately and verifies that link.
- Adds `delete_historical_import_v4`, which deletes partial or completed event data before removing import history.
- Recovers older partial imports by their event external ID when `event_id` was not saved.
