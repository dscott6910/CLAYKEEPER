# ClayKeeper v2.7.0 - Permanent ActiveNet Registration Import

## Purpose

ClayKeeper now includes a reusable ActiveNet registration importer on the Seasons & Historical Import page. It accepts Excel and CSV exports and uses flexible column aliases rather than requiring one exact report layout.

## Supported fields

- Participant name
- Participant gender
- Primary parent/guardian name
- ActiveNet season name
- Session name
- Participant age
- Outstanding balance

## Import behavior

- Requires a ClayKeeper season, registration event name, and registration date.
- Validates required columns before database changes begin.
- Recognizes Trap, Skeet, Sporting Clays, and Bunker sessions.
- Matches existing athletes by normalized first and last name.
- Creates missing athletes without guessing team, class, or CYSSA number.
- Preserves gender and parent/guardian details when available.
- Creates one registration per athlete and one discipline enrollment per ActiveNet session.
- Displays a row preview, summary counts, progress bar, cancellation control, errors, and warnings.
- Records the import in Imported Workbook History.
- Uses the existing Cleanup Import action to remove partial or incorrect ActiveNet imports while preserving shared athlete records.

## Uploaded report verification

The supplied 2025-2026 ActiveNet workbook contains:

- 1,516 source rows
- 900 unique participant names
- 847 Trap rows
- 282 Skeet rows
- 224 Sporting Clays rows
- 161 Bunker rows
- 2 blank/non-registration rows that will be flagged and skipped

The report does not contain team, class, CYSSA number, email, phone, address, or ActiveNet participant ID. ClayKeeper does not invent these values.
