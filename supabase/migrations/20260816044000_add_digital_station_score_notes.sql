begin;

alter table public.digital_scorecard_station_scores
  add column if not exists notes text;

create or replace function public.save_digital_scorecard_atomic(
  p_organization_id uuid,
  p_event_id uuid,
  p_shoot_id uuid,
  p_squad_member_id uuid,
  p_course_id uuid,
  p_scorecard_id uuid,
  p_status text,
  p_malfunction_count integer,
  p_verified_by_1 text,
  p_verified_by_2 text,
  p_entered_by_name text,
  p_notes text,
  p_expected_updated_at timestamptz,
  p_station_scores jsonb
)
returns table(scorecard_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scorecard_id uuid;
  v_updated_at timestamptz := clock_timestamp();
  v_total_score integer := 0;
  v_total_targets integer := 0;
  v_station jsonb;
begin
  if not public.has_organization_role(
    p_organization_id,
    array['owner','admin','coach','scorekeeper']
  ) then
    raise exception 'Not authorized to write digital scoring';
  end if;

  if p_status not in ('draft', 'finalized') then
    raise exception 'Invalid scorecard status';
  end if;

  if p_malfunction_count < 0 or p_malfunction_count > 3 then
    raise exception 'Invalid malfunction count';
  end if;

  if jsonb_typeof(coalesce(p_station_scores, '[]'::jsonb)) <> 'array' then
    raise exception 'Station scores must be an array';
  end if;

  for v_station in
    select value
    from jsonb_array_elements(coalesce(p_station_scores, '[]'::jsonb))
  loop
    if (v_station->>'hits')::integer < 0
      or (v_station->>'targets')::integer < 0
      or (v_station->>'hits')::integer > (v_station->>'targets')::integer
    then
      raise exception 'Invalid station score';
    end if;

    v_total_score :=
      v_total_score + (v_station->>'hits')::integer;

    v_total_targets :=
      v_total_targets + (v_station->>'targets')::integer;
  end loop;

  if p_scorecard_id is not null then
    update public.digital_scorecards as dsc
    set
      status = p_status,
      malfunction_count = p_malfunction_count,
      verified_by_1 = nullif(trim(p_verified_by_1), ''),
      verified_by_2 = nullif(trim(p_verified_by_2), ''),
      entered_by_name = nullif(trim(p_entered_by_name), ''),
      notes = nullif(trim(p_notes), ''),
      total_score = v_total_score,
      total_targets = v_total_targets,
      finalized_at =
        case
          when p_status = 'finalized' then v_updated_at
          else null
        end,
      updated_at = v_updated_at
    where dsc.id = p_scorecard_id
      and dsc.organization_id = p_organization_id
      and dsc.event_id = p_event_id
      and dsc.shoot_id = p_shoot_id
      and dsc.squad_member_id = p_squad_member_id
      and dsc.course_id = p_course_id
      and dsc.status = 'draft'
      and (
        p_expected_updated_at is null
        or dsc.updated_at = p_expected_updated_at
      )
    returning dsc.id into v_scorecard_id;

    if v_scorecard_id is null then
      raise exception 'CK_SCORECARD_CONFLICT';
    end if;
  else
    if exists (
      select 1
      from public.digital_scorecards as dsc
      where dsc.organization_id = p_organization_id
        and dsc.event_id = p_event_id
        and dsc.squad_member_id = p_squad_member_id
    ) then
      raise exception 'CK_SCORECARD_CONFLICT';
    end if;

    insert into public.digital_scorecards (
      organization_id,
      event_id,
      shoot_id,
      squad_member_id,
      course_id,
      status,
      malfunction_count,
      verified_by_1,
      verified_by_2,
      entered_by_name,
      notes,
      total_score,
      total_targets,
      finalized_at,
      updated_at
    )
    values (
      p_organization_id,
      p_event_id,
      p_shoot_id,
      p_squad_member_id,
      p_course_id,
      p_status,
      p_malfunction_count,
      nullif(trim(p_verified_by_1), ''),
      nullif(trim(p_verified_by_2), ''),
      nullif(trim(p_entered_by_name), ''),
      nullif(trim(p_notes), ''),
      v_total_score,
      v_total_targets,
      case
        when p_status = 'finalized' then v_updated_at
        else null
      end,
      v_updated_at
    )
    returning id into v_scorecard_id;
  end if;

  delete from public.digital_scorecard_station_scores as dscss
  where dscss.scorecard_id = v_scorecard_id;

  insert into public.digital_scorecard_station_scores (
    organization_id,
    event_id,
    shoot_id,
    scorecard_id,
    station_id,
    hits,
    notes,
    updated_at
  )
  select
    p_organization_id,
    p_event_id,
    p_shoot_id,
    v_scorecard_id,
    (row->>'stationId')::uuid,
    (row->>'hits')::integer,
    nullif(trim(coalesce(row->>'notes', '')), ''),
    v_updated_at
  from jsonb_array_elements(
    coalesce(p_station_scores, '[]'::jsonb)
  ) row;

  return query
  select v_scorecard_id, v_updated_at;

exception
  when unique_violation then
    raise exception 'CK_SCORECARD_CONFLICT';
end;
$$;

revoke all on function public.save_digital_scorecard_atomic(
  uuid, uuid, uuid, uuid, uuid, uuid, text, integer,
  text, text, text, text, timestamptz, jsonb
) from public;

grant execute on function public.save_digital_scorecard_atomic(
  uuid, uuid, uuid, uuid, uuid, uuid, text, integer,
  text, text, text, text, timestamptz, jsonb
) to authenticated;

commit;
