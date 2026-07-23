-- ClayKeeper Sprint 16: Coach Portal

alter table public.coaches
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists coaches_user_unique_idx
  on public.coaches(user_id)
  where user_id is not null;

comment on column public.coaches.user_id
is 'Optional authenticated ClayKeeper account linked to this coach profile.';

create table if not exists public.coach_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info','success','warning','urgent')),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_announcements_title_not_blank check (length(trim(title)) > 0),
  constraint coach_announcements_message_not_blank check (length(trim(message)) > 0)
);

create index if not exists coach_announcements_org_event_idx
  on public.coach_announcements(organization_id, event_id, active, created_at desc);

alter table public.coach_announcements enable row level security;

drop policy if exists "Members can view coach announcements" on public.coach_announcements;
create policy "Members can view coach announcements"
on public.coach_announcements for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "Owners and admins can manage coach announcements" on public.coach_announcements;
create policy "Owners and admins can manage coach announcements"
on public.coach_announcements for all to authenticated
using (public.has_organization_role(organization_id, array['owner','admin']))
with check (public.has_organization_role(organization_id, array['owner','admin']));

-- Automatically link an existing coach profile when its email matches the signed-in user's email.
create or replace function public.link_current_user_to_coach()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_coach_id uuid;
begin
  update public.coaches c
  set user_id = auth.uid(), updated_at = now()
  where c.user_id is null
    and c.email is not null
    and lower(trim(c.email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and public.is_organization_member(c.organization_id)
  returning c.id into linked_coach_id;

  return linked_coach_id;
end;
$$;

grant execute on function public.link_current_user_to_coach() to authenticated;
