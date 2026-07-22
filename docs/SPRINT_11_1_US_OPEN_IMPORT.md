# Sprint 11.1 - 2026 US Open Import

This sprint adds a workbook-specific importer for `REVISED US OPEN 2026 SCORES.xlsx`.

## Workbook handling

- Reads all three worksheets: SKEET, SPORTING CLAYS, and TRAP.
- Creates one historical event with three completed shoots.
- Treats the mislabeled `TRAP 1`, `TRAP 2`, etc. columns on the SKEET sheet as Skeet rounds.
- Imports up to eight 25-target Trap rounds.
- Imports the six populated Skeet rounds in the supplied workbook.
- Preserves Sporting Clays total scores even though individual station scores are not present.
- Preserves first-100 totals and result/award notes such as First, Second, Third, and Shoot-Off.
- Ignores the workbook's formatted blank rows.

## Data model

Run migration `20260722220000_us_open_import_fields.sql` before importing. It adds historical totals and result notes to registration-shoot records so reports can use imported totals.

## Safety

The importer previews every discipline entry and blocks import when a row has a hard error. Total discrepancies are warnings so the original workbook values remain visible for review.
