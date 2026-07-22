# Sprint 11 — Seasons and Historical Shoot Import

## Added

- Season records with planning, active, closed, and archived states.
- Only one active season per organization.
- Season close-out archives linked events while preserving registrations, squads, scores, and financial history.
- New **Seasons & Imports** management page.
- Excel, XLS, and CSV workbook parsing.
- Automatic recognition of common participant, team, class, squad, post, score-round, total, CYSSA number, and payment columns.
- Import preview with row-level warnings and errors.
- Historical import audit records.
- Creation or matching of teams, classes, athletes, registrations, squads, squad members, and round scores.
- Initial defaults for the **2026 US Open** test import.

## Required database step

Run `supabase/migrations/20260722160000_seasons_and_historical_imports.sql` in Supabase before opening the new page.

## Required frontend step

Run `npm install` in `frontend` to install the Excel parser dependency, then run `npm run build`.

## Initial import assumptions

The first worksheet is imported. Round headers should resemble `R1`, `R2`, `Round 1`, or similar. The preview must contain no errors before import is enabled. A later refinement can add a visual column-mapping screen after the real 2026 US Open workbook is reviewed.
