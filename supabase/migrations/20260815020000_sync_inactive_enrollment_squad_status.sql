-- ClayKeeper: keep squad membership status synchronized when a shoot
-- enrollment becomes inactive.
--
-- IMPORTANT:
-- Never delete the squad_member row. Score entries, shoot-off scores,
-- digital scorecards, and historical relationships may reference it.
--
-- This trigger only moves an ACTIVE squad membership to an appropriate
-- inactive state when the enrollment itself becomes inactive.

create or replace function public.sync_squad_member_from_enrollment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Nothing to do when status did not actually change.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- A withdrawn or cancelled enrollment is no longer an active
  -- squad assignment. Preserve the member row and all scoring data.
  if new.status in ('withdrawn', 'cancelled') then
    update public.squad_members
    set status = 'withdrawn'
    where registration_shoot_id = new.id
      and status not in ('withdrawn', 'no_show', 'disqualified');

  -- A disqualified enrollment should remain represented in its squad
  -- and scoring history, but its squad-member status must reflect DQ.
  elsif new.status = 'disqualified' then
    update public.squad_members
    set status = 'disqualified'
    where registration_shoot_id = new.id
      and status not in ('withdrawn', 'no_show', 'disqualified');
  end if;

  return new;
end;
$function$;


drop trigger if exists registration_shoots_sync_squad_member_status
  on public.registration_shoots;

create trigger registration_shoots_sync_squad_member_status
after update of status
on public.registration_shoots
for each row
when (old.status is distinct from new.status)
execute function public.sync_squad_member_from_enrollment_status();


comment on function public.sync_squad_member_from_enrollment_status()
is 'Preserves squad-member and scoring history while synchronizing inactive enrollment statuses to squad membership.';
