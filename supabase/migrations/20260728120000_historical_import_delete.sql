-- ClayKeeper: safely reverse a completed historical workbook import.
-- Deletes the event created by the import and all event-owned data through
-- existing ON DELETE CASCADE relationships. Shared athletes, teams, classes,
-- organizations, and locations are intentionally preserved.

create or replace function public.delete_historical_import(p_import_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.historical_imports%rowtype;
  v_event_id uuid;
begin
  select *
    into v_import
    from public.historical_imports
   where id = p_import_id
   for update;

  if not found then
    raise exception 'Historical import not found';
  end if;

  if not public.has_organization_role(v_import.organization_id, array['owner','admin']) then
    raise exception 'Not authorized to delete this historical import';
  end if;

  if v_import.status = 'reversed' then
    return;
  end if;

  v_event_id := v_import.event_id;

  -- The importer creates a dedicated event for each workbook. Deleting that
  -- event cascades to shoots, registrations, registration_shoots, squads,
  -- squad members, score entries, shoot-offs, awards, coach notifications,
  -- registration settings, discounts, and event payment transactions.
  if v_event_id is not null then
    delete from public.events
     where id = v_event_id
       and organization_id = v_import.organization_id;
  end if;

  update public.historical_imports
     set event_id = null,
         status = 'reversed',
         completed_at = now(),
         import_summary = coalesce(import_summary, '{}'::jsonb)
           || jsonb_build_object(
                'reversedAt', now(),
                'reversedBy', auth.uid(),
                'deletedEventId', v_event_id
              )
   where id = p_import_id;
end;
$$;

revoke all on function public.delete_historical_import(uuid) from public;
grant execute on function public.delete_historical_import(uuid) to authenticated;

comment on function public.delete_historical_import(uuid)
is 'Safely reverses a historical workbook import by deleting its dedicated event and preserving shared master records.';
