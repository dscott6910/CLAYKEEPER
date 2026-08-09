-- ClayKeeper Public Spectator Portal v3.6

create table if not exists public.public_event_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  is_public boolean not null default false,
  show_live_scores boolean not null default false,
  show_squads boolean not null default true,
  show_teams boolean not null default true,
  show_awards boolean not null default true,
  display_mode_enabled boolean not null default true,
  public_message text,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_event_settings_event_unique unique (event_id)
);

create index if not exists public_event_settings_org_event_idx
  on public.public_event_settings(organization_id, event_id);

alter table public.public_event_settings enable row level security;

drop policy if exists "Members can view public event settings" on public.public_event_settings;
create policy "Members can view public event settings"
on public.public_event_settings for select to authenticated
using ((select public.is_organization_member(organization_id)));

drop policy if exists "Owners admins and coaches can create public event settings" on public.public_event_settings;
create policy "Owners admins and coaches can create public event settings"
on public.public_event_settings for insert to authenticated
with check ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));

drop policy if exists "Owners admins and coaches can update public event settings" on public.public_event_settings;
create policy "Owners admins and coaches can update public event settings"
on public.public_event_settings for update to authenticated
using ((select public.has_organization_role(organization_id, array['owner','admin','coach'])))
with check ((select public.has_organization_role(organization_id, array['owner','admin','coach'])));

drop trigger if exists public_event_settings_set_updated_at on public.public_event_settings;
create trigger public_event_settings_set_updated_at
before update on public.public_event_settings
for each row execute function public.set_updated_at();

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
  where e.id = p_event_id and e.active = true;

  if v_event.id is null then
    return jsonb_build_object('available', false, 'reason', 'not_found');
  end if;

  select s.* into v_settings
  from public.public_event_settings s
  where s.event_id = v_event.id;

  if v_settings.id is null or v_settings.is_public is not true then
    return jsonb_build_object('available', false, 'reason', 'not_public');
  end if;

  select o.* into v_org from public.organizations o where o.id = v_event.organization_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sh.id,
    'name', sh.name,
    'discipline', sh.discipline,
    'shootDate', sh.shoot_date,
    'startTime', sh.start_time,
    'status', sh.status
  ) order by sh.shoot_date, sh.start_time nulls last, sh.name), '[]'::jsonb)
  into v_shoots
  from public.shoots sh
  where sh.event_id = v_event.id
    and sh.active = true
    and sh.status not in ('draft','cancelled','archived');

  select coalesce(jsonb_agg(row_data order by
    case row_data->>'scoreStatus' when 'finalized' then 0 when 'draft' then 1 else 2 end,
    (row_data->>'totalScore')::int desc,
    row_data->>'participantName'
  ), '[]'::jsonb)
  into v_entries
  from (
    select jsonb_build_object(
      'registrationShootId', rs.id,
      'shootId', sh.id,
      'shootName', sh.name,
      'discipline', sh.discipline,
      'participantName', trim(concat_ws(' ', coalesce(nullif(a.preferred_name,''), a.first_name), a.last_name)),
      'teamName', coalesce(t.name, 'Independent'),
      'classCode', coalesce(c.code, '—'),
      'className', coalesce(c.display_name, 'Unclassified'),
      'squadNumber', case when v_settings.show_squads then sq.squad_number else null end,
      'courseName', case when v_settings.show_squads then sq.course_name else null end,
      'startTime', case when v_settings.show_squads then sq.start_time else null end,
      'post', case when v_settings.show_squads then sm.position else null end,
      'positionLabel', case when v_settings.show_squads then sm.position_label else null end,
      'checkedIn', coalesce(r.checked_in, false),
      'scoreStatus', case
        when v_settings.show_live_scores then coalesce(ds.status, 'missing')
        when coalesce(ap.status, '') = 'published' then coalesce(ds.status, 'missing')
        else 'hidden'
      end,
      'totalScore', case
        when v_settings.show_live_scores or coalesce(ap.status, '') = 'published'
          then coalesce(ds.total_score, 0)
        else 0
      end,
      'totalTargets', case
        when v_settings.show_live_scores or coalesce(ap.status, '') = 'published'
          then coalesce(ds.total_targets, 0)
        else 0
      end,
      'updatedAt', ds.updated_at,
      'awardPublished', coalesce(ap.status = 'published', false)
    ) as row_data
    from public.registration_shoots rs
    join public.registrations r on r.id = rs.registration_id
    join public.athletes a on a.id = r.athlete_id
    join public.shoots sh on sh.id = rs.shoot_id
    left join public.teams t on t.id = r.team_id
    left join public.classes c on c.id = r.class_id
    left join public.squad_members sm on sm.registration_shoot_id = rs.id and sm.status <> 'withdrawn'
    left join public.squads sq on sq.id = sm.squad_id
    left join public.digital_scorecards ds on ds.squad_member_id = sm.id and ds.shoot_id = sh.id
    left join public.award_publications ap on ap.shoot_id = sh.id
    where rs.event_id = v_event.id
      and rs.status not in ('withdrawn','cancelled','disqualified')
      and sh.active = true
      and sh.status not in ('draft','cancelled','archived')
  ) q;

  select jsonb_build_object(
    'registered', count(distinct r.id),
    'checkedIn', count(distinct r.id) filter (where r.checked_in = true),
    'assigned', (select count(*) from public.squad_members sm join public.registration_shoots rs on rs.id = sm.registration_shoot_id where rs.event_id = v_event.id and sm.status <> 'withdrawn'),
    'started', (select count(*) from public.digital_scorecards ds where ds.event_id = v_event.id),
    'finalized', (select count(*) from public.digital_scorecards ds where ds.event_id = v_event.id and ds.status = 'finalized'),
    'publishedShoots', (select count(*) from public.award_publications ap where ap.event_id = v_event.id and ap.status = 'published'),
    'lastUpdatedAt', (select max(ds.updated_at) from public.digital_scorecards ds where ds.event_id = v_event.id)
  ) into v_stats
  from public.registrations r
  where r.event_id = v_event.id and r.status not in ('withdrawn','cancelled','disqualified');

  return jsonb_build_object(
    'available', true,
    'organization', jsonb_build_object('id', v_org.id, 'name', v_org.name, 'slug', v_org.slug, 'logoUrl', v_org.logo_url, 'website', v_org.website),
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'description', v_event.description,
      'seriesName', v_event.series_name,
      'sponsorName', v_event.sponsor_name,
      'startDate', v_event.start_date,
      'endDate', v_event.end_date,
      'status', v_event.status
    ),
    'settings', jsonb_build_object(
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
grant execute on function public.get_public_event_portal(uuid) to anon, authenticated;
