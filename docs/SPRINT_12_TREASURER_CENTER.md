# Sprint 12 - Treasurer Center

Adds a season-aware financial reporting workspace for ClayKeeper.

## Features

- Filter by season, event, payment status, and participant/team search.
- Expected revenue from event fees plus shoot fee snapshots.
- Amount paid and outstanding balance totals.
- Organization/CYSSA fee totals.
- Event financial summary.
- Participant-level ledger.
- CSV export and print support.
- Historical import guidance when source workbooks do not include payment transactions.

## Database changes

No migration is required. The report reads existing `seasons`, `events`, `registrations`, `registration_shoots`, `shoots`, `athletes`, `teams`, and `classes` data.
