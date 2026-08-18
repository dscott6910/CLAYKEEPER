-- ============================================================
-- ClayKeeper
-- Public Participant Signup Organization Directory
--
-- Allows unauthenticated visitors to discover active
-- organizations that are available for participant signup.
--
-- Exposes ONLY:
--   organization name
--   organization slug
--
-- Internal organization data remains protected by RLS.
-- ============================================================

create or replace function public.list_participant_signup_organizations()
returns table (
  organization_name text,
  organization_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    o.slug
  from public.organizations as o
  where o.active = true
    and nullif(trim(o.name), '') is not null
    and nullif(trim(o.slug), '') is not null
  order by lower(o.name), o.name;
$$;


revoke all
on function public.list_participant_signup_organizations()
from public;


grant execute
on function public.list_participant_signup_organizations()
to anon, authenticated;


comment on function public.list_participant_signup_organizations()
is
  'Returns the names and signup slugs of active ClayKeeper organizations for the public participant signup directory.';
