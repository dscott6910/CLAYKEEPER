-- Store the organization fee alongside the event fee so payment expectations
-- can be configured from the Registration & Payments page for each event.
alter table public.event_registration_settings
  add column if not exists organization_fee numeric(10,2) not null default 2;

alter table public.event_registration_settings
  drop constraint if exists event_registration_organization_fee_nonnegative;

alter table public.event_registration_settings
  add constraint event_registration_organization_fee_nonnegative
  check (organization_fee >= 0);
