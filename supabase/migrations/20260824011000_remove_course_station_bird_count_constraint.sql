-- Remove the hard database cap on station bird counts.
-- The Course Builder UI still controls the normal allowed values, but the
-- database will no longer reject saved course rows because of a bird-count
-- check constraint.

alter table public.course_stations
  drop constraint if exists course_stations_bird_count_check;
