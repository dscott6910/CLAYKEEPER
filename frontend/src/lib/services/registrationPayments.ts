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
}

function check(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Database request failed.")
}

export async function loadRegistrationPaymentCenter() {
  const organizationId = await getCurrentOrganizationId()
  const [events, settings, codes, transactions, registrations] = await Promise.all([
    supabase.from("events").select("id, name, start_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
    supabase.from("event_registration_settings").select("id, event_id, public_registration_enabled, registration_opens_at, registration_closes_at, capacity, waitlist_enabled, base_fee, payment_provider, stripe_price_id, confirmation_message, terms_url").eq("organization_id", organizationId),
    supabase.from("discount_codes").select("id, event_id, code, description, discount_type, discount_value, usage_limit, times_used, starts_at, expires_at, active").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("payment_transactions").select("id, registration_id, transaction_type, provider, amount, status, payment_method, receipt_email, notes, processed_at").eq("organization_id", organizationId).order("processed_at", { ascending: false }).limit(250),
    supabase.from("registrations").select("id, event_id, payment_status, amount_paid, registration_fee, discount_amount").eq("organization_id", organizationId),
  ])
  for (const result of [events, settings, codes, transactions, registrations]) check(result.error)
  return {
    organizationId,
    events: (events.data ?? []) as RegistrationEvent[],
    settings: (settings.data ?? []) as RegistrationSetting[],
    codes: (codes.data ?? []) as DiscountCode[],
    transactions: (transactions.data ?? []) as PaymentTransaction[],
    registrations: (registrations.data ?? []) as RegistrationSummary[],
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
  const signedAmount = input.transaction_type === "refund" ? -Math.abs(input.amount) : Math.abs(input.amount)
  const { error } = await supabase.from("payment_transactions").insert({
    organization_id: organizationId,
    ...input,
    amount: signedAmount,
    provider: "manual",
    status: "succeeded",
  })
  check(error)

  const { data: transactions, error: transactionError } = await supabase.from("payment_transactions").select("amount").eq("registration_id", input.registration_id).eq("status", "succeeded")
  check(transactionError)
  const total = (transactions ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const { data: registration, error: registrationError } = await supabase.from("registrations").select("registration_fee, discount_amount").eq("id", input.registration_id).single()
  check(registrationError)
  const expected = Math.max(0, Number(registration?.registration_fee || 0) - Number(registration?.discount_amount || 0))
  const status = total <= 0 ? "unpaid" : total >= expected ? "paid" : "partial"
  const { error: updateError } = await supabase.from("registrations").update({ amount_paid: Math.max(0, total), payment_status: status, payment_method: input.payment_method, paid_at: status === "paid" ? new Date().toISOString() : null }).eq("id", input.registration_id)
  check(updateError)
}
