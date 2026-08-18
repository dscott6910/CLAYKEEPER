-- ============================================================
-- ClayKeeper
-- Migration: Organization-scoped Participant Numbers
--
-- Format:
--   YYYY-#####
--
-- Examples:
--   2026-00001
--   2026-00002
--
-- Rules:
--   * Generated automatically by the database.
--   * Sequence is independent for every organization.
--   * Sequence resets for each creation year.
--   * Different organizations may have identical numbers.
--   * Participant numbers are permanent after assignment.
--   * Existing valid imported Participant Numbers are preserved.
-- ============================================================


-- ============================================================
-- PARTICIPANT NUMBER COUNTERS
-- ============================================================

create table public.participant_number_counters (
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  creation_year integer not null,

  last_number integer not null default 0,

  primary key (
    organization_id,
    creation_year
  ),

  constraint participant_number_counters_year_valid
    check (creation_year between 2000 and 9999),

  constraint participant_number_counters_number_valid
    check (last_number between 0 and 99999)
);

comment on table public.participant_number_counters
is 'Internal annual counters for organization-local ClayKeeper Participant Numbers.';


-- The browser never needs direct access to the counters.
revoke all privileges
on table public.participant_number_counters
from anon, authenticated;


-- ============================================================
-- PARTICIPANT NUMBER COLUMN
-- ============================================================

alter table public.athletes
add column participant_number text;

alter table public.athletes
add constraint athletes_participant_number_format
check (
  participant_number is null
  or (
    participant_number ~ '^[0-9]{4}-[0-9]{5}$'
    and substring(participant_number from 6 for 5)::integer
      between 1 and 99999
  )
);


-- The same Participant Number may exist in different
-- organizations, but never twice inside one organization.

create unique index athletes_participant_number_unique_idx
  on public.athletes (
    organization_id,
    participant_number
  )
  where participant_number is not null;


comment on column public.athletes.participant_number
is 'Permanent organization-local ClayKeeper Participant Number in YYYY-##### format.';


-- ============================================================
-- NUMBER GENERATOR
-- ============================================================

create or replace function public.next_participant_number(
  p_organization_id uuid,
  p_creation_year integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number integer;
begin
  if p_organization_id is null then
    raise exception
      'Organization is required for Participant Number generation.';
  end if;

  if p_creation_year is null
     or p_creation_year < 2000
     or p_creation_year > 9999 then
    raise exception
      'Invalid participant creation year: %',
      p_creation_year;
  end if;

  insert into public.participant_number_counters (
    organization_id,
    creation_year,
    last_number
  )
  values (
    p_organization_id,
    p_creation_year,
    1
  )
  on conflict (
    organization_id,
    creation_year
  )
  do update
    set last_number =
      public.participant_number_counters.last_number + 1
  returning last_number
  into v_number;

  if v_number > 99999 then
    raise exception
      'Participant Number limit reached for organization % in year %.',
      p_organization_id,
      p_creation_year;
  end if;

  return
    p_creation_year::text
    || '-'
    || lpad(v_number::text, 5, '0');
end;
$$;


-- Number generation is internal to the insert trigger.
revoke all
on function public.next_participant_number(uuid, integer)
from public, anon, authenticated;


-- ============================================================
-- AUTOMATIC ASSIGNMENT
-- ============================================================

create or replace function public.assign_participant_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer;
  v_supplied_number integer;
begin
  -- ----------------------------------------------------------
  -- Preserve a supplied valid Participant Number.
  --
  -- Imports may contain an existing ClayKeeper Participant
  -- Number. Advance that organization's annual counter so the
  -- automatic generator can never later reuse the same range.
  -- ----------------------------------------------------------

  if new.participant_number is not null then
    if new.participant_number !~ '^[0-9]{4}-[0-9]{5}$'
       or substring(
            new.participant_number
            from 6 for 5
          )::integer not between 1 and 99999
    then
      raise exception
        'Participant Number must use YYYY-##### format.';
    end if;

    v_year :=
      substring(
        new.participant_number
        from 1 for 4
      )::integer;

    v_supplied_number :=
      substring(
        new.participant_number
        from 6 for 5
      )::integer;

    insert into public.participant_number_counters (
      organization_id,
      creation_year,
      last_number
    )
    values (
      new.organization_id,
      v_year,
      v_supplied_number
    )
    on conflict (
      organization_id,
      creation_year
    )
    do update
      set last_number =
        greatest(
          public.participant_number_counters.last_number,
          excluded.last_number
        );

    return new;
  end if;


  -- ----------------------------------------------------------
  -- Generate a new Participant Number.
  -- ----------------------------------------------------------

  v_year :=
    extract(
      year from coalesce(new.created_at, now())
    )::integer;

  new.participant_number :=
    public.next_participant_number(
      new.organization_id,
      v_year
    );

  return new;
end;
$$;


revoke all
on function public.assign_participant_number()
from public, anon, authenticated;


create trigger athletes_assign_participant_number
before insert on public.athletes
for each row
execute function public.assign_participant_number();


-- ============================================================
-- PREVENT PARTICIPANT NUMBER CHANGES
-- ============================================================

create or replace function public.prevent_participant_number_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.participant_number is distinct from new.participant_number
     and old.participant_number is not null then
    raise exception
      'Participant Number cannot be changed after assignment.';
  end if;

  return new;
end;
$$;


revoke all
on function public.prevent_participant_number_change()
from public, anon, authenticated;


create trigger athletes_prevent_participant_number_change
before update of participant_number on public.athletes
for each row
execute function public.prevent_participant_number_change();
