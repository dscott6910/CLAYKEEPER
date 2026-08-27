-- ClayKeeper: email notification queue for pending staff access requests.
--
-- A scheduled server job calls these RPCs to email organization owners
-- and selected admin approvers when staff requests are pending. The log
-- prevents duplicate initial emails and spaces reminders at least 24
-- hours apart until the request is approved or declined.

create table if not exists public.staff_access_request_notification_log (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null
    references public.organization_access_requests(id)
    on delete cascade,

  recipient_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  notification_kind text not null,

  sent_at timestamptz not null default now(),

  constraint staff_access_request_notification_kind_valid
    check (notification_kind in ('new', 'reminder'))
);

create index if not exists staff_access_request_notification_lookup_idx
on public.staff_access_request_notification_log (
  request_id,
  recipient_user_id,
  sent_at desc
);

alter table public.staff_access_request_notification_log
  enable row level security;

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
  with reviewers as (
    select distinct
      om.organization_id,
      om.user_id
    from public.organization_members as om
    where om.active = true
      and om.role = 'owner'

    union

    select distinct
      om.organization_id,
      om.user_id
    from public.organization_members as om
    join public.organization_access_request_reviewers as reviewer
      on reviewer.organization_id = om.organization_id
     and reviewer.user_id = om.user_id
    where om.active = true
      and om.role = 'admin'
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
      reviewers.user_id as recipient_user_id,
      auth_user.email as recipient_email,
      exists (
        select 1
        from public.staff_access_request_notification_log as sent
        where sent.request_id = request.id
          and sent.recipient_user_id = reviewers.user_id
          and sent.notification_kind = 'new'
      ) as initial_sent,
      (
        select max(sent.sent_at)
        from public.staff_access_request_notification_log as sent
        where sent.request_id = request.id
          and sent.recipient_user_id = reviewers.user_id
      ) as last_sent_at
    from public.organization_access_requests as request
    join public.organizations as organization
      on organization.id = request.organization_id
    join reviewers
      on reviewers.organization_id = request.organization_id
    join auth.users as auth_user
      on auth_user.id = reviewers.user_id
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

create or replace function public.record_staff_access_request_notification_sent(
  p_request_id uuid,
  p_recipient_user_id uuid,
  p_notification_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_notification_kind not in ('new', 'reminder') then
    raise exception 'Notification kind is invalid';
  end if;

  if not exists (
    select 1
    from public.organization_access_requests as request
    where request.id = p_request_id
  ) then
    raise exception 'Staff access request not found';
  end if;

  insert into public.staff_access_request_notification_log (
    request_id,
    recipient_user_id,
    notification_kind
  )
  values (
    p_request_id,
    p_recipient_user_id,
    p_notification_kind
  );
end;
$$;

revoke all
on function public.list_due_staff_access_request_notifications()
from public, anon, authenticated;

grant execute
on function public.list_due_staff_access_request_notifications()
to service_role;

revoke all
on function public.record_staff_access_request_notification_sent(
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function public.record_staff_access_request_notification_sent(
  uuid,
  uuid,
  text
)
to service_role;

comment on function public.list_due_staff_access_request_notifications()
is 'Lists pending staff access request email notifications due for owners and selected admin approvers.';

comment on function public.record_staff_access_request_notification_sent(
  uuid,
  uuid,
  text
)
is 'Records a staff access request notification after the email is sent successfully.';
