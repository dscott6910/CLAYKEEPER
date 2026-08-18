-- ============================================================
-- ClayKeeper
-- Public Participant Signup Organization Lookup
--
-- Allows the unauthenticated signup page to resolve one active
-- organization by its exact signup slug without exposing the
-- organizations table or a customer directory.
-- ============================================================

create or replace function public.get_participant_signup_organization(
  p_organization_slug text
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.name,
    o.slug
  from public.organizations as o
  where o.active = true
    and o.slug = trim(p_organization_slug)
  limit 1;
$$;


revoke all
on function public.get_participant_signup_organization(text)
from public;

grant execute
on function public.get_participant_signup_organization(text)
to anon, authenticated;


comment on function public.get_participant_signup_organization(text)
is 'Resolves one active organization by exact slug for the public participant signup page.';
