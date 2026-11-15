# CYSSA Awards Engine v2.4.0

Implemented from the supplied Sporting Clays, Skeet, and Trap awards notes.

## Included
- Series individual awards: 1st-3rd in IA, IE, R, JV, VR, and YA.
- State individual awards: 1st-5th in IA, IE, and R; 1st-3rd in JV, VR, and YA.
- Individual ties use ordered shoot-off rounds.
- Squad awards by class with 3-person senior squads and 2-or-3-person junior squads.
- State Team High 3 for Sporting Clays and Skeet, and State Team High 5 for Trap.
- Series Team High 3 for Sporting Clays and Skeet, and Series Team High 5 for Trap.
- Team results combine all eligible classes into one category. YA and CS shooters remain in individual results but are excluded from team totals.
- Team results show contributing shooters and the next available shooter as a team tie-break reference.
- CSV and print output for every report view.

## Rules still requiring an official decision
The supplied notes leave the final tie-breaker undefined for some squad, state-team, and cumulative series-team awards. ClayKeeper marks those ties as unresolved rather than inventing a rule.

## Data limitation
Team category is currently derived from participant class because the existing teams table does not yet store the formal CYSSA team category. A future team-directory update should add that field for organizations that need explicit High School, Gun Club, Junior School, and Junior Gun Club distinctions.
