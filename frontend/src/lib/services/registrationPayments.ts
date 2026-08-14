import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type RegistrationEvent = {
  id: string
  name: string
  start_date: string | null
  status: string
}

export type RegistrationSetting = {
  id: string
  event_id: string
  public_registration_enabled: boolean
  registration_opens_at: string | null
  registration_closes_at: string | null
  capacity: number | null
  waitlist_enabled: boolean
  base_fee: number
  payment_provider: "manual" | "stripe"
  stripe_price_id: string | null
  confirmation_message: string | null
  terms_url: string | null
}

export type DiscountCode = {
  id: string
  event_id: string | null
  code: string
  description: string | null
  discount_type: "fixed" | "percent"
  discount_value: number
  usage_limit: number | null
  times_used: number
  starts_at: string | null
  expires_at: string | null
  active: boolean
}

export type PaymentTransaction = {
  id: string
  registration_id: string
  transaction_type: "payment" | "refund" | "adjustment"
  provider: "manual" | "stripe" | "imported"
  amount: number
  status: string
  payment_method: string | null
  receipt_email: string | null
  notes: string | null
  processed_at: string
}

export type RegistrationSummary = {
  id: string
  event_id: string
  payment_status: string
  amount_paid: number
  registration_fee: number
  discount_amount: number
  shoot_fees: number
}

function check(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Database request failed.")
}

export async function loadRegistrationPaymentCenter(eventId?: string) {
  const organizationId = await getCurrentOrganizationId()

  const eventsResult = await supabase
    .from("events")
    .select("id, name, start_date, status")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false })

  check(eventsResult.error)

  const events = (eventsResult.data ?? []) as RegistrationEvent[]
  const selectedEventId = eventId || events[0]?.id || ""

  if (!selectedEventId) {
    return {
      organizationId,
      events,
      settings: [] as RegistrationSetting[],
      codes: [] as DiscountCode[],
      transactions: [] as PaymentTransaction[],
      registrations: [] as RegistrationSummary[],
    }
  }

  const [settings, codes, registrations, shootFees] = await Promise.all([
    supabase
      .from("event_registration_settings")
      .select(
        "id, event_id, public_registration_enabled, registration_opens_at, registration_closes_at, capacity, waitlist_enabled, base_fee, payment_provider, stripe_price_id, confirmation_message, terms_url",
      )
      .eq("organization_id", organizationId)
      .eq("event_id", selectedEventId),

    supabase
      .from("discount_codes")
      .select(
        "id, event_id, code, description, discount_type, discount_value, usage_limit, times_used, starts_at, expires_at, active",
      )
      .eq("organization_id", organizationId)
      .eq("event_id", selectedEventId)
      .order("created_at", { ascending: false }),

    supabase
      .from("registrations")
      .select(
        "id, event_id, payment_status, amount_paid, registration_fee, discount_amount",
      )
      .eq("organization_id", organizationId)
      .eq("event_id", selectedEventId),

    supabase
      .from("registration_shoots")
      .select(
        "registration_id, entry_fee, organization_fee, fee_adjustment, total_fee",
      )
      .eq("organization_id", organizationId)
      .eq("event_id", selectedEventId)
      .not("status", "in", "(withdrawn,cancelled,disqualified)"),
  ])

  for (const result of [
    settings,
    codes,
    registrations,
    shootFees,
  ]) {
    check(result.error)
  }

  const registrationRows = registrations.data ?? []
  const registrationIds = registrationRows.map((row) => row.id)

  const transactions = registrationIds.length
    ? await supabase
        .from("payment_transactions")
        .select(
          "id, registration_id, transaction_type, provider, amount, status, payment_method, receipt_email, notes, processed_at",
        )
        .eq("organization_id", organizationId)
        .in("registration_id", registrationIds)
        .order("processed_at", { ascending: false })
        .limit(250)
    : { data: [], error: null }

  check(transactions.error)

  const feesByRegistration = new Map<string, number>()

  for (const row of shootFees.data ?? []) {
    const registrationId = row.registration_id as string

    const calculatedFee =
      Number(row.entry_fee || 0) +
      Number(row.organization_fee || 0) +
      Number(row.fee_adjustment || 0)

    const fee =
      row.total_fee === null || row.total_fee === undefined
        ? calculatedFee
        : Number(row.total_fee)

    feesByRegistration.set(
      registrationId,
      (feesByRegistration.get(registrationId) || 0) + fee,
    )
  }

  const registrationSummaries = registrationRows.map((row) => ({
    ...row,
    shoot_fees: feesByRegistration.get(row.id) || 0,
  })) as RegistrationSummary[]

  return {
    organizationId,
    events,
    settings: (settings.data ?? []) as RegistrationSetting[],
    codes: (codes.data ?? []) as DiscountCode[],
    transactions: (transactions.data ?? []) as PaymentTransaction[],
    registrations: registrationSummaries,
  }
}

export async function saveRegistrationSetting(organizationId: string, eventId: string, values: Omit<RegistrationSetting, "id" | "event_id">) {
  const { error } = await supabase.from("event_registration_settings").upsert({ organization_id: organizationId, event_id: eventId, ...values }, { onConflict: "event_id" })
  check(error)
}

export async function createDiscountCode(organizationId: string, input: Omit<DiscountCode, "id" | "times_used">) {
  const { error } = await supabase.from("discount_codes").insert({ organization_id: organizationId, times_used: 0, ...input, code: input.code.trim().toUpperCase() })
  check(error)
}

export async function toggleDiscountCode(id: string, active: boolean) {
  const { error } = await supabase.from("discount_codes").update({ active }).eq("id", id)
  check(error)
}

export async function recordManualTransaction(organizationId: string, input: {
  registration_id: string
  transaction_type: "payment" | "refund" | "adjustment"
  amount: number
  payment_method: string
  receipt_email?: string
  notes?: string
}) {
  const { error } = await supabase.rpc("record_manual_registration_transaction", {
    p_organization_id: organizationId,
    p_registration_id: input.registration_id,
    p_transaction_type: input.transaction_type,
    p_amount: Math.abs(input.amount),
    p_payment_method: input.payment_method,
    p_receipt_email: input.receipt_email?.trim() || null,
    p_notes: input.notes?.trim() || null,
  })
  check(error)
}
