-- Allow a no-show or withdrawn participant to retain historical squad and
-- score relationships without continuing to occupy the live squad position.

alter table public.squad_members
  drop constraint if exists squad_members_position_unique;

create unique index if not exists squad_members_active_position_unique_idx
  on public.squad_members (squad_id, position)
  where status not in ('withdrawn', 'no_show');


-- Shoot-day operators must be able to mark an assignment inactive even after
-- a squad has been locked. All other changes to a locked squad remain blocked.

create or replace function public.validate_squad_member_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_squad public.squads%rowtype;
  active_member_count integer;
begin
  select *
    into selected_squad
  from public.squads
  where id = new.squad_id
    and shoot_id = new.shoot_id
    and organization_id = new.organization_id
  for update;

  if not found then
    raise exception 'The selected squad does not exist for this shoot.';
  end if;

  if selected_squad.is_locked then
    if tg_op = 'INSERT' then
      raise exception 'This squad is locked and cannot be modified.';
    end if;

    if old.squad_id is distinct from new.squad_id
       or old.status in ('withdrawn', 'no_show')
       or new.status not in ('withdrawn', 'no_show') then
      raise exception 'This squad is locked and cannot be modified.';
    end if;
  end if;

  if new.position > selected_squad.capacity then
    raise exception
      'Position % exceeds the squad capacity of %.',
      new.position,
      selected_squad.capacity;
  end if;

  select count(*)
    into active_member_count
  from public.squad_members
  where squad_id = new.squad_id
    and status not in ('withdrawn', 'no_show')
    and (
      tg_op = 'INSERT'
      or id <> new.id
    );

  if new.status not in ('withdrawn', 'no_show')
     and active_member_count >= selected_squad.capacity then
    raise exception
      'This squad is already at its capacity of %.',
      selected_squad.capacity;
  end if;

  return new;
end;
$$;


-- The active-position rule is now a partial unique index rather than a
-- deferrable constraint. Temporarily inactivate the first member so two active
-- positions can still be swapped atomically without a uniqueness conflict.

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

  update public.squad_members
  set
    status = 'withdrawn',
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

  update public.squad_members
  set status = v_first.status
  where id = p_first_member_id;
end;
$$;
