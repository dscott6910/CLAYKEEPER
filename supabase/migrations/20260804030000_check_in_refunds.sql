alter table public.registrations
  add column if not exists attendance_status text not null default 'expected',
  add column if not exists attendance_notes text,
  add column if not exists refund_status text not null default 'not_applicable',
  add column if not exists refund_amount numeric not null default 0,
  add column if not exists refund_reason text,
  add column if not exists refund_notes text,
  add column if not exists refund_processed_at timestamptz,
  add column if not exists refund_processed_by uuid;

alter table public.registrations drop constraint if exists registrations_attendance_status_check;
alter table public.registrations add constraint registrations_attendance_status_check
check (attendance_status in ('expected','checked_in','late_arrival','no_show','withdrawn','disqualified'));

alter table public.registrations drop constraint if exists registrations_refund_status_check;
alter table public.registrations add constraint registrations_refund_status_check
check (refund_status in ('not_applicable','pending_review','no_refund','partial_refund','full_refund_due','refunded'));

create index if not exists registrations_event_attendance_idx on public.registrations (event_id, attendance_status);
create index if not exists registrations_event_refund_idx on public.registrations (event_id, refund_status);

update public.registrations
set attendance_status = case when checked_in = true then 'checked_in' else 'expected' end
where attendance_status is null;
