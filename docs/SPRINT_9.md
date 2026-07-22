# Sprint 9.0 - Live Leaderboard and TV Mode

## Added

- New Live Leaderboard module at `/leaderboard`
- Event and shoot selection
- Overall, class, and team leaderboard views
- Automatic refresh every 15 seconds
- Manual refresh and last-updated indicator
- Full-screen TV mode for clubhouse displays
- Shoot-off values used as tie-break information
- Participant and completed-score summary cards
- Route-level lazy loading for the new module

## Database

No new Supabase migration is required. The module reads the existing registration, squad, scoring, and shoot-off tables.
