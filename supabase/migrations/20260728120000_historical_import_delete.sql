-- ============================================================
-- ClayKeeper
-- Migration: Delete historical import and imported event data
-- ============================================================

create or replace function public.delete_historical_import(p_import_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.historical_imports%rowtype;
begin
  select *
    into v_import
  from public.historical_imports
  where id = p_import_id
  for update;

  if not found then
    raise exception 'Historical import not found.';
  end if;

  if not public.has_organization_role(v_import.organization_id, array['owner','admin']) then
    raise exception 'You do not have permission to delete this historical import.';
  end if;

  -- Deleting the event cascades to its shoots, registrations,
  -- registration_shoots, squads, squad members, scores, awards,
  -- event settings, notifications, and payment records tied to
  -- those registrations. Shared master data such as athletes,
  -- teams, classes, and locations is intentionally preserved.
  if v_import.event_id is not null then
    delete from public.events
    where id = v_import.event_id
      and organization_id = v_import.organization_id;
  end if;

  delete from public.historical_imports
  where id = p_import_id
    and organization_id = v_import.organization_id;
end;
$$;

revoke all on function public.delete_historical_import(uuid) from public;
grant execute on function public.delete_historical_import(uuid) to authenticated;

comment on function public.delete_historical_import(uuid)
is 'Deletes a historical import and its linked imported event data while preserving shared athletes, teams, classes, and locations.';
