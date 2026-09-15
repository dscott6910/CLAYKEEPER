-- Enforce the score-source lock for all roles, including administrators.
create or replace function public.prevent_round_score_when_mobile_finalized()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.digital_scorecards d where d.squad_member_id = new.squad_member_id and d.event_id = new.event_id and d.shoot_id = new.shoot_id and d.status = 'finalized') then
    raise exception 'This participant has a finalized mobile scorecard. Edit that scorecard instead of entering a round total.';
  end if;
  return new;
end; $$;

create or replace function public.prevent_mobile_score_when_round_entered()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.score_entries s where s.squad_member_id = new.squad_member_id and s.event_id = new.event_id and s.shoot_id = new.shoot_id and s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'This participant already has a round-total score. Edit the round total instead of using mobile scoring.';
  end if;
  return new;
end; $$;
