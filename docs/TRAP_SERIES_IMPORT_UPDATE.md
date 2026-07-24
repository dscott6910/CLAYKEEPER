# Trap Series Import Update

- Invalid workbook rows no longer block the entire import.
- Rows with validation errors are shown in red and skipped; valid rows remain importable.
- Import history is displayed on Seasons & Imports.
- Administrators can delete a completed import. Deletion removes the imported event and its shoots, registrations, squads, scores, awards, and event payment records.
- Shared participants, teams, classes, and locations remain available because another event may use them.
- Apply migration `20260728120000_historical_import_delete.sql` before using Delete Import.
