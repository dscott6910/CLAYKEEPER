-- ClayKeeper Sprint 11.1: fields required to preserve historical US Open results.
alter table public.registration_shoots
  add column if not exists historical_total_score integer,
  add column if not exists historical_first_100_total integer,
  add column if not exists result_note text,
  add column if not exists source_sheet text;

alter table public.registration_shoots
  drop constraint if exists registration_shoots_historical_total_nonnegative;
alter table public.registration_shoots
  add constraint registration_shoots_historical_total_nonnegative
  check (historical_total_score is null or historical_total_score >= 0);

alter table public.registration_shoots
  drop constraint if exists registration_shoots_first_100_nonnegative;
alter table public.registration_shoots
  add constraint registration_shoots_first_100_nonnegative
  check (historical_first_100_total is null or historical_first_100_total >= 0);
