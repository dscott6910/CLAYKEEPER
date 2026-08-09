-- ClayKeeper Production QA Sprint 2
-- Harden privileged writes and enforce organization consistency on operational records.

-- Registration/payment administration: readable by members, writable by owners/admins.
drop policy if exists "Members manage registration settings" on public.event_registration_settings;
create policy "Members view registration settings" on public.event_registration_settings
for select to authenticated using (public.is_organization_member(organization_id));
create policy "Owners admins manage registration settings" on public.event_registration_settings
for all to authenticated using (public.has_organization_role(organization_id, array['owner','admin']))
with check (public.has_organization_role(organization_id, array['owner','admin']));

drop policy if exists "Members manage discount codes" on public.discount_codes;
create policy "Members view discount codes" on public.discount_codes
for select to authenticated using (public.is_organization_member(organization_id));
create policy "Owners admins manage discount codes" on public.discount_codes
for all to authenticated using (public.has_organization_role(organization_id, array['owner','admin']))
with check (public.has_organization_role(organization_id, array['owner','admin']));

drop policy if exists "Members manage payment transactions" on public.payment_transactions;
create policy "Members view payment transactions" on public.payment_transactions
for select to authenticated using (public.is_organization_member(organization_id));
create policy "Owners admins manage payment transactions" on public.payment_transactions
for all to authenticated using (public.has_organization_role(organization_id, array['owner','admin']))
with check (public.has_organization_role(organization_id, array['owner','admin']));

-- Digital scoring: all organization members may read. Only operational scoring roles may write.
drop policy if exists "digital_scorecards_members_all" on public.digital_scorecards;
create policy "digital_scorecards_members_select" on public.digital_scorecards
for select to authenticated using (public.is_organization_member(organization_id));
create policy "digital_scorecards_scoring_insert" on public.digital_scorecards
for insert to authenticated with check (public.has_organization_role(organization_id, array['owner','admin','coach','scorekeeper']));
create policy "digital_scorecards_scoring_update" on public.digital_scorecards
for update to authenticated using (public.has_organization_role(organization_id, array['owner','admin','coach','scorekeeper']))
with check (public.has_organization_role(organization_id, array['owner','admin','coach','scorekeeper']));
create policy "digital_scorecards_admin_delete" on public.digital_scorecards
for delete to authenticated using (public.has_organization_role(organization_id, array['owner','admin']));

drop policy if exists "digital_station_scores_members_all" on public.digital_scorecard_station_scores;
create policy "digital_station_scores_members_select" on public.digital_scorecard_station_scores
for select to authenticated using (public.is_organization_member(organization_id));
create policy "digital_station_scores_scoring_insert" on public.digital_scorecard_station_scores
for insert to authenticated with check (public.has_organization_role(organization_id, array['owner','admin','coach','scorekeeper']));
create policy "digital_station_scores_scoring_update" on public.digital_scorecard_station_scores
for update to authenticated using (public.has_organization_role(organization_id, array['owner','admin','coach','scorekeeper']))
with check (public.has_organization_role(organization_id, array['owner','admin','coach','scorekeeper']));
create policy "digital_station_scores_admin_delete" on public.digital_scorecard_station_scores
for delete to authenticated using (public.has_organization_role(organization_id, array['owner','admin']));

-- ActiveNet imports contain participant/guardian PII. Members can read; only owners/admins can mutate imports.
drop policy if exists "organization members manage activenet imports" on public.activenet_imports;
create policy "organization members view activenet imports" on public.activenet_imports
for select to authenticated using (public.is_organization_member(organization_id));
create policy "owners admins manage activenet imports" on public.activenet_imports
for all to authenticated using (public.has_organization_role(organization_id, array['owner','admin']))
with check (public.has_organization_role(organization_id, array['owner','admin']));

drop policy if exists "organization members manage activenet participant records" on public.activenet_participant_records;
create policy "organization members view activenet participant records" on public.activenet_participant_records
for select to authenticated using (public.is_organization_member(organization_id));
create policy "owners admins manage activenet participant records" on public.activenet_participant_records
for all to authenticated using (public.has_organization_role(organization_id, array['owner','admin']))
with check (public.has_organization_role(organization_id, array['owner','admin']));

-- Defense in depth: prevent records from carrying an organization_id that disagrees
-- with the parent record referenced by the row. This closes cross-organization UUID mixing.
create or replace function public.assert_claykeeper_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'event_registration_settings' then
    if not exists (select 1 from public.events e where e.id = new.event_id and e.organization_id = new.organization_id) then
      raise exception 'Event does not belong to the supplied organization';
    end if;
  elsif tg_table_name = 'discount_codes' and new.event_id is not null then
    if not exists (select 1 from public.events e where e.id = new.event_id and e.organization_id = new.organization_id) then
      raise exception 'Discount-code event does not belong to the supplied organization';
    end if;
  elsif tg_table_name = 'payment_transactions' then
    if not exists (select 1 from public.registrations r where r.id = new.registration_id and r.organization_id = new.organization_id) then
      raise exception 'Payment registration does not belong to the supplied organization';
    end if;
  elsif tg_table_name = 'digital_scorecards' then
    if not exists (select 1 from public.events e where e.id = new.event_id and e.organization_id = new.organization_id)
       or not exists (select 1 from public.shoots s where s.id = new.shoot_id and s.event_id = new.event_id and s.organization_id = new.organization_id)
       or not exists (select 1 from public.event_courses c where c.id = new.course_id and c.event_id = new.event_id and c.organization_id = new.organization_id)
       or not exists (
         select 1 from public.squad_members sm
         join public.squads sq on sq.id = sm.squad_id
         where sm.id = new.squad_member_id
           and sq.event_id = new.event_id
           and sq.shoot_id = new.shoot_id
           and sq.organization_id = new.organization_id
       ) then
      raise exception 'Digital scorecard references records outside its organization/event/shoot';
    end if;
  elsif tg_table_name = 'digital_scorecard_station_scores' then
    if not exists (
      select 1 from public.digital_scorecards d
      where d.id = new.scorecard_id and d.organization_id = new.organization_id
        and d.event_id = new.event_id and d.shoot_id = new.shoot_id
    ) or not exists (
      select 1 from public.course_stations cs
      join public.event_courses ec on ec.id = cs.course_id
      where cs.id = new.station_id and cs.organization_id = new.organization_id
        and ec.event_id = new.event_id and ec.organization_id = new.organization_id
    ) then
      raise exception 'Station score references records outside its scorecard organization/event/shoot';
    end if;
  elsif tg_table_name = 'activenet_participant_records' then
    if not exists (select 1 from public.activenet_imports i where i.id = new.import_id and i.organization_id = new.organization_id) then
      raise exception 'ActiveNet record import does not belong to the supplied organization';
    end if;
    if new.athlete_id is not null and not exists (select 1 from public.athletes a where a.id = new.athlete_id and a.organization_id = new.organization_id) then
      raise exception 'ActiveNet athlete does not belong to the supplied organization';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.assert_claykeeper_org_consistency() from public, anon, authenticated;

-- Triggers are idempotently recreated.
drop trigger if exists event_registration_settings_org_consistency on public.event_registration_settings;
create trigger event_registration_settings_org_consistency before insert or update on public.event_registration_settings
for each row execute function public.assert_claykeeper_org_consistency();

drop trigger if exists discount_codes_org_consistency on public.discount_codes;
create trigger discount_codes_org_consistency before insert or update on public.discount_codes
for each row execute function public.assert_claykeeper_org_consistency();

drop trigger if exists payment_transactions_org_consistency on public.payment_transactions;
create trigger payment_transactions_org_consistency before insert or update on public.payment_transactions
for each row execute function public.assert_claykeeper_org_consistency();

drop trigger if exists digital_scorecards_org_consistency on public.digital_scorecards;
create trigger digital_scorecards_org_consistency before insert or update on public.digital_scorecards
for each row execute function public.assert_claykeeper_org_consistency();

drop trigger if exists digital_station_scores_org_consistency on public.digital_scorecard_station_scores;
create trigger digital_station_scores_org_consistency before insert or update on public.digital_scorecard_station_scores
for each row execute function public.assert_claykeeper_org_consistency();

drop trigger if exists activenet_records_org_consistency on public.activenet_participant_records;
create trigger activenet_records_org_consistency before insert or update on public.activenet_participant_records
for each row execute function public.assert_claykeeper_org_consistency();
