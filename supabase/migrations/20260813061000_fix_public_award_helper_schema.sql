
create or replace function public.ordinal_suffix(p_place integer)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when (p_place % 100) between 11 and 13 then 'th'
    when (p_place % 10) = 1 then 'st'
    when (p_place % 10) = 2 then 'nd'
    when (p_place % 10) = 3 then 'rd'
    else 'th'
  end;
$$;

create or replace function public.get_public_event_portal(p_event_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_org public.organizations%rowtype;
  v_settings public.public_event_settings%rowtype;
  v_shoots jsonb := '[]'::jsonb;
  v_entries jsonb := '[]'::jsonb;
  v_awards jsonb := '[]'::jsonb;
  v_stats jsonb := '{}'::jsonb;
begin
  select e.* into v_event
  from public.events e
  where e.id = p_event_id
    and e.active = true;

  if v_event.id is null then
    return jsonb_build_object('available', false, 'reason', 'not_found');
  end if;

  select s.* into v_settings
  from public.public_event_settings s
  where s.event_id = v_event.id;

  if v_settings.id is null or v_settings.is_public is not true then
    return jsonb_build_object('available', false, 'reason', 'not_public');
  end if;

  select o.* into v_org
  from public.organizations o
  where o.id = v_event.organization_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sh.id,
        'name', sh.name,
        'discipline', sh.discipline,
        'shootDate', sh.shoot_date,
        'startTime', sh.start_time,
        'status', sh.status
      )
      order by sh.shoot_date, sh.start_time nulls last, sh.name
    ),
    '[]'::jsonb
  )
  into v_shoots
  from public.shoots sh
  where sh.event_id = v_event.id
    and sh.active = true
    and sh.status not in ('cancelled', 'archived');

  select coalesce(
    jsonb_agg(
      row_data
      order by
        case row_data->>'scoreStatus'
          when 'finalized' then 0
          when 'draft' then 1
          else 2
        end,
        (row_data->>'totalScore')::int desc,
        (row_data->>'shootOffTotal')::int desc,
        row_data->>'participantName'
    ),
    '[]'::jsonb
  )
  into v_entries
  from (
    select jsonb_build_object(
      'registrationShootId', rs.id,
      'shootId', sh.id,
      'shootName', sh.name,
      'discipline', sh.discipline,
      'participantName',
        trim(concat_ws(
          ' ',
          coalesce(nullif(a.preferred_name, ''), a.first_name),
          a.last_name
        )),
      'teamName', coalesce(t.name, 'Independent'),
      'classCode', coalesce(c.code, '—'),
      'className', coalesce(c.display_name, 'Unclassified'),

      'squadNumber',
        case when v_settings.show_squads then sq.squad_number else null end,
      'courseName',
        case when v_settings.show_squads then sq.course_name else null end,
      'startTime',
        case when v_settings.show_squads then sq.start_time else null end,
      'post',
        case when v_settings.show_squads then sm.position else null end,
      'positionLabel',
        case when v_settings.show_squads then sm.position_label else null end,

      'checkedIn', coalesce(r.checked_in, false),

      'scoreStatus',
        case
          when not v_settings.show_live_scores
               and coalesce(ap.status, '') <> 'published'
            then 'hidden'

          when live_scores.rounds > 0
               and live_scores.rounds >= sh.number_of_rounds
            then 'finalized'

          when live_scores.rounds > 0
            then 'draft'

          when rs.historical_total_score is not null
            then 'finalized'

          when ds.status = 'finalized'
            then 'finalized'

          when ds.id is not null
            then 'draft'

          else 'missing'
        end,

      'totalScore',
        case
          when v_settings.show_live_scores
               or coalesce(ap.status, '') = 'published'
          then
            case
              when live_scores.rounds > 0
                then live_scores.total_score
              when rs.historical_total_score is not null
                then rs.historical_total_score
              else coalesce(ds.total_score, 0)
            end
          else 0
        end,

      'totalTargets',
        case
          when v_settings.show_live_scores
               or coalesce(ap.status, '') = 'published'
          then
            case
              when live_scores.rounds > 0
                then live_scores.rounds * sh.targets_per_round
              when rs.historical_total_score is not null
                then sh.number_of_rounds * sh.targets_per_round
              else coalesce(ds.total_targets, 0)
            end
          else 0
        end,

      'shootOffTotal',
        case
          when v_settings.show_live_scores
               or coalesce(ap.status, '') = 'published'
            then coalesce(shoot_off.total_score, 0)
          else 0
        end,

      'updatedAt',
        coalesce(live_scores.updated_at, ds.updated_at),

      'awardPublished',
        coalesce(ap.status = 'published', false)

    ) as row_data

    from public.registration_shoots rs

    join public.registrations r
      on r.id = rs.registration_id

    join public.athletes a
      on a.id = r.athlete_id

    join public.shoots sh
      on sh.id = rs.shoot_id

    left join public.teams t
      on t.id = r.team_id

    left join public.classes c
      on c.id = r.class_id

    left join public.squad_members sm
      on sm.registration_shoot_id = rs.id
     and sm.status <> 'withdrawn'

    left join public.squads sq
      on sq.id = sm.squad_id

    left join public.digital_scorecards ds
      on ds.squad_member_id = sm.id
     and ds.shoot_id = sh.id

    left join public.award_publications ap
      on ap.shoot_id = sh.id

    left join lateral (
      select
        count(se.id)::int as rounds,
        coalesce(sum(se.score), 0)::int as total_score,
        max(se.updated_at) as updated_at
      from public.score_entries se
      where se.squad_member_id = sm.id
        and se.shoot_id = sh.id
        and se.score is not null
        and se.status <> 'disqualified'
    ) live_scores on true

    left join lateral (
      select
        coalesce(sum(sos.score), 0)::int as total_score
      from public.shoot_off_scores sos
      where sos.squad_member_id = sm.id
        and sos.shoot_id = sh.id
    ) shoot_off on true

    where rs.event_id = v_event.id
      and rs.status not in ('withdrawn', 'cancelled', 'disqualified')
      and sh.active = true
      and sh.status not in ('cancelled', 'archived')
  ) q;


  /*
   * Official published individual awards.
   *
   * Ranking source follows the same score priority as the public standings:
   * Live Scoring -> historical total -> digital scorecard.
   *
   * Competitive order:
   * regulation score DESC, then each shoot-off round DESC.
   *
   * Manual award_overrides replace the calculated participant for the
   * corresponding group/key/placement.
   */
  with published_shoots as (
    select
      ap.event_id,
      ap.shoot_id,
      coalesce((ap.settings->>'overallPlaces')::int, 0) as overall_places,
      coalesce((ap.settings->>'classPlaces')::int, 0) as class_places
    from public.award_publications ap
    where ap.event_id = v_event.id
      and ap.status = 'published'
  ),
  competitors as (
    select
      rs.id as registration_shoot_id,
      sh.id as shoot_id,
      sh.name as shoot_name,
      trim(concat_ws(
        ' ',
        coalesce(nullif(a.preferred_name, ''), a.first_name),
        a.last_name
      )) as participant_name,
      coalesce(t.name, 'Independent') as team_name,
      coalesce(c.code, '—') as class_code,

      case
        when live_scores.rounds > 0 then live_scores.total_score
        when rs.historical_total_score is not null then rs.historical_total_score
        else coalesce(ds.total_score, 0)
      end as total_score,

      coalesce(so.shoot_off_scores, '[]'::jsonb) as shoot_off_scores,
      coalesce(so.shoot_off_sort, array[]::integer[]) as shoot_off_sort,

      ps.overall_places,
      ps.class_places

    from published_shoots ps

    join public.shoots sh
      on sh.id = ps.shoot_id

    join public.registration_shoots rs
      on rs.shoot_id = sh.id
     and rs.event_id = v_event.id

    join public.registrations r
      on r.id = rs.registration_id

    join public.athletes a
      on a.id = r.athlete_id

    left join public.teams t
      on t.id = r.team_id

    left join public.classes c
      on c.id = r.class_id

    left join public.squad_members sm
      on sm.registration_shoot_id = rs.id
     and sm.status <> 'withdrawn'

    left join public.digital_scorecards ds
      on ds.squad_member_id = sm.id
     and ds.shoot_id = sh.id

    left join lateral (
      select
        count(se.id)::int as rounds,
        coalesce(sum(se.score), 0)::int as total_score
      from public.score_entries se
      where se.squad_member_id = sm.id
        and se.shoot_id = sh.id
        and se.score is not null
        and se.status <> 'disqualified'
    ) live_scores on true

    left join lateral (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'roundNumber', sor.round_number,
              'score', sos.score
            )
            order by sor.round_number
          ) filter (where sos.id is not null),
          '[]'::jsonb
        ) as shoot_off_scores,
        coalesce(
          array_agg(sos.score order by sor.round_number)
            filter (where sos.id is not null),
          array[]::integer[]
        ) as shoot_off_sort
      from public.shoot_off_scores sos
      join public.shoot_off_rounds sor
        on sor.id = sos.shoot_off_round_id
      where sos.squad_member_id = sm.id
        and sos.shoot_id = sh.id
    ) so on true

    where rs.status not in ('withdrawn', 'cancelled', 'disqualified')
      and (
        live_scores.rounds >= sh.number_of_rounds
        or rs.historical_total_score is not null
        or ds.status = 'finalized'
      )
  ),
  ranked as (
    select
      c.*,

      row_number() over (
        partition by c.shoot_id
        order by
          c.total_score desc,
          c.shoot_off_sort desc,
          c.participant_name
      ) as overall_place,

      row_number() over (
        partition by c.shoot_id, c.class_code
        order by
          c.total_score desc,
          c.shoot_off_sort desc,
          c.participant_name
      ) as class_place

    from competitors c
  ),
  calculated_awards as (
    select
      r.registration_shoot_id,
      r.shoot_id,
      r.shoot_name,
      r.participant_name,
      r.team_name,
      r.class_code,
      'overall'::text as award_group,
      'overall'::text as award_key,
      r.overall_place::int as placement,
      case
        when r.overall_place = 1 then 'Overall Champion'
        else 'Overall ' || r.overall_place::text || public.ordinal_suffix(r.overall_place::int) || ' Place'
      end as calculated_title,
      r.total_score,
      r.shoot_off_scores
    from ranked r
    where r.overall_place <= r.overall_places

    union all

    select
      r.registration_shoot_id,
      r.shoot_id,
      r.shoot_name,
      r.participant_name,
      r.team_name,
      r.class_code,
      'class'::text,
      r.class_code,
      r.class_place::int,
      case
        when r.class_place = 1 then r.class_code || ' Champion'
        else r.class_code || ' ' || r.class_place::text || public.ordinal_suffix(r.class_place::int) || ' Place'
      end,
      r.total_score,
      r.shoot_off_scores
    from ranked r
    where r.class_place <= r.class_places
  ),
  final_awards as (
    select
      coalesce(ao.registration_shoot_id, ca.registration_shoot_id) as registration_shoot_id,
      ca.shoot_id,
      ca.shoot_name,
      coalesce(
        nullif(
          trim(concat_ws(
            ' ',
            coalesce(nullif(oa.preferred_name, ''), oa.first_name),
            oa.last_name
          )),
          ''
        ),
        ca.participant_name
      ) as participant_name,
      coalesce(ot.name, ca.team_name) as team_name,
      coalesce(oc.code, ca.class_code) as class_code,
      ca.award_group,
      ca.award_key,
      ca.placement,
      coalesce(nullif(ao.title, ''), ca.calculated_title) as title,
      ao.note,
      case
        when ao.id is null then ca.total_score
        else
          case
            when ols.rounds > 0 then ols.total_score
            when ors.historical_total_score is not null then ors.historical_total_score
            else coalesce(ods.total_score, 0)
          end
      end as total_score,
      case
        when ao.id is null then ca.shoot_off_scores
        else coalesce(oso.shoot_off_scores, '[]'::jsonb)
      end as shoot_off_scores,
      (ao.id is not null) as overridden

    from calculated_awards ca

    left join public.award_overrides ao
      on ao.shoot_id = ca.shoot_id
     and ao.award_group = ca.award_group
     and ao.award_key = ca.award_key
     and ao.placement = ca.placement

    left join public.registration_shoots ors
      on ors.id = ao.registration_shoot_id

    left join public.registrations orr
      on orr.id = ors.registration_id

    left join public.athletes oa
      on oa.id = orr.athlete_id

    left join public.teams ot
      on ot.id = orr.team_id

    left join public.classes oc
      on oc.id = orr.class_id

    left join public.squad_members osm
      on osm.registration_shoot_id = ors.id
     and osm.status <> 'withdrawn'

    left join public.digital_scorecards ods
      on ods.squad_member_id = osm.id
     and ods.shoot_id = ca.shoot_id

    left join lateral (
      select
        count(se.id)::int as rounds,
        coalesce(sum(se.score), 0)::int as total_score
      from public.score_entries se
      where se.squad_member_id = osm.id
        and se.shoot_id = ca.shoot_id
        and se.score is not null
        and se.status <> 'disqualified'
    ) ols on true

    left join lateral (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'roundNumber', sor.round_number,
              'score', sos.score
            )
            order by sor.round_number
          ) filter (where sos.id is not null),
          '[]'::jsonb
        ) as shoot_off_scores
      from public.shoot_off_scores sos
      join public.shoot_off_rounds sor
        on sor.id = sos.shoot_off_round_id
      where sos.squad_member_id = osm.id
        and sos.shoot_id = ca.shoot_id
    ) oso on true
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registrationShootId', fa.registration_shoot_id,
        'shootId', fa.shoot_id,
        'shootName', fa.shoot_name,
        'participantName', fa.participant_name,
        'teamName', fa.team_name,
        'classCode', fa.class_code,
        'awardGroup', fa.award_group,
        'awardKey', fa.award_key,
        'placement', fa.placement,
        'title', fa.title,
        'note', fa.note,
        'totalScore', fa.total_score,
        'shootOffScores', fa.shoot_off_scores,
        'overridden', fa.overridden
      )
      order by
        fa.shoot_name,
        case fa.award_group when 'overall' then 0 else 1 end,
        fa.award_key,
        fa.placement
    ),
    '[]'::jsonb
  )
  into v_awards
  from final_awards fa;

  select jsonb_build_object(
    'registered',
      count(distinct r.id),

    'checkedIn',
      count(distinct r.id) filter (where r.checked_in = true),

    'assigned',
      (
        select count(*)
        from public.squad_members sm
        join public.registration_shoots rs
          on rs.id = sm.registration_shoot_id
        where rs.event_id = v_event.id
          and sm.status <> 'withdrawn'
      ),

    'started',
      (
        select count(distinct sm.id)
        from public.squad_members sm
        join public.registration_shoots rs
          on rs.id = sm.registration_shoot_id
        left join public.score_entries se
          on se.squad_member_id = sm.id
         and se.score is not null
         and se.status <> 'disqualified'
        left join public.digital_scorecards ds
          on ds.squad_member_id = sm.id
        where rs.event_id = v_event.id
          and sm.status <> 'withdrawn'
          and (se.id is not null or ds.id is not null)
      ),

    'finalized',
      (
        select count(*)
        from (
          select sm.id
          from public.squad_members sm
          join public.registration_shoots rs
            on rs.id = sm.registration_shoot_id
          join public.shoots sh
            on sh.id = rs.shoot_id
          left join public.digital_scorecards ds
            on ds.squad_member_id = sm.id
           and ds.shoot_id = sh.id
          left join lateral (
            select count(se.id)::int as rounds
            from public.score_entries se
            where se.squad_member_id = sm.id
              and se.shoot_id = sh.id
              and se.score is not null
              and se.status <> 'disqualified'
          ) live_scores on true
          where rs.event_id = v_event.id
            and sm.status <> 'withdrawn'
            and (
              live_scores.rounds >= sh.number_of_rounds
              or ds.status = 'finalized'
              or rs.historical_total_score is not null
            )
        ) completed
      ),

    'publishedShoots',
      (
        select count(*)
        from public.award_publications ap
        where ap.event_id = v_event.id
          and ap.status = 'published'
      ),

    'lastUpdatedAt',
      greatest(
        (
          select max(se.updated_at)
          from public.score_entries se
          where se.event_id = v_event.id
        ),
        (
          select max(ds.updated_at)
          from public.digital_scorecards ds
          where ds.event_id = v_event.id
        )
      )
  )
  into v_stats
  from public.registrations r
  where r.event_id = v_event.id
    and r.status not in ('withdrawn', 'cancelled', 'disqualified');

  return jsonb_build_object(
    'available', true,

    'organization',
      jsonb_build_object(
        'id', v_org.id,
        'name', v_org.name,
        'slug', v_org.slug,
        'logoUrl', v_org.logo_url,
        'website', v_org.website
      ),

    'event',
      jsonb_build_object(
        'id', v_event.id,
        'name', v_event.name,
        'description', v_event.description,
        'seriesName', v_event.series_name,
        'sponsorName', v_event.sponsor_name,
        'startDate', v_event.start_date,
        'endDate', v_event.end_date,
        'status', v_event.status
      ),

    'settings',
      jsonb_build_object(
        'showLiveScores', v_settings.show_live_scores,
        'showSquads', v_settings.show_squads,
        'showTeams', v_settings.show_teams,
        'showAwards', v_settings.show_awards,
        'displayModeEnabled', v_settings.display_mode_enabled,
        'publicMessage', v_settings.public_message
      ),

    'shoots', v_shoots,
    'entries', v_entries,
    'awards', v_awards,
    'stats', v_stats
  );
end;
$$;

revoke all on function public.ordinal_suffix(integer) from public;

revoke all on function public.get_public_event_portal(uuid) from public;
grant execute on function public.get_public_event_portal(uuid)
to anon, authenticated;

alter function public.get_public_event_portal(uuid)
set search_path = '';
