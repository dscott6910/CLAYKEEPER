-- ClayKeeper Sprint 21: Registration & Payment Center

create table if not exists public.event_registration_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  public_registration_enabled boolean not null default false,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer,
  waitlist_enabled boolean not null default true,
  base_fee numeric(10,2) not null default 0,
  payment_provider text not null default 'manual',
  stripe_price_id text,
  confirmation_message text,
  terms_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id),
  constraint event_registration_capacity_positive check (capacity is null or capacity > 0),
  constraint event_registration_base_fee_nonnegative check (base_fee >= 0),
  constraint event_registration_provider_valid check (payment_provider in ('manual','stripe'))
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  code text not null,
  description text,
  discount_type text not null default 'fixed',
  discount_value numeric(10,2) not null,
  usage_limit integer,
  times_used integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_codes_type_valid check (discount_type in ('fixed','percent')),
  constraint discount_codes_value_valid check (discount_value > 0),
  constraint discount_codes_percent_valid check (discount_type <> 'percent' or discount_value <= 100),
  constraint discount_codes_usage_valid check (usage_limit is null or usage_limit > 0),
  unique(organization_id, event_id, code)
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  transaction_type text not null default 'payment',
  provider text not null default 'manual',
  provider_transaction_id text,
  amount numeric(10,2) not null,
  status text not null default 'succeeded',
  payment_method text,
  receipt_email text,
  notes text,
  processed_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payment_transactions_type_valid check (transaction_type in ('payment','refund','adjustment')),
  constraint payment_transactions_provider_valid check (provider in ('manual','stripe','imported')),
  constraint payment_transactions_status_valid check (status in ('pending','succeeded','failed','cancelled')),
  constraint payment_transactions_amount_nonzero check (amount <> 0)
);

create index if not exists event_registration_settings_org_idx on public.event_registration_settings(organization_id, event_id);
create index if not exists discount_codes_event_idx on public.discount_codes(organization_id, event_id, active);
create index if not exists payment_transactions_registration_idx on public.payment_transactions(registration_id, processed_at desc);

alter table public.event_registration_settings enable row level security;
alter table public.discount_codes enable row level security;
alter table public.payment_transactions enable row level security;

-- Follow the same organization membership pattern used by the rest of ClayKeeper.
create policy "Members manage registration settings" on public.event_registration_settings
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members manage discount codes" on public.discount_codes
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members manage payment transactions" on public.payment_transactions
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

-- Public event catalog exposes only registration-safe fields.
create or replace function public.get_public_registration_events()
returns table (
  organization_id uuid,
  organization_name text,
  event_id uuid,
  event_name text,
  start_date date,
  end_date date,
  location_name text,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer,
  registrations_count bigint,
  waitlist_enabled boolean,
  base_fee numeric,
  payment_provider text,
  confirmation_message text,
  terms_url text
)
language sql
security definer
set search_path = public
as $$
  select
    e.organization_id,
    o.name,
    e.id,
    e.name,
    e.start_date,
    e.end_date,
    null::text,
    s.registration_opens_at,
    s.registration_closes_at,
    s.capacity,
    count(r.id) filter (where r.status not in ('withdrawn','cancelled')),
    s.waitlist_enabled,
    s.base_fee,
    s.payment_provider,
    s.confirmation_message,
    s.terms_url
  from public.event_registration_settings s
  join public.events e on e.id = s.event_id
  join public.organizations o on o.id = e.organization_id
  left join public.registrations r on r.event_id = e.id
  where s.public_registration_enabled = true
    and (s.registration_opens_at is null or s.registration_opens_at <= now())
    and (s.registration_closes_at is null or s.registration_closes_at >= now())
  group by e.organization_id, o.name, e.id, e.name, e.start_date, e.end_date,
    s.registration_opens_at, s.registration_closes_at,
    s.capacity, s.waitlist_enabled, s.base_fee, s.payment_provider,
    s.confirmation_message, s.terms_url;
$$;

grant execute on function public.get_public_registration_events() to anon, authenticated;
