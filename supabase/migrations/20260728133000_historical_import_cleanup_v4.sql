-- ClayKeeper v2.3.6: cleanup partial historical imports and all event-owned data.
create or replace function public.delete_historical_import_v4(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.historical_imports%rowtype;
  v_event_id uuid;
  v_event_name text;
  v_user_id uuid := auth.uid();
  v_event_deleted integer := 0;
  v_import_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to clean up an import';
  end if;

  select * into v_import
  from public.historical_imports
  where id = p_import_id;

  if not found then
    raise exception 'Historical import not found. Refresh the page and try again.';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = v_import.organization_id
      and om.user_id = v_user_id
      and om.active = true
      and om.role in ('owner', 'admin')
  ) then
    raise exception 'Only an active organization owner or administrator can clean up an import';
  end if;

  -- Prefer the direct link. For older partial imports, recover the event from its import-specific external ID.
  v_event_id := v_import.event_id;
  if v_event_id is null then
    select e.id into v_event_id
    from public.events e
    where e.organization_id = v_import.organization_id
      and e.external_id in (
        'trap-series:' || p_import_id::text,
        'us-open:' || p_import_id::text,
        'historical:' || p_import_id::text
      )
    order by e.created_at desc
    limit 1;
  end if;

  if v_event_id is not null then
    select e.name into v_event_name
    from public.events e
    where e.id = v_event_id
      and e.organization_id = v_import.organization_id;

    -- Event-owned registrations, shoots, squads, squad members, and scores are removed by FK cascades.
    delete from public.events
    where id = v_event_id
      and organization_id = v_import.organization_id;
    get diagnostics v_event_deleted = row_count;

    if v_event_deleted <> 1 then
      raise exception 'The linked event could not be deleted. No import history was removed.';
    end if;
  end if;

  delete from public.historical_imports
  where id = p_import_id
    and organization_id = v_import.organization_id;
  get diagnostics v_import_deleted = row_count;

  if v_import_deleted <> 1 then
    raise exception 'The import history record could not be deleted';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'importId', p_import_id,
    'eventId', v_event_id,
    'eventName', v_event_name,
    'fileName', v_import.file_name,
    'historyRowsDeleted', v_import_deleted,
    'eventRowsDeleted', v_event_deleted
  );
exception
  when foreign_key_violation then
    raise exception 'A related database record is preventing cleanup: %', sqlerrm;
  when others then
    raise;
end;
$$;

revoke all on function public.delete_historical_import_v4(uuid) from public;
grant execute on function public.delete_historical_import_v4(uuid) to authenticated;

comment on function public.delete_historical_import_v4(uuid)
is 'Deletes a historical import and its partial or completed event, including recovery by external ID for older stuck imports.';
