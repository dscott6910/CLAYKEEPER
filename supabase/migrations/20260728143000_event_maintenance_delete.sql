-- ClayKeeper v2.4.1: safe event maintenance deletion for orphaned or duplicate events.
create or replace function public.delete_event_maintenance(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_user_id uuid := auth.uid();
  v_shoot_count integer := 0;
  v_registration_count integer := 0;
  v_import_count integer := 0;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to delete an event';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event not found. Refresh Event Maintenance and try again.';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = v_event.organization_id
      and om.user_id = v_user_id
      and om.active = true
      and om.role in ('owner', 'admin')
  ) then
    raise exception 'Only an active organization owner or administrator can delete an event';
  end if;

  select count(*)::integer into v_shoot_count
  from public.shoots
  where event_id = p_event_id;

  select count(*)::integer into v_registration_count
  from public.registrations
  where event_id = p_event_id;

  select count(*)::integer into v_import_count
  from public.historical_imports
  where event_id = p_event_id;

  -- Remove import-history rows linked to this event first. Event-owned competition data
  -- is removed through the database foreign-key cascades when the event is deleted.
  delete from public.historical_imports
  where event_id = p_event_id
    and organization_id = v_event.organization_id;

  delete from public.events
  where id = p_event_id
    and organization_id = v_event.organization_id;
  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'The event could not be deleted';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'eventId', p_event_id,
    'eventName', v_event.name,
    'shootsDeleted', v_shoot_count,
    'registrationsDeleted', v_registration_count,
    'importHistoryDeleted', v_import_count
  );
exception
  when foreign_key_violation then
    raise exception 'A related database record is preventing event deletion: %', sqlerrm;
  when others then
    raise;
end;
$$;

revoke all on function public.delete_event_maintenance(uuid) from public;
grant execute on function public.delete_event_maintenance(uuid) to authenticated;

comment on function public.delete_event_maintenance(uuid)
is 'Safely deletes an event and its event-owned data for organization owners and administrators.';
