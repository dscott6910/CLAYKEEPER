-- ClayKeeper Event Builder structured fields
-- Run once in the Supabase SQL Editor before deploying the new Events page.

alter table public.events
  add column if not exists event_year integer,
  add column if not exists discipline text,
  add column if not exists event_type text,
  add column if not exists location_name text,
  add column if not exists host_sponsor text;

alter table public.events
  drop constraint if exists events_event_year_check;

alter table public.events
  add constraint events_event_year_check
  check (event_year is null or event_year >= 2023);

alter table public.events
  drop constraint if exists events_discipline_check;

alter table public.events
  add constraint events_discipline_check
  check (
    discipline is null
    or discipline in ('Trap', 'Skeet', 'Sporting Clays', 'Bunker')
  );

alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
  check (
    event_type is null
    or event_type in (
      'Series 1',
      'Series 2',
      'Series 3',
      'Series 4',
      'Series 5',
      'Series 6',
      'State All',
      'State Junior',
      'State Senior',
      'US Open'
    )
  );

create index if not exists events_event_builder_idx
  on public.events (
    organization_id,
    event_year,
    discipline,
    event_type
  );
