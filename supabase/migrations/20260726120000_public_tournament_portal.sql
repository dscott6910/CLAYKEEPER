-- ClayKeeper Sprint 19: Public Tournament Portal
-- Exposes only tournament-safe information through a read-only SECURITY DEFINER RPC.

create or replace function public.get_public_tournament_portal(
  p_organization_slug text default null,
  p_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_org public.organizations%rowtype;
  v_event public.events%rowtype;
  v_events jsonb := '[]'::jsonb;
  v_shoots jsonb := '[]'::jsonb;
  v_entries jsonb := '[]'::jsonb;
  v_stats jsonb := '{}'::jsonb;
begin
  select o.* into v_org
  from public.organizations o
  where o.active = true
    and (p_organization_slug is null or lower(o.slug) = lower(p_organization_slug))
    and exists (
      select 1 from public.events e
      where e.organization_id = o.id
        and e.active = true
        and e.status in ('published','registration_open','registration_closed','in_progress','completed')
    )
  order by case when p_organization_slug is not null then 0 else 1 end, o.name
  limit 1;

  if v_org.id is null then
    return jsonb_build_object('organization', null, 'events', '[]'::jsonb, 'selectedEvent', null, 'shoots', '[]'::jsonb, 'entries', '[]'::jsonb, 'stats', '{}'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'description', e.description,
    'seriesName', e.series_name,
    'sponsorName', e.sponsor_name,
    'startDate', e.start_date,
    'endDate', e.end_date,
    'status', e.status
  ) order by coalesce(e.start_date, current_date) desc, e.name), '[]'::jsonb)
  into v_events
  from public.events e
  where e.organization_id = v_org.id
    and e.active = true
    and e.status in ('published','registration_open','registration_closed','in_progress','completed');

  select e.* into v_event
  from public.events e
  where e.organization_id = v_org.id
    and e.active = true
    and e.status in ('published','registration_open','registration_closed','in_progress','completed')
    and (p_event_id is null or e.id = p_event_id)
  order by
    case when e.status = 'in_progress' then 0 when e.status in ('published','registration_open','registration_closed') then 1 else 2 end,
    coalesce(e.start_date, current_date) desc
  limit 1;

  if v_event.id is null then
    return jsonb_build_object(
      'organization', jsonb_build_object('id', v_org.id, 'name', v_org.name, 'slug', v_org.slug, 'logoUrl', v_org.logo_url, 'website', v_org.website),
      'events', v_events,
      'selectedEvent', null,
      'shoots', '[]'::jsonb,
      'entries', '[]'::jsonb,
      'stats', '{}'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'discipline', s.discipline,
    'shootDate', s.shoot_date,
    'startTime', s.start_time,
    'status', s.status,
    'targetsPerRound', s.targets_per_round,
    'numberOfRounds', s.number_of_rounds,
    'locationName', l.name
  ) order by s.shoot_date, s.start_time nulls last, s.name), '[]'::jsonb)
  into v_shoots
  from public.shoots s
  left join public.locations l on l.id = s.location_id
  where s.event_id = v_event.id
    and s.active = true
    and s.status not in ('draft','cancelled','archived');

  select coalesce(jsonb_agg(row_data order by (row_data->>'shootName'), (row_data->>'totalScore')::int desc, row_data->>'participantName'), '[]'::jsonb)
  into v_entries
  from (
    select jsonb_build_object(
      'registrationShootId', rs.id,
      'shootId', s.id,
      'shootName', s.name,
      'discipline', s.discipline,
      'participantName', trim(concat_ws(' ', coalesce(nullif(a.preferred_name,''), a.first_name), a.last_name)),
      'teamName', coalesce(t.name, 'Independent'),
      'classCode', coalesce(c.code, '—'),
      'className', coalesce(c.display_name, 'Unclassified'),
      'squadNumber', sq.squad_number,
      'squadName', sq.name,
      'houseNumber', sq.house_number,
      'courseName', sq.course_name,
      'stationName', sq.station_name,
      'startTime', sq.start_time,
      'post', sm.position,
      'positionLabel', sm.position_label,
      'checkedIn', coalesce(rs.checked_in, r.checked_in, false),
      'scoreRounds', coalesce(scores.rounds, 0),
      'expectedRounds', s.number_of_rounds,
      'totalScore', coalesce(rs.historical_total_score, scores.total_score, 0),
      'shootOffTotal', coalesce(shoot_off.total_score, 0),
      'resultNote', rs.result_note,
      'awardPublished', coalesce(ap.status in ('published','locked'), false)
    ) as row_data
    from public.registration_shoots rs
    join public.registrations r on r.id = rs.registration_id
    join public.athletes a on a.id = r.athlete_id
    join public.shoots s on s.id = rs.shoot_id
    left join public.teams t on t.id = r.team_id
    left join public.classes c on c.id = r.class_id
    left join public.squad_members sm on sm.registration_shoot_id = rs.id and sm.status not in ('withdrawn','no_show')
    left join public.squads sq on sq.id = sm.squad_id
    left join lateral (
      select count(se.id)::int as rounds, coalesce(sum(se.score),0)::int as total_score
      from public.score_entries se
      where se.squad_member_id = sm.id and se.status <> 'disqualified'
    ) scores on true
    left join lateral (
      select coalesce(sum(sos.score),0)::int as total_score
      from public.shoot_off_scores sos
      where sos.squad_member_id = sm.id
    ) shoot_off on true
    left join public.award_publications ap on ap.shoot_id = s.id
    where rs.event_id = v_event.id
      and rs.status not in ('withdrawn','cancelled','disqualified')
      and s.active = true
      and s.status not in ('draft','cancelled','archived')
  ) q;

  select jsonb_build_object(
    'registeredParticipants', count(distinct r.id),
    'checkedInParticipants', count(distinct r.id) filter (where r.checked_in = true),
    'totalSquads', (select count(*) from public.squads sq join public.shoots s on s.id = sq.shoot_id where s.event_id = v_event.id and sq.status <> 'cancelled'),
    'completedSquads', (select count(*) from public.squads sq join public.shoots s on s.id = sq.shoot_id where s.event_id = v_event.id and sq.status = 'completed'),
    'publishedShoots', (select count(*) from public.award_publications ap where ap.event_id = v_event.id and ap.status in ('published','locked'))
  ) into v_stats
  from public.registrations r
  where r.event_id = v_event.id and r.status not in ('withdrawn','cancelled','disqualified');

  return jsonb_build_object(
    'organization', jsonb_build_object('id', v_org.id, 'name', v_org.name, 'slug', v_org.slug, 'logoUrl', v_org.logo_url, 'website', v_org.website),
    'events', v_events,
    'selectedEvent', jsonb_build_object('id', v_event.id, 'name', v_event.name, 'description', v_event.description, 'seriesName', v_event.series_name, 'sponsorName', v_event.sponsor_name, 'startDate', v_event.start_date, 'endDate', v_event.end_date, 'status', v_event.status),
    'shoots', v_shoots,
    'entries', v_entries,
    'stats', v_stats
  );
end;
$$;

revoke all on function public.get_public_tournament_portal(text, uuid) from public;
grant execute on function public.get_public_tournament_portal(text, uuid) to anon, authenticated;

comment on function public.get_public_tournament_portal(text, uuid)
is 'Returns a privacy-safe public tournament payload containing only published/active event information, squad assignments, scores, and published result state.';
