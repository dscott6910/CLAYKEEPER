-- Round-total entry and mobile scoring may both be edited when needed.
-- Keep the mobile workflow available in code for future use, but do not
-- prevent either scoring source from being updated by the other.
drop trigger if exists prevent_round_score_when_mobile_finalized
on public.score_entries;

drop trigger if exists prevent_mobile_score_when_round_entered
on public.digital_scorecards;

drop function if exists public.prevent_round_score_when_mobile_finalized();
drop function if exists public.prevent_mobile_score_when_round_entered();
