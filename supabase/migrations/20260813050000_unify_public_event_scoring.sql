-- Unify the event-specific public spectator portal with ClayKeeper's
-- operational scoring sources.
--
-- Priority for public score display:
--   1. Live Scoring score_entries when any round entries exist.
--   2. Historical imported total when present.
--   3. Digital scorecard totals.
--
-- The manually opened event-specific public portal may display active draft
-- shoots. Public visibility remains protected by public_event_settings.is_public.
--
-- No scoring records are modified by this migration.

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
    'stats', v_stats
  );
end;
$$;

revoke all on function public.get_public_event_portal(uuid) from public;
grant execute on function public.get_public_event_portal(uuid)
to anon, authenticated;

alter function public.get_public_event_portal(uuid)
set search_path = '';
