# Import finalization reliability - v2.3.5

- Saves `imported_row_count` every 10 rows during Trap Series imports.
- Checks and surfaces Supabase errors when progress cannot be saved.
- Checks and surfaces errors from the final historical import update.
- Re-reads the import record to verify status, row count, and completion time.
- Shows a final completion progress message only after database verification succeeds.

No database migration is required.
