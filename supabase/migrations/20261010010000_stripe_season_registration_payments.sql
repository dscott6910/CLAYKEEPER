-- ClayKeeper: secure Stripe payments for participant season registration.
--
-- Stripe is opt-in per organization. Existing organizations continue to waive
-- the season payment until an owner/admin enables Stripe in Settings, so this
-- migration is safe to deploy before Stripe secrets are configured.

alter table public.organization_settings
  add column if not exists stripe_payments_enabled boolean not null default false,
  add column if not exists season_registration_fee numeric(10,2) not null default 35.00;

alter table public.organization_settings
  drop constraint if exists organization_settings_season_registration_fee_nonnegative;

alter table public.organization_settings
  add constraint organization_settings_season_registration_fee_nonnegative
  check (season_registration_fee >= 0);

comment on column public.organization_settings.stripe_payments_enabled
is 'When true, completed participant season registrations require Stripe payment.';

comment on column public.organization_settings.season_registration_fee
is 'Season registration amount charged through Stripe when online payments are enabled.';


alter table public.participant_season_registrations
  add column if not exists amount_due numeric(10,2) not null default 0,
  add column if not exists amount_paid numeric(10,2) not null default 0,
  add column if not exists currency text not null default 'usd',
  add column if not exists paid_at timestamptz;

alter table public.participant_season_registrations
  drop constraint if exists participant_season_registrations_payment_status_valid;

alter table public.participant_season_registrations
  add constraint participant_season_registrations_payment_status_valid
  check (payment_status in ('pending', 'paid', 'waived', 'failed', 'refunded'));

alter table public.participant_season_registrations
  drop constraint if exists participant_season_registrations_amounts_nonnegative;

alter table public.participant_season_registrations
  add constraint participant_season_registrations_amounts_nonnegative
  check (amount_due >= 0 and amount_paid >= 0);

alter table public.participant_season_registrations
  drop constraint if exists participant_season_registrations_currency_valid;

alter table public.participant_season_registrations
  add constraint participant_season_registrations_currency_valid
  check (currency = lower(currency) and length(currency) = 3);


create table if not exists public.participant_season_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  season_registration_id uuid not null
    references public.participant_season_registrations(id) on delete cascade,
  transaction_type text not null default 'payment',
  provider text not null default 'stripe',
  provider_transaction_id text,
  checkout_request_id uuid,
  checkout_session_id text,
  payment_intent_id text,
  amount numeric(10,2) not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  payment_method text,
  receipt_email text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_season_payment_type_valid
    check (transaction_type in ('payment', 'refund', 'adjustment')),
  constraint participant_season_payment_provider_valid
    check (provider in ('stripe', 'manual', 'imported')),
  constraint participant_season_payment_status_valid
    check (status in ('pending', 'succeeded', 'failed', 'cancelled')),
  constraint participant_season_payment_amount_positive check (amount > 0),
  constraint participant_season_payment_currency_valid
    check (currency = lower(currency) and length(currency) = 3),
  unique (checkout_request_id),
  unique (checkout_session_id),
  unique (provider_transaction_id)
);

create index if not exists participant_season_payments_registration_idx
  on public.participant_season_payment_transactions
  (season_registration_id, processed_at desc);

create index if not exists participant_season_payments_intent_idx
  on public.participant_season_payment_transactions(payment_intent_id)
  where payment_intent_id is not null;

create trigger participant_season_payment_transactions_set_updated_at
before update on public.participant_season_payment_transactions
for each row execute function public.set_updated_at();

alter table public.participant_season_payment_transactions enable row level security;

create policy "Participants view their season payments"
on public.participant_season_payment_transactions
for select to authenticated
using (
  exists (
    select 1
    from public.participant_season_registrations as psr
    where psr.id = season_registration_id
      and (
        psr.user_id = (select auth.uid())
        or public.has_organization_role(
          psr.organization_id,
          array['owner', 'admin', 'treasurer']
        )
      )
  )
);

revoke insert, update, delete, truncate, references, trigger
on table public.participant_season_payment_transactions
from authenticated, anon;

grant select on table public.participant_season_payment_transactions
to authenticated;

drop policy if exists "Participants view their season registrations"
on public.participant_season_registrations;

create policy "Participants view their season registrations"
on public.participant_season_registrations
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'coach', 'treasurer']
  )
);


create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;


-- Add registration fee configuration to the existing public signup lookup.
drop function if exists public.get_participant_signup_organization(text);

create function public.get_participant_signup_organization(
  p_organization_slug text
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  stripe_payments_enabled boolean,
  season_registration_fee numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.name,
    o.slug,
    coalesce(os.stripe_payments_enabled, false),
    coalesce(os.season_registration_fee, 35.00)
  from public.organizations as o
  left join public.organization_settings as os
    on os.organization_id = o.id
  where o.active = true
    and o.slug = trim(p_organization_slug)
  limit 1;
$$;

revoke all on function public.get_participant_signup_organization(text)
from public;

grant execute on function public.get_participant_signup_organization(text)
to anon, authenticated;


-- Completed waivers create a pending balance only when Stripe is enabled.
create or replace function public.complete_participant_season_registration(
  p_organization_id uuid,
  p_selected_disciplines text[] default '{}'::text[],
  p_waivers_accepted jsonb default '{}'::jsonb,
  p_signature_type text default null,
  p_signature_value text default null
)
returns public.participant_season_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_season public.seasons;
  v_athlete public.athletes;
  v_registration public.participant_season_registrations;
  v_stripe_enabled boolean := false;
  v_amount_due numeric(10,2) := 0;
  v_payment_status text := 'waived';
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_season
  from public.seasons
  where organization_id = p_organization_id
    and status = 'active'
  order by start_date desc
  limit 1;

  if not found then
    raise exception 'No active season is available for registration';
  end if;

  select *
  into v_athlete
  from public.athletes
  where organization_id = p_organization_id
    and user_id = v_user_id
    and active = true
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'No participant profile was found for this account';
  end if;

  if nullif(trim(coalesce(p_signature_value, '')), '') is null then
    raise exception 'Digital signature is required';
  end if;

  select
    coalesce(os.stripe_payments_enabled, false),
    coalesce(os.season_registration_fee, 35.00)
  into v_stripe_enabled, v_amount_due
  from public.organization_settings as os
  where os.organization_id = p_organization_id;

  if not found then
    v_stripe_enabled := false;
    v_amount_due := 35.00;
  end if;

  if v_stripe_enabled and v_amount_due > 0 then
    v_payment_status := 'pending';
  else
    v_payment_status := 'waived';
    v_amount_due := 0;
  end if;

  insert into public.participant_season_registrations (
    organization_id,
    season_id,
    athlete_id,
    user_id,
    status,
    payment_status,
    amount_due,
    amount_paid,
    currency,
    paid_at,
    selected_disciplines,
    waivers_accepted,
    signature_type,
    signature_value,
    profile_confirmed_at,
    completed_at
  )
  values (
    p_organization_id,
    v_season.id,
    v_athlete.id,
    v_user_id,
    'completed',
    v_payment_status,
    v_amount_due,
    0,
    'usd',
    null,
    coalesce(p_selected_disciplines, '{}'::text[]),
    coalesce(p_waivers_accepted, '{}'::jsonb),
    nullif(trim(p_signature_type), ''),
    nullif(trim(p_signature_value), ''),
    now(),
    now()
  )
  on conflict (season_id, athlete_id)
  do update set
    status = excluded.status,
    payment_status = case
      when public.participant_season_registrations.payment_status = 'paid'
        then 'paid'
      else excluded.payment_status
    end,
    amount_due = case
      when public.participant_season_registrations.payment_status = 'paid'
        then public.participant_season_registrations.amount_due
      else excluded.amount_due
    end,
    selected_disciplines = excluded.selected_disciplines,
    waivers_accepted = excluded.waivers_accepted,
    signature_type = excluded.signature_type,
    signature_value = excluded.signature_value,
    profile_confirmed_at = excluded.profile_confirmed_at,
    completed_at = excluded.completed_at
  returning *
  into v_registration;

  return v_registration;
end;
$$;


-- Apply a verified Stripe webhook exactly once and synchronize the season
-- registration balance in the same database transaction.
create or replace function public.apply_stripe_season_payment_event(
  p_event_id text,
  p_event_type text,
  p_registration_id uuid default null,
  p_checkout_session_id text default null,
  p_payment_intent_id text default null,
  p_amount numeric default 0,
  p_currency text default 'usd',
  p_status text default 'pending',
  p_receipt_email text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_registration_id uuid;
  v_organization_id uuid;
  v_amount_paid numeric(10,2);
  v_amount_due numeric(10,2);
begin
  if nullif(trim(coalesce(p_event_id, '')), '') is null then
    raise exception 'Stripe event ID is required';
  end if;

  insert into public.stripe_webhook_events(event_id, event_type)
  values (trim(p_event_id), trim(p_event_type))
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  v_registration_id := p_registration_id;

  if v_registration_id is null and p_payment_intent_id is not null then
    select t.season_registration_id
    into v_registration_id
    from public.participant_season_payment_transactions as t
    where t.payment_intent_id = p_payment_intent_id
    order by t.created_at
    limit 1;
  end if;

  if v_registration_id is null then
    raise exception 'Stripe event is not linked to a season registration';
  end if;

  select psr.organization_id, psr.amount_due
  into v_organization_id, v_amount_due
  from public.participant_season_registrations as psr
  where psr.id = v_registration_id
  for update;

  if not found then
    raise exception 'Season registration not found';
  end if;

  if p_event_type = 'charge.refunded' then
    insert into public.participant_season_payment_transactions (
      organization_id,
      season_registration_id,
      transaction_type,
      provider,
      provider_transaction_id,
      payment_intent_id,
      amount,
      currency,
      status,
      payment_method,
      receipt_email,
      processed_at
    )
    values (
      v_organization_id,
      v_registration_id,
      'refund',
      'stripe',
      'refund-total:' || p_payment_intent_id,
      p_payment_intent_id,
      greatest(p_amount, 0.01),
      lower(coalesce(nullif(p_currency, ''), 'usd')),
      'succeeded',
      'card',
      nullif(trim(p_receipt_email), ''),
      now()
    )
    on conflict (provider_transaction_id)
    do update set
      amount = excluded.amount,
      status = excluded.status,
      processed_at = excluded.processed_at,
      updated_at = now();
  else
    update public.participant_season_payment_transactions
    set
      provider_transaction_id = coalesce(
        nullif(trim(p_payment_intent_id), ''),
        provider_transaction_id,
        nullif(trim(p_checkout_session_id), '')
      ),
      payment_intent_id = coalesce(
        nullif(trim(p_payment_intent_id), ''),
        payment_intent_id
      ),
      amount = greatest(p_amount, 0.01),
      currency = lower(coalesce(nullif(p_currency, ''), 'usd')),
      status = p_status,
      payment_method = 'card',
      receipt_email = coalesce(
        nullif(trim(p_receipt_email), ''),
        receipt_email
      ),
      processed_at = now(),
      updated_at = now()
    where checkout_session_id = p_checkout_session_id;

    if not found then
      insert into public.participant_season_payment_transactions (
        organization_id,
        season_registration_id,
        transaction_type,
        provider,
        provider_transaction_id,
        checkout_session_id,
        payment_intent_id,
        amount,
        currency,
        status,
        payment_method,
        receipt_email,
        processed_at
      )
      values (
        v_organization_id,
        v_registration_id,
        'payment',
        'stripe',
        coalesce(
          nullif(trim(p_payment_intent_id), ''),
          nullif(trim(p_checkout_session_id), '')
        ),
        nullif(trim(p_checkout_session_id), ''),
        nullif(trim(p_payment_intent_id), ''),
        greatest(p_amount, 0.01),
        lower(coalesce(nullif(p_currency, ''), 'usd')),
        p_status,
        'card',
        nullif(trim(p_receipt_email), ''),
        now()
      );
    end if;
  end if;

  select coalesce(sum(
    case
      when t.status <> 'succeeded' then 0
      when t.transaction_type = 'refund' then -t.amount
      when t.transaction_type = 'payment' then t.amount
      else 0
    end
  ), 0)
  into v_amount_paid
  from public.participant_season_payment_transactions as t
  where t.season_registration_id = v_registration_id;

  v_amount_paid := greatest(v_amount_paid, 0);

  update public.participant_season_registrations
  set
    amount_paid = v_amount_paid,
    payment_status = case
      when v_amount_due <= 0 then 'waived'
      when v_amount_paid >= v_amount_due then 'paid'
      when p_event_type = 'charge.refunded' and v_amount_paid = 0 then 'refunded'
      when p_status = 'failed' and v_amount_paid = 0 then 'failed'
      else 'pending'
    end,
    paid_at = case
      when v_amount_paid >= v_amount_due and v_amount_due > 0
        then coalesce(paid_at, now())
      else null
    end,
    updated_at = now()
  where id = v_registration_id;

  return true;
end;
$$;

revoke all on function public.apply_stripe_season_payment_event(
  text, text, uuid, text, text, numeric, text, text, text
)
from public, anon, authenticated;

grant execute on function public.apply_stripe_season_payment_event(
  text, text, uuid, text, text, numeric, text, text, text
)
to service_role;
