-- ClayKeeper: fix active-season creation order and keep RPC available for future clients.
create or replace function public.create_season(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_make_active boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_season_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Season name is required'; end if;
  if p_end_date < p_start_date then raise exception 'Season end date must be on or after its start date'; end if;

  select om.organization_id into v_org
  from public.organization_members om
  where om.user_id = auth.uid() and om.active = true and om.role in ('owner','admin')
  order by om.created_at
  limit 1;

  if v_org is null then raise exception 'Only an organization owner or administrator can create seasons'; end if;

  -- Close the current active season before inserting the new active row so the
  -- partial unique index cannot reject the insert.
  if p_make_active then
    update public.seasons
       set status = 'closed',
           closed_at = coalesce(closed_at, now()),
           closed_by = coalesce(closed_by, auth.uid())
     where organization_id = v_org and status = 'active';
  end if;

  insert into public.seasons (organization_id, name, start_date, end_date, status, created_by)
  values (v_org, trim(p_name), p_start_date, p_end_date,
          case when p_make_active then 'active' else 'planning' end, auth.uid())
  returning id into v_season_id;

  return v_season_id;
exception
  when unique_violation then
    raise exception 'A season named "%" already exists', trim(p_name);
end;
$$;

revoke all on function public.create_season(text, date, date, boolean) from public;
grant execute on function public.create_season(text, date, date, boolean) to authenticated;
