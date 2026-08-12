-- Fix generic trigger evaluation for tables without event_id.
-- Keep optional discount-code event validation inside its table branch.

-- ClayKeeper Production QA Sprint 4 corrective migration
--
-- Fix the digital_scorecards organization-consistency check.
--
-- public.squads does not contain event_id.
-- A squad belongs to a shoot, and the shoot has the event_id.
-- The shoot/event relationship is already validated separately, so
-- squad-member validation should verify organization + shoot consistency.

create or replace function public.assert_claykeeper_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'event_registration_settings' then

    if not exists (
      select 1
      from public.events e
      where e.id = new.event_id
        and e.organization_id = new.organization_id
    ) then
      raise exception
        'Event does not belong to the supplied organization';
    end if;

  elsif tg_table_name = 'discount_codes' then

    if new.event_id is not null then
      if not exists (
        select 1
        from public.events e
        where e.id = new.event_id
          and e.organization_id = new.organization_id
      ) then
        raise exception
          'Discount-code event does not belong to the supplied organization';
      end if;
    end if;

  elsif tg_table_name = 'payment_transactions' then

    if not exists (
      select 1
      from public.registrations r
      where r.id = new.registration_id
        and r.organization_id = new.organization_id
    ) then
      raise exception
        'Payment registration does not belong to the supplied organization';
    end if;

  elsif tg_table_name = 'digital_scorecards' then

    if not exists (
      select 1
      from public.events e
      where e.id = new.event_id
        and e.organization_id = new.organization_id
    )

    or not exists (
      select 1
      from public.shoots s
      where s.id = new.shoot_id
        and s.event_id = new.event_id
        and s.organization_id = new.organization_id
    )

    or not exists (
      select 1
      from public.event_courses c
      where c.id = new.course_id
        and c.event_id = new.event_id
        and c.organization_id = new.organization_id
    )

    or not exists (
      select 1
      from public.squad_members sm
      join public.squads sq
        on sq.id = sm.squad_id
      where sm.id = new.squad_member_id
        and sm.organization_id = new.organization_id
        and sm.shoot_id = new.shoot_id
        and sq.organization_id = new.organization_id
        and sq.shoot_id = new.shoot_id
    ) then

      raise exception
        'Digital scorecard references records outside its organization/event/shoot';

    end if;

  elsif tg_table_name = 'digital_scorecard_station_scores' then

    if not exists (
      select 1
      from public.digital_scorecards d
      where d.id = new.scorecard_id
        and d.organization_id = new.organization_id
        and d.event_id = new.event_id
        and d.shoot_id = new.shoot_id
    )

    or not exists (
      select 1
      from public.course_stations cs
      join public.event_courses ec
        on ec.id = cs.course_id
      where cs.id = new.station_id
        and cs.organization_id = new.organization_id
        and ec.event_id = new.event_id
        and ec.organization_id = new.organization_id
    ) then

      raise exception
        'Station score references records outside its scorecard organization/event/shoot';

    end if;

  elsif tg_table_name = 'activenet_participant_records' then

    if not exists (
      select 1
      from public.activenet_imports i
      where i.id = new.import_id
        and i.organization_id = new.organization_id
    ) then
      raise exception
        'ActiveNet record import does not belong to the supplied organization';
    end if;

    if new.athlete_id is not null
      and not exists (
        select 1
        from public.athletes a
        where a.id = new.athlete_id
          and a.organization_id = new.organization_id
      ) then

      raise exception
        'ActiveNet athlete does not belong to the supplied organization';

    end if;

  end if;

  return new;
end;
$$;

revoke all
on function public.assert_claykeeper_org_consistency()
from public, anon, authenticated;
