create or replace function public.record_manual_registration_transaction(
  p_organization_id uuid,
  p_registration_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_payment_method text,
  p_receipt_email text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_transaction_id uuid;
  v_signed_amount numeric;
  v_total numeric;
  v_expected numeric;
  v_payment_status text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'treasurer']
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if p_transaction_type not in (
    'payment',
    'refund',
    'adjustment'
  ) then
    raise exception 'Invalid transaction type';
  end if;

  if p_amount is null or p_amount = 0 then
    raise exception 'Transaction amount must be nonzero';
  end if;

  if not exists (
    select 1
    from public.registrations as r
    where r.id = p_registration_id
      and r.organization_id = p_organization_id
  ) then
    raise exception 'Registration not found in organization';
  end if;

  v_signed_amount :=
    case
      when p_transaction_type = 'refund'
        then -abs(p_amount)
      else abs(p_amount)
    end;

  insert into public.payment_transactions (
    organization_id,
    registration_id,
    transaction_type,
    provider,
    amount,
    status,
    payment_method,
    receipt_email,
    notes,
    created_by
  )
  values (
    p_organization_id,
    p_registration_id,
    p_transaction_type,
    'manual',
    v_signed_amount,
    'succeeded',
    nullif(trim(p_payment_method), ''),
    nullif(trim(p_receipt_email), ''),
    nullif(trim(p_notes), ''),
    v_user_id
  )
  returning id into v_transaction_id;

  select coalesce(sum(pt.amount), 0)
  into v_total
  from public.payment_transactions as pt
  where pt.registration_id = p_registration_id
    and pt.organization_id = p_organization_id
    and pt.status = 'succeeded';

  select
    greatest(
      0::numeric,
      coalesce(r.registration_fee, 0)
        - coalesce(r.discount_amount, 0)
    )
    +
    coalesce(
      (
        select sum(
          case
            when rs.total_fee is not null
              then rs.total_fee
            else
              coalesce(rs.entry_fee, 0)
              + coalesce(rs.organization_fee, 0)
              + coalesce(rs.fee_adjustment, 0)
          end
        )
        from public.registration_shoots as rs
        where rs.registration_id = r.id
          and rs.organization_id = p_organization_id
          and rs.status not in (
            'withdrawn',
            'cancelled',
            'disqualified'
          )
      ),
      0::numeric
    )
  into v_expected
  from public.registrations as r
  where r.id = p_registration_id
    and r.organization_id = p_organization_id;

  v_payment_status :=
    case
      when v_total <= 0 then 'unpaid'
      when v_total >= v_expected then 'paid'
      else 'partial'
    end;

  update public.registrations as r
  set
    amount_paid = greatest(0::numeric, v_total),
    payment_status = v_payment_status,
    payment_method = nullif(trim(p_payment_method), ''),
    paid_at =
      case
        when v_payment_status = 'paid'
          then clock_timestamp()
        else null
      end
  where r.id = p_registration_id
    and r.organization_id = p_organization_id;

  return v_transaction_id;
end;
$function$;

revoke all on function public.record_manual_registration_transaction(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  text
) from public;

grant execute on function public.record_manual_registration_transaction(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  text
) to authenticated;
