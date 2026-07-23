# Sprint 18 – Platform Stabilization & UX Enhancement

Version: 1.7.0

## Improvements

- Added organization-scoped global search for participants, teams, events, and shoots.
- Added Command-K / Control-K keyboard access and a persistent search launcher.
- Added debounced search requests, grouped results, empty states, loading states, and user-facing errors.
- Added a top-level application error boundary so unexpected runtime failures display a recoverable screen instead of a blank white page.
- Updated the displayed and package versions to 1.7.0.
- No database migration is required.

## Compatibility

Global search uses the existing athletes, teams, events, and shoots tables and is scoped to the signed-in user's organization.
