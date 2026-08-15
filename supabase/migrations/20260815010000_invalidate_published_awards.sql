-- ClayKeeper: invalidate approved/published awards when competitive data changes.
--
-- Only changes that can affect award eligibility, grouping, placement, or
-- scoring should invalidate an official award publication.

create or replace function public.invalidate_awards_for_shoot(
  p_shoot_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_shoot_id is null then
    return;
  end if;

  update public.award_publications
  set
    status = 'provisional',
    approved_at = null,
    approved_by = null,
    published_at = null,
    published_by = null,
    locked_at = null,
    locked_by = null
  where shoot_id = p_shoot_id
    and status in ('approved', 'published');
end;
$function$;


create or replace function public.invalidate_awards_from_competitive_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    perform public.invalidate_awards_for_shoot(old.shoot_id);
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform public.invalidate_awards_for_shoot(new.shoot_id);
    return new;
  end if;

  -- UPDATE:
  -- invalidate both shoots if a record is moved from one shoot to another.
  perform public.invalidate_awards_for_shoot(old.shoot_id);

  if new.shoot_id is distinct from old.shoot_id then
    perform public.invalidate_awards_for_shoot(new.shoot_id);
  end if;

  return new;
end;
$function$;


-- =========================================================
-- REGULAR SCORE ENTRIES
-- score, round and status directly affect award calculations.
-- =========================================================

drop trigger if exists score_entries_invalidate_awards
  on public.score_entries;

create trigger score_entries_invalidate_awards
after insert or delete or update of
  score,
  round_number,
  status,
  squad_member_id,
  shoot_id
on public.score_entries
for each row
execute function public.invalidate_awards_from_competitive_change();


-- =========================================================
-- SHOOT-OFF SCORES
-- =========================================================

drop trigger if exists shoot_off_scores_invalidate_awards
  on public.shoot_off_scores;

create trigger shoot_off_scores_invalidate_awards
after insert or delete or update of
  score,
  shoot_off_round_id,
  squad_member_id,
  shoot_id
on public.shoot_off_scores
for each row
execute function public.invalidate_awards_from_competitive_change();


-- =========================================================
-- SHOOT-OFF ROUNDS
-- Round order/definition affects tie resolution.
-- =========================================================

drop trigger if exists shoot_off_rounds_invalidate_awards
  on public.shoot_off_rounds;

create trigger shoot_off_rounds_invalidate_awards
after insert or delete or update of
  round_number,
  label,
  shoot_id
on public.shoot_off_rounds
for each row
execute function public.invalidate_awards_from_competitive_change();


-- =========================================================
-- SQUAD MEMBERSHIP
-- Membership, squad and position can affect squad awards.
-- Administrative/noncompetitive updates do not invalidate.
-- =========================================================

drop trigger if exists squad_members_invalidate_awards
  on public.squad_members;

create trigger squad_members_invalidate_awards
after insert or delete or update of
  squad_id,
  registration_shoot_id,
  position,
  position_label,
  shoot_id
on public.squad_members
for each row
execute function public.invalidate_awards_from_competitive_change();


-- =========================================================
-- REGISTRATION SHOOT / ENROLLMENT
-- These fields are directly loaded by reports.ts.
-- Do not invalidate for fee or other administrative changes.
-- =========================================================

drop trigger if exists registration_shoots_invalidate_awards
  on public.registration_shoots;

create trigger registration_shoots_invalidate_awards
after insert or delete or update of
  status,
  historical_total_score,
  historical_first_100_total,
  squad_assignment_status,
  shoot_id
on public.registration_shoots
for each row
execute function public.invalidate_awards_from_competitive_change();


comment on function public.invalidate_awards_for_shoot(uuid)
is 'Returns approved or published awards for a shoot to provisional after competitive data changes.';

comment on function public.invalidate_awards_from_competitive_change()
is 'Trigger helper that invalidates awards for the affected shoot or shoots.';
