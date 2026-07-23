# Sprint 17.1 - Event Operations Compatibility Patch

## Fixes

- Corrected the Event Operations score timeline query to use the existing `score_entries.entered_at` column.
- Removed the invalid dependency on `score_entries.created_at`.
- Preserved `updated_at` as the preferred timestamp when a score has been edited.
- Updated the frontend version to 1.6.1.

## Database changes

No Supabase migration is required.

## Installation

Merge this patch into the ClayKeeper project root, then restart the frontend.
