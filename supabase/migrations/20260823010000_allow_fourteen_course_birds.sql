alter table public.course_stations
  drop constraint if exists course_stations_bird_count_check;

alter table public.course_stations
  add constraint course_stations_bird_count_check
  check (bird_count between 0 and 14);

alter table public.scorecard_templates
  alter column grid_columns set default 14;

alter table public.scorecard_templates
  drop constraint if exists scorecard_templates_grid_columns_check;

alter table public.scorecard_templates
  add constraint scorecard_templates_grid_columns_check
  check (grid_columns between 1 and 14);
