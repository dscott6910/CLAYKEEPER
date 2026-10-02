-- The swap function uses an empty search path for safety. Qualify the
-- deferrable constraint name so SET CONSTRAINTS can resolve it correctly.

create or replace function public.swap_squad_member_positions(
  p_first_member_id uuid,
  p_second_member_id uuid,
  p_squad_id uuid,
  p_first_position integer,
  p_second_position integer,
  p_first_label text,
  p_second_label text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_first public.squad_members%rowtype;
  v_second public.squad_members%rowtype;
  v_first_found boolean;
  v_second_found boolean;
begin
  if p_first_member_id = p_second_member_id then
    raise exception 'Two different squad members are required to swap posts.';
  end if;

  select * into v_first
  from public.squad_members
  where id = p_first_member_id
  for update;
  v_first_found := found;

  select * into v_second
  from public.squad_members
  where id = p_second_member_id
  for update;
  v_second_found := found;

  if not v_first_found
    or not v_second_found
    or v_first.squad_id <> p_squad_id
    or v_second.squad_id <> p_squad_id
    or v_first.shoot_id <> v_second.shoot_id
    or v_first.organization_id <> v_second.organization_id
    or v_first.position <> p_first_position
    or v_second.position <> p_second_position then
    raise exception 'The selected squad posts have changed. Refresh and try again.';
  end if;

  set constraints public.squad_members_position_unique deferred;

  update public.squad_members
  set
    position = p_second_position,
    position_label = nullif(trim(p_second_label), ''),
    assignment_method = 'manual'
  where id = p_first_member_id;

  update public.squad_members
  set
    position = p_first_position,
    position_label = nullif(trim(p_first_label), ''),
    assignment_method = 'manual'
  where id = p_second_member_id;
end;
$$;
