-- ============================================================
-- ClayKeeper
-- Require every participant to have an organization-local
-- Participant Number.
--
-- The preceding migration automatically assigns numbers to all
-- new participants. This migration safely handles any older
-- rows before enforcing NOT NULL.
-- ============================================================


-- ============================================================
-- BACKFILL LEGACY PARTICIPANTS
-- ============================================================

do $$
declare
  v_row record;
begin
  for v_row in
    select
      id,
      organization_id,
      extract(year from created_at)::integer as creation_year
    from public.athletes
    where participant_number is null
    order by created_at, id
  loop
    update public.athletes
    set participant_number =
      public.next_participant_number(
        v_row.organization_id,
        v_row.creation_year
      )
    where id = v_row.id
      and participant_number is null;
  end loop;
end;
$$;


-- ============================================================
-- ENFORCE PARTICIPANT NUMBER
-- ============================================================

alter table public.athletes
alter column participant_number set not null;


comment on column public.athletes.participant_number
is 'Permanent required organization-local ClayKeeper Participant Number in YYYY-##### format. Automatically assigned at participant creation.';
