-- ClayKeeper Production Readiness QA Sprint 5
-- Season lifecycle and historical integrity hardening.
--
-- Goals:
--   1. Archived seasons are immutable at the database layer.
--   2. Events cannot be moved into or out of archived seasons.
--   3. Events assigned to archived seasons cannot be deleted.
--   4. Frozen season-final records cannot be updated or deleted.
--   5. Season finalization verifies live scoring completeness on the server
--      instead of trusting only client-supplied summary JSON.

-- ---------------------------------------------------------------------------
-- Archived season immutability
-- ---------------------------------------------------------------------------

create or replace function public.prevent_archived_season_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'archived' then
      raise exception 'Archived seasons are immutable and cannot be deleted';
    end if;
    return old;
  end if;

  if old.status = 'archived' then
    raise exception 'Archived seasons are immutable and cannot be modified';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_archived_season_mutation() from public, anon, authenticated;

drop trigger if exists seasons_prevent_archived_mutation on public.seasons;
create trigger seasons_prevent_archived_mutation
before update or delete on public.seasons
for each row execute function public.prevent_archived_season_mutation();

-- ---------------------------------------------------------------------------
-- Event assignment integrity for archived seasons
-- ---------------------------------------------------------------------------

create or replace function public.protect_archived_season_event_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  if old.season_id is not null then
    select status into v_old_status
    from public.seasons
    where id = old.season_id
      and organization_id = old.organization_id;
  end if;

  if tg_op = 'DELETE' then
    if v_old_status = 'archived' then
      raise exception 'Events belonging to an archived season cannot be deleted';
    end if;
    return old;
  end if;

  if new.season_id is distinct from old.season_id then
    if v_old_status = 'archived' then
      raise exception 'Events cannot be removed from an archived season';
    end if;

    if new.season_id is not null then
      select status into v_new_status
      from public.seasons
      where id = new.season_id
        and organization_id = new.organization_id;

      if v_new_status is null then
        raise exception 'Target season does not belong to this organization';
      end if;

      if v_new_status = 'archived' then
        raise exception 'Events cannot be assigned to an archived season';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_archived_season_event_membership() from public, anon, authenticated;

drop trigger if exists events_protect_archived_season_membership on public.events;
create trigger events_protect_archived_season_membership
before update of season_id or delete on public.events
for each row execute function public.protect_archived_season_event_membership();

-- ---------------------------------------------------------------------------
-- Frozen final-record immutability
-- ---------------------------------------------------------------------------

create or replace function public.prevent_season_final_record_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Finalized season records are immutable';
end;
$$;

revoke all on function public.prevent_season_final_record_mutation() from public, anon, authenticated;

drop trigger if exists season_final_records_immutable on public.season_final_records;
create trigger season_final_records_immutable
before update or delete on public.season_final_records
for each row execute function public.prevent_season_final_record_mutation();

-- ---------------------------------------------------------------------------
-- Server-verified finalization
-- ---------------------------------------------------------------------------

create or replace function public.finalize_season_records(
  p_season_id uuid,
  p_scoring_rule text,
  p_individual_standings jsonb,
  p_team_standings jsonb,
  p_qualification_snapshot jsonb,
  p_event_snapshot jsonb,
  p_summary jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season public.seasons%rowtype;
  v_record_id uuid;
  v_event_count integer;
  v_registered_athletes integer;
  v_missing_enrollment integer;
  v_incomplete_shoots integer;
  v_draft_scorecards integer;
begin
  select * into v_season
  from public.seasons
  where id = p_season_id
  for update;

  if v_season.id is null then
    raise exception 'Season not found';
  end if;

  if not public.has_organization_role(v_season.organization_id, array['owner','admin']) then
    raise exception 'Only an organization owner or administrator can finalize a season';
  end if;

  if v_season.status = 'archived' then
    raise exception 'This season has already been archived';
  end if;

  if exists (
    select 1
    from public.season_final_records
    where season_id = p_season_id
  ) then
    raise exception 'This season has already been finalized';
  end if;

  select count(*)::integer
  into v_event_count
  from public.events e
  where e.organization_id = v_season.organization_id
    and e.season_id = p_season_id;

  if v_event_count = 0 then
    raise exception 'Season cannot be finalized because no tournaments are assigned';
  end if;

  -- Match the season standings source: only registrations with status=registered
  -- participate in the live digital-scoring calculation.
  select count(distinct r.id)::integer
  into v_registered_athletes
  from public.registrations r
  join public.events e on e.id = r.event_id
  where e.organization_id = v_season.organization_id
    and e.season_id = p_season_id
    and r.organization_id = v_season.organization_id
    and r.status = 'registered';

  if v_registered_athletes = 0 then
    raise exception 'Season cannot be finalized because no registered athlete results are available';
  end if;

  -- A registered athlete with no registered shoot enrollment is incomplete.
  select count(*)::integer
  into v_missing_enrollment
  from public.registrations r
  join public.events e on e.id = r.event_id
  where e.organization_id = v_season.organization_id
    and e.season_id = p_season_id
    and r.organization_id = v_season.organization_id
    and r.status = 'registered'
    and not exists (
      select 1
      from public.registration_shoots rs
      where rs.organization_id = r.organization_id
        and rs.event_id = r.event_id
        and rs.registration_id = r.id
        and rs.status = 'registered'
    );

  if v_missing_enrollment > 0 then
    raise exception 'Season cannot be finalized: % registered athlete(s) have no active shoot enrollment', v_missing_enrollment;
  end if;

  -- Every registered shoot enrollment must have an active squad member and a
  -- finalized digital scorecard. This mirrors the frontend season-completion
  -- rule while enforcing it independently on the server.
  select count(*)::integer
  into v_incomplete_shoots
  from public.registration_shoots rs
  join public.registrations r on r.id = rs.registration_id
  join public.events e on e.id = rs.event_id
  where e.organization_id = v_season.organization_id
    and e.season_id = p_season_id
    and rs.organization_id = v_season.organization_id
    and rs.status = 'registered'
    and r.organization_id = v_season.organization_id
    and r.status = 'registered'
    and not exists (
      select 1
      from public.squad_members sm
      join public.digital_scorecards d
        on d.squad_member_id = sm.id
       and d.organization_id = v_season.organization_id
       and d.event_id = rs.event_id
       and d.shoot_id = rs.shoot_id
       and d.status = 'finalized'
      where sm.organization_id = v_season.organization_id
        and sm.registration_shoot_id = rs.id
        and sm.shoot_id = rs.shoot_id
        and sm.status <> 'withdrawn'
    );

  if v_incomplete_shoots > 0 then
    raise exception 'Season cannot be finalized: % registered shoot enrollment(s) are missing a finalized scorecard', v_incomplete_shoots;
  end if;

  select count(*)::integer
  into v_draft_scorecards
  from public.digital_scorecards d
  join public.events e on e.id = d.event_id
  where e.organization_id = v_season.organization_id
    and e.season_id = p_season_id
    and d.organization_id = v_season.organization_id
    and d.status <> 'finalized';

  if v_draft_scorecards > 0 then
    raise exception 'Season cannot be finalized while % draft scorecard(s) remain', v_draft_scorecards;
  end if;

  -- Basic snapshot-shape checks prevent a stale/empty client payload from
  -- creating a final record even when live data is complete.
  if jsonb_typeof(coalesce(p_individual_standings, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_individual_standings) = 0 then
    raise exception 'Season finalization requires individual standings';
  end if;

  if jsonb_typeof(coalesce(p_event_snapshot, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_event_snapshot) <> v_event_count then
    raise exception 'Season finalization event snapshot does not match the assigned tournament count';
  end if;

  insert into public.season_final_records (
    organization_id,
    season_id,
    season_name,
    season_start_date,
    season_end_date,
    scoring_rule,
    individual_standings,
    team_standings,
    qualification_snapshot,
    event_snapshot,
    summary,
    finalized_by
  ) values (
    v_season.organization_id,
    v_season.id,
    v_season.name,
    v_season.start_date,
    v_season.end_date,
    p_scoring_rule,
    coalesce(p_individual_standings, '[]'::jsonb),
    coalesce(p_team_standings, '[]'::jsonb),
    coalesce(p_qualification_snapshot, '{}'::jsonb),
    coalesce(p_event_snapshot, '[]'::jsonb),
    coalesce(p_summary, '{}'::jsonb),
    auth.uid()
  )
  returning id into v_record_id;

  update public.seasons
  set status = 'archived',
      closed_at = coalesce(closed_at, now()),
      closed_by = coalesce(closed_by, auth.uid())
  where id = p_season_id;

  return v_record_id;
end;
$$;

revoke all on function public.finalize_season_records(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.finalize_season_records(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
