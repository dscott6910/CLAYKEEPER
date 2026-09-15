-- A no-show cannot remain checked in. Enforce this for the Registration page
-- and for any future workflow that marks a registration as withdrawn.
create or replace function public.clear_checkin_for_withdrawn_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'withdrawn' then
    new.checked_in := false;
    new.checked_in_at := null;
    new.checked_in_by := null;
    new.attendance_status := 'no_show';
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_clear_checkin_for_no_shows
  on public.registrations;

create trigger registrations_clear_checkin_for_no_shows
before insert or update of status on public.registrations
for each row
execute function public.clear_checkin_for_withdrawn_registration();

-- Repair any registrations that were marked no-show before this rule existed.
update public.registrations
set
  checked_in = false,
  checked_in_at = null,
  checked_in_by = null,
  attendance_status = 'no_show'
where status = 'withdrawn'
  and checked_in = true;
