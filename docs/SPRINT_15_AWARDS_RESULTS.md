# Sprint 15 — Awards & Results Center

Adds `/awards` with:

- Overall and class awards
- Team totals with configurable scoring-team size
- Squad totals with configurable minimum squad size
- Automatic tie detection and shoot-off ordering
- Draft, published, and locked states
- CSV export, print support, and TV mode
- Historical score support through `historical_total_score`

Apply `supabase/migrations/20260724120000_awards_results_center.sql` before using publish/lock controls.

Frontend version: `1.4.0`.
