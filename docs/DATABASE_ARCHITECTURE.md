# ClayKeeper Database Architecture

## Core hierarchy

```text
Organization
  Season
    Event
      Shoot
        Registration / Enrollment
          Squad assignment
            Score entries
              Shoot-off scores
```

## Organization-level records

These records remain available across seasons: organizations, organization members, athletes/participants, teams, coaches, classes, disciplines, locations, sponsors, and user permissions.

## Season-level records

A season groups events for one operating year. Exactly one season may be active per organization. Closing a season archives its events and preserves all registrations, squads, scores, awards, and financial history.

Records that do not carry into a new season: events, registrations, payments, squads, scores, awards, and event-specific notes.

Records that remain available: teams, coaches, participants, classes, disciplines, locations, sponsors, and organization configuration.

## Event and shoot model

An event belongs to one season. An event may contain multiple shoots. The 2026 US Open is represented as one event with Trap, Skeet, and Sporting Clays shoots.

## Historical imports

Every import creates a `historical_imports` audit record containing the source filename, worksheet, mapping, counts, summary, user, timestamps, and completion status. Imported rows must remain linked to their season and event.

Importers are format-specific:

- US Open workbook
- Trap series workbook
- Skeet series workbook
- Sporting Clays series workbook
- Custom mapping wizard

## Financial model direction

Registration charges, payments, refunds, organization fees, and deposits should be stored as transactions rather than only calculated totals. This will support treasurer reports, audit trails, outstanding balances, deposit reports, and exports.

## Close-out rules

Closing a season:

1. Marks the season closed.
2. Archives its events.
3. Prevents normal operational edits.
4. Preserves historical reports and imported source references.
5. Allows a new clean season to be activated.
