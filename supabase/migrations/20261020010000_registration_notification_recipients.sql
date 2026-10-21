-- ClayKeeper: organization-managed registration notification recipients.
--
-- Owners and administrators can choose, from inside ClayKeeper, who receives
-- participant registration notices and staff access approval emails. Staff
-- approval notices remain limited to owners and selected staff approvers.

create table if not exists public.organization_registration_notification_recipients (
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  notify_staff_requests boolean not null default false,
  notify_participant_registrations boolean not null default false,
  participant_notifications_enabled_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (organization_id, user_id)
);

comment on table public.organization_registration_notification_recipients
is 'Organization owners and admins selected to receive participant signup notices and staff access approval emails.';

alter table public.organization_registration_notification_recipients
  enable row level security;

drop policy if exists "Owners and admins can view registration notification recipients"
on public.organization_registration_notification_recipients;

create policy "Owners and admins can view registration notification recipients"
on public.organization_registration_notification_recipients
for select
to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'admin'])
);

-- Seed current owners. New participant notifications begin only after this
-- migration, preventing a burst of emails for historical participant records.
insert into public.organization_registration_notification_recipients as recipient (
  organization_id,
  user_id,
  notify_staff_requests,
  notify_participant_registrations,
  participant_notifications_enabled_at
)
select
  om.organization_id,
  om.user_id,
  true,
  true,
  now()
from public.organization_members as om
where om.active = true
  and om.role = 'owner'
on conflict (organization_id, user_id)
do update set
  notify_staff_requests = true,
  notify_participant_registrations = true,
  participant_notifications_enabled_at = coalesce(
    recipient.participant_notifications_enabled_at,
    now()
  ),
  updated_at = now();

-- Preserve the existing behavior for selected admin staff approvers.
insert into public.organization_registration_notification_recipients as recipient (
  organization_id,
  user_id,
  notify_staff_requests,
  notify_participant_registrations,
  participant_notifications_enabled_at
)
select
  reviewer.organization_id,
  reviewer.user_id,
  true,
  true,
  now()
from public.organization_access_request_reviewers as reviewer
join public.organization_members as om
  on om.organization_id = reviewer.organization_id
 and om.user_id = reviewer.user_id
where om.active = true
  and om.role = 'admin'
on conflict (organization_id, user_id)
do update set
  notify_staff_requests = true,
  notify_participant_registrations = true,
  participant_notifications_enabled_at = coalesce(
    recipient.participant_notifications_enabled_at,
    now()
  ),
  updated_at = now();

create or replace function public.list_registration_notification_recipients(
  p_organization_id uuid
)
returns table (
  user_id uuid,
  email text,
  role text,
  can_review_staff_requests boolean,
  notify_staff_requests boolean,
  notify_participant_registrations boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin']
  ) then
    raise exception 'Only an owner or administrator can view registration notification recipients';
  end if;

  return query
  select
    om.user_id,
    coalesce(au.email, '')::text as email,
    om.role,
    (
      om.role = 'owner'
      or reviewer.user_id is not null
    ) as can_review_staff_requests,
    coalesce(recipient.notify_staff_requests, false),
    coalesce(recipient.notify_participant_registrations, false)
  from public.organization_members as om
  join auth.users as au
    on au.id = om.user_id
  left join public.organization_access_request_reviewers as reviewer
    on reviewer.organization_id = om.organization_id
   and reviewer.user_id = om.user_id
  left join public.organization_registration_notification_recipients as recipient
    on recipient.organization_id = om.organization_id
   and recipient.user_id = om.user_id
  where om.organization_id = p_organization_id
    and om.active = true
    and om.role in ('owner', 'admin')
  order by
    case when om.role = 'owner' then 0 else 1 end,
    lower(coalesce(au.email, '')),
    om.created_at;
end;
$$;

create or replace function public.set_registration_notification_recipient(
  p_organization_id uuid,
  p_user_id uuid,
  p_notify_staff_requests boolean,
  p_notify_participant_registrations boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role text;
  v_current_participant_enabled boolean;
  v_current_participant_enabled_at timestamptz;
begin
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin']
  ) then
    raise exception 'Only an owner or administrator can manage registration notification recipients';
  end if;

  select om.role
  into v_target_role
  from public.organization_members as om
  where om.organization_id = p_organization_id
    and om.user_id = p_user_id
    and om.active = true
    and om.role in ('owner', 'admin');

  if v_target_role is null then
    raise exception 'Notification recipients must be active organization owners or administrators';
  end if;

  if p_notify_staff_requests
     and v_target_role <> 'owner'
     and not exists (
       select 1
       from public.organization_access_request_reviewers as reviewer
       where reviewer.organization_id = p_organization_id
         and reviewer.user_id = p_user_id
     ) then
    raise exception 'This administrator must be a staff request approver before receiving approval emails';
  end if;

  select
    recipient.notify_participant_registrations,
    recipient.participant_notifications_enabled_at
  into
    v_current_participant_enabled,
    v_current_participant_enabled_at
  from public.organization_registration_notification_recipients as recipient
  where recipient.organization_id = p_organization_id
    and recipient.user_id = p_user_id;

  insert into public.organization_registration_notification_recipients (
    organization_id,
    user_id,
    notify_staff_requests,
    notify_participant_registrations,
    participant_notifications_enabled_at,
    created_by
  )
  values (
    p_organization_id,
    p_user_id,
    p_notify_staff_requests,
    p_notify_participant_registrations,
    case
      when p_notify_participant_registrations then now()
      else null
    end,
    auth.uid()
  )
  on conflict (organization_id, user_id)
  do update set
    notify_staff_requests = excluded.notify_staff_requests,
    notify_participant_registrations = excluded.notify_participant_registrations,
    participant_notifications_enabled_at = case
      when not excluded.notify_participant_registrations then null
      when coalesce(v_current_participant_enabled, false)
        then coalesce(v_current_participant_enabled_at, now())
      else now()
    end,
    updated_at = now();
end;
$$;

revoke all
on function public.list_registration_notification_recipients(uuid)
from public, anon;

grant execute
on function public.list_registration_notification_recipients(uuid)
to authenticated;

revoke all
on function public.set_registration_notification_recipient(
  uuid,
  uuid,
  boolean,
  boolean
)
from public, anon;

grant execute
on function public.set_registration_notification_recipient(
  uuid,
  uuid,
  boolean,
  boolean
)
to authenticated;

-- Staff approval notifications now use the organization-managed recipient
-- preferences. An admin must still be a selected reviewer to receive them.
create or replace function public.list_due_staff_access_request_notifications()
returns table (
  request_id uuid,
  organization_id uuid,
  organization_name text,
  requester_name text,
  requester_email text,
  requested_role text,
  request_created_at timestamptz,
  recipient_user_id uuid,
  recipient_email text,
  notification_kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  with recipients as (
    select distinct
      om.organization_id,
      om.user_id
    from public.organization_members as om
    join public.organization_registration_notification_recipients as recipient
      on recipient.organization_id = om.organization_id
     and recipient.user_id = om.user_id
     and recipient.notify_staff_requests = true
    left join public.organization_access_request_reviewers as reviewer
      on reviewer.organization_id = om.organization_id
     and reviewer.user_id = om.user_id
    where om.active = true
      and om.role in ('owner', 'admin')
      and (
        om.role = 'owner'
        or reviewer.user_id is not null
      )
  ),
  candidates as (
    select
      request.id as request_id,
      request.organization_id,
      organization.name as organization_name,
      trim(concat(request.first_name, ' ', request.last_name))
        as requester_name,
      coalesce(request.email, '') as requester_email,
      request.requested_role,
      request.created_at as request_created_at,
      recipients.user_id as recipient_user_id,
      auth_user.email as recipient_email,
      exists (
        select 1
        from public.staff_access_request_notification_log as sent
        where sent.request_id = request.id
          and sent.recipient_user_id = recipients.user_id
          and sent.notification_kind = 'new'
      ) as initial_sent,
      (
        select max(sent.sent_at)
        from public.staff_access_request_notification_log as sent
        where sent.request_id = request.id
          and sent.recipient_user_id = recipients.user_id
      ) as last_sent_at
    from public.organization_access_requests as request
    join public.organizations as organization
      on organization.id = request.organization_id
    join recipients
      on recipients.organization_id = request.organization_id
    join auth.users as auth_user
      on auth_user.id = recipients.user_id
    where request.status = 'pending'
      and nullif(trim(auth_user.email), '') is not null
  )
  select
    candidates.request_id,
    candidates.organization_id,
    candidates.organization_name,
    candidates.requester_name,
    candidates.requester_email,
    candidates.requested_role,
    candidates.request_created_at,
    candidates.recipient_user_id,
    candidates.recipient_email,
    case
      when not candidates.initial_sent then 'new'
      else 'reminder'
    end as notification_kind
  from candidates
  where not candidates.initial_sent
    or candidates.last_sent_at <= now() - interval '24 hours'
  order by candidates.request_created_at, candidates.recipient_email;
$$;

create table if not exists public.participant_registration_notification_log (
  id uuid primary key default gen_random_uuid(),

  athlete_id uuid not null
    references public.athletes(id)
    on delete cascade,

  recipient_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  sent_at timestamptz not null default now(),

  unique (athlete_id, recipient_user_id)
);

alter table public.participant_registration_notification_log
  enable row level security;

create or replace function public.list_due_participant_registration_notifications()
returns table (
  athlete_id uuid,
  organization_id uuid,
  organization_name text,
  participant_name text,
  participant_email text,
  registration_created_at timestamptz,
  recipient_user_id uuid,
  recipient_email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    athlete.id as athlete_id,
    athlete.organization_id,
    organization.name as organization_name,
    trim(concat(athlete.first_name, ' ', athlete.last_name))
      as participant_name,
    coalesce(athlete.email, participant_user.email, '')
      as participant_email,
    athlete.created_at as registration_created_at,
    recipient.user_id as recipient_user_id,
    recipient_user.email as recipient_email
  from public.athletes as athlete
  join public.organizations as organization
    on organization.id = athlete.organization_id
  join auth.users as participant_user
    on participant_user.id = athlete.user_id
  join public.organization_registration_notification_recipients as preference
    on preference.organization_id = athlete.organization_id
   and preference.notify_participant_registrations = true
   and preference.participant_notifications_enabled_at is not null
   and athlete.created_at >= preference.participant_notifications_enabled_at
  join public.organization_members as recipient
    on recipient.organization_id = preference.organization_id
   and recipient.user_id = preference.user_id
   and recipient.active = true
   and recipient.role in ('owner', 'admin')
  join auth.users as recipient_user
    on recipient_user.id = recipient.user_id
  left join public.participant_registration_notification_log as sent
    on sent.athlete_id = athlete.id
   and sent.recipient_user_id = recipient.user_id
  where athlete.user_id is not null
    and athlete.active = true
    and sent.id is null
    and nullif(trim(recipient_user.email), '') is not null
  order by athlete.created_at, recipient_user.email;
$$;

create or replace function public.record_participant_registration_notification_sent(
  p_athlete_id uuid,
  p_recipient_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.athletes as athlete
    where athlete.id = p_athlete_id
      and athlete.user_id is not null
  ) then
    raise exception 'Participant registration not found';
  end if;

  insert into public.participant_registration_notification_log (
    athlete_id,
    recipient_user_id
  )
  values (
    p_athlete_id,
    p_recipient_user_id
  )
  on conflict (athlete_id, recipient_user_id)
  do nothing;
end;
$$;

revoke all
on function public.list_due_participant_registration_notifications()
from public, anon, authenticated;

grant execute
on function public.list_due_participant_registration_notifications()
to service_role;

revoke all
on function public.record_participant_registration_notification_sent(
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.record_participant_registration_notification_sent(
  uuid,
  uuid
)
to service_role;

comment on function public.list_registration_notification_recipients(uuid)
is 'Lists active owner/admin email notification choices for an organization.';

comment on function public.set_registration_notification_recipient(
  uuid,
  uuid,
  boolean,
  boolean
)
is 'Updates organization-managed staff approval and participant registration email preferences.';

comment on function public.list_due_participant_registration_notifications()
is 'Lists unsent participant signup notices for organization-selected recipients.';
