-- ClayKeeper: make historical import deletion complete and visible in the UI.
-- This version removes both the imported event and the historical_imports
-- history row, while preserving shared athletes, teams, classes, and locations.

create or replace function public.delete_historical_import_v2(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.historical_imports%rowtype;
  v_event_id uuid;
  v_event_name text;
begin
  select *
    into v_import
    from public.historical_imports
   where id = p_import_id
   for update;

  if not found then
    raise exception 'Historical import not found or it has already been deleted';
  end if;

  if not public.has_organization_role(v_import.organization_id, array['owner','admin']) then
    raise exception 'Only an organization owner or administrator can delete an import';
  end if;

  v_event_id := v_import.event_id;

  if v_event_id is not null then
    select name
      into v_event_name
      from public.events
     where id = v_event_id
       and organization_id = v_import.organization_id;

    delete from public.events
     where id = v_event_id
       and organization_id = v_import.organization_id;

    if found is false then
      raise exception 'The imported event could not be deleted';
    end if;
  end if;

  -- Remove the import-history row so the deleted import disappears immediately.
  delete from public.historical_imports
   where id = p_import_id;

  return jsonb_build_object(
    'deleted', true,
    'importId', p_import_id,
    'eventId', v_event_id,
    'eventName', v_event_name,
    'fileName', v_import.file_name
  );
end;
$$;

revoke all on function public.delete_historical_import_v2(uuid) from public;
grant execute on function public.delete_historical_import_v2(uuid) to authenticated;

comment on function public.delete_historical_import_v2(uuid)
is 'Deletes a historical import, its dedicated event and event-owned records, and the import history row while preserving shared master records.';
