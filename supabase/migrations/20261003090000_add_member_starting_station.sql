alter table public.squad_members
  add column if not exists starting_station text;

alter table public.squad_members
  add constraint squad_members_starting_station_not_blank
  check (
    starting_station is null
    or length(trim(starting_station)) > 0
  );

comment on column public.squad_members.starting_station is
  'Participant-specific starting station supplied by roster import.';
