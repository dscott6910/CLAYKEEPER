-- Support courses and scorecard templates with up to 20 birds per station.
-- Course station counts have no database cap; this validates the template grid.

alter table public.scorecard_templates
  alter column grid_columns set default 20;

alter table public.scorecard_templates
  drop constraint if exists scorecard_templates_grid_columns_check;

alter table public.scorecard_templates
  add constraint scorecard_templates_grid_columns_check
  check (grid_columns between 1 and 20);
