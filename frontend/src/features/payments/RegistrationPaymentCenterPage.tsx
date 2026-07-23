import { useEffect, useMemo, useState } from "react"
import { BadgeDollarSign, CalendarClock, CreditCard, Percent, Plus, RefreshCw, Save, TicketCheck, WalletCards } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  createDiscountCode,
  loadRegistrationPaymentCenter,
  recordManualTransaction,
  saveRegistrationSetting,
  toggleDiscountCode,
  type DiscountCode,
  type PaymentTransaction,
  type RegistrationEvent,
  type RegistrationSetting,
  type RegistrationSummary,
} from "@/lib/services/registrationPayments"

type Data = {
  organizationId: string
  events: RegistrationEvent[]
  settings: RegistrationSetting[]
  codes: DiscountCode[]
  transactions: PaymentTransaction[]
  registrations: RegistrationSummary[]
}

const emptyData: Data = { organizationId: "", events: [], settings: [], codes: [], transactions: [], registrations: [] }

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0)
}

export function RegistrationPaymentCenterPage() {
  const [data, setData] = useState<Data>(emptyData)
  const [eventId, setEventId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [settings, setSettings] = useState<Omit<RegistrationSetting, "id" | "event_id">>({
    public_registration_enabled: false,
    registration_opens_at: null,
    registration_closes_at: null,
    capacity: null,
    waitlist_enabled: true,
    base_fee: 0,
    payment_provider: "manual",
    stripe_price_id: null,
    confirmation_message: null,
    terms_url: null,
  })
  const [code, setCode] = useState("")
  const [codeValue, setCodeValue] = useState(0)
  const [codeType, setCodeType] = useState<"fixed" | "percent">("fixed")
  const [registrationId, setRegistrationId] = useState("")
  const [transactionAmount, setTransactionAmount] = useState(0)
  const [transactionType, setTransactionType] = useState<"payment" | "refund" | "adjustment">("payment")
  const [paymentMethod, setPaymentMethod] = useState("cash")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const result = await loadRegistrationPaymentCenter()
      setData(result)
      setEventId((current) => current || result.events[0]?.id || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load registration and payment data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    const current = data.settings.find((item) => item.event_id === eventId)
    setSettings(current ? {
      public_registration_enabled: current.public_registration_enabled,
      registration_opens_at: current.registration_opens_at,
      registration_closes_at: current.registration_closes_at,
      capacity: current.capacity,
      waitlist_enabled: current.waitlist_enabled,
      base_fee: Number(current.base_fee || 0),
      payment_provider: current.payment_provider,
      stripe_price_id: current.stripe_price_id,
      confirmation_message: current.confirmation_message,
      terms_url: current.terms_url,
    } : {
      public_registration_enabled: false,
      registration_opens_at: null,
      registration_closes_at: null,
      capacity: null,
      waitlist_enabled: true,
      base_fee: 0,
      payment_provider: "manual",
      stripe_price_id: null,
      confirmation_message: null,
      terms_url: null,
    })
  }, [data.settings, eventId])

  const eventRegistrations = useMemo(() => data.registrations.filter((registration) => registration.event_id === eventId), [data.registrations, eventId])
  const eventCodes = useMemo(() => data.codes.filter((item) => !item.event_id || item.event_id === eventId), [data.codes, eventId])
  const eventRegistrationIds = useMemo(() => new Set(eventRegistrations.map((item) => item.id)), [eventRegistrations])
  const eventTransactions = useMemo(() => data.transactions.filter((item) => eventRegistrationIds.has(item.registration_id)), [data.transactions, eventRegistrationIds])
  const summary = useMemo(() => {
    const expected = eventRegistrations.reduce((sum, row) => sum + Math.max(0, Number(row.registration_fee || 0) - Number(row.discount_amount || 0)), 0)
    const paid = eventRegistrations.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0)
    return { registrations: eventRegistrations.length, expected, paid, balance: Math.max(0, expected - paid) }
  }, [eventRegistrations])

  async function saveSettings() {
    if (!eventId) return
    setSaving(true); setError(""); setNotice("")
    try {
      await saveRegistrationSetting(data.organizationId, eventId, settings)
      setNotice("Registration settings saved.")
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save settings.") }
    finally { setSaving(false) }
  }

  async function addCode() {
    if (!eventId || !code.trim() || codeValue <= 0) return
    setSaving(true); setError("")
    try {
      await createDiscountCode(data.organizationId, {
        event_id: eventId,
        code,
        description: null,
        discount_type: codeType,
        discount_value: codeValue,
        usage_limit: null,
        starts_at: null,
        expires_at: null,
        active: true,
      })
      setCode(""); setCodeValue(0); setNotice("Discount code created.")
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create discount code.") }
    finally { setSaving(false) }
  }

  async function addTransaction() {
    if (!registrationId || transactionAmount <= 0) return
    setSaving(true); setError("")
    try {
      await recordManualTransaction(data.organizationId, { registration_id: registrationId, transaction_type: transactionType, amount: transactionAmount, payment_method: paymentMethod })
      setTransactionAmount(0); setNotice("Transaction recorded and registration balance updated.")
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to record transaction.") }
    finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen">
      <AppHeader title="Registration & Payment Center" description="Open public registration, manage event capacity and discounts, and reconcile payments" />
      <PageContainer>
        <div className="space-y-5">
          <section className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-end">
            <label className="flex-1 space-y-1 text-sm font-medium">Event
              <select className="w-full rounded-lg border bg-white px-3 py-2" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                {data.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
          </section>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={TicketCheck} label="Registrations" value={String(summary.registrations)} />
            <Stat icon={BadgeDollarSign} label="Expected" value={money(summary.expected)} />
            <Stat icon={WalletCards} label="Collected" value={money(summary.paid)} />
            <Stat icon={CreditCard} label="Outstanding" value={money(summary.balance)} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start gap-3"><CalendarClock className="mt-0.5 text-emerald-700" /><div><h2 className="text-lg font-semibold">Public Registration Settings</h2><p className="text-sm text-slate-500">Configure when this event accepts public registrations.</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Toggle label="Public registration enabled" checked={settings.public_registration_enabled} onChange={(value) => setSettings({ ...settings, public_registration_enabled: value })} />
                <Toggle label="Allow waitlist" checked={settings.waitlist_enabled} onChange={(value) => setSettings({ ...settings, waitlist_enabled: value })} />
                <Field label="Opens" type="datetime-local" value={settings.registration_opens_at?.slice(0,16) || ""} onChange={(value) => setSettings({ ...settings, registration_opens_at: value ? new Date(value).toISOString() : null })} />
                <Field label="Closes" type="datetime-local" value={settings.registration_closes_at?.slice(0,16) || ""} onChange={(value) => setSettings({ ...settings, registration_closes_at: value ? new Date(value).toISOString() : null })} />
                <Field label="Capacity" type="number" value={settings.capacity ?? ""} onChange={(value) => setSettings({ ...settings, capacity: value ? Number(value) : null })} />
                <Field label="Base fee" type="number" value={settings.base_fee} onChange={(value) => setSettings({ ...settings, base_fee: Number(value || 0) })} />
                <label className="space-y-1 text-sm font-medium">Payment provider<select className="w-full rounded-lg border bg-white px-3 py-2" value={settings.payment_provider} onChange={(event) => setSettings({ ...settings, payment_provider: event.target.value as "manual" | "stripe" })}><option value="manual">Manual / pay later</option><option value="stripe">Stripe</option></select></label>
                <Field label="Stripe Price ID" value={settings.stripe_price_id || ""} onChange={(value) => setSettings({ ...settings, stripe_price_id: value || null })} placeholder="price_..." />
              </div>
              <label className="mt-4 block space-y-1 text-sm font-medium">Confirmation message<textarea className="min-h-24 w-full rounded-lg border px-3 py-2" value={settings.confirmation_message || ""} onChange={(event) => setSettings({ ...settings, confirmation_message: event.target.value || null })} /></label>
              <div className="mt-4 flex justify-end"><Button onClick={() => void saveSettings()} disabled={saving || !eventId}><Save />Save settings</Button></div>
              {settings.payment_provider === "stripe" ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Stripe mode stores the event configuration, but live card processing still requires Stripe keys and a secure server-side checkout function.</p> : null}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start gap-3"><Percent className="mt-0.5 text-emerald-700" /><div><h2 className="text-lg font-semibold">Discount Codes</h2><p className="text-sm text-slate-500">Create fixed-dollar or percentage discounts for this event.</p></div></div>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px_auto]">
                <input className="rounded-lg border px-3 py-2" placeholder="CODE" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
                <select className="rounded-lg border bg-white px-3 py-2" value={codeType} onChange={(event) => setCodeType(event.target.value as "fixed" | "percent")}><option value="fixed">Fixed</option><option value="percent">Percent</option></select>
                <input className="rounded-lg border px-3 py-2" type="number" min="0" value={codeValue || ""} onChange={(event) => setCodeValue(Number(event.target.value || 0))} />
                <Button onClick={() => void addCode()} disabled={saving || !code || codeValue <= 0}><Plus />Add</Button>
              </div>
              <div className="mt-4 divide-y rounded-xl border">
                {eventCodes.length ? eventCodes.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-3"><div><p className="font-semibold">{item.code}</p><p className="text-xs text-slate-500">{item.discount_type === "percent" ? `${item.discount_value}%` : money(item.discount_value)} · used {item.times_used}{item.usage_limit ? ` of ${item.usage_limit}` : ""}</p></div><Button variant="outline" onClick={() => void toggleDiscountCode(item.id, !item.active).then(load)}>{item.active ? "Disable" : "Enable"}</Button></div>) : <p className="p-5 text-center text-sm text-slate-500">No discount codes for this event.</p>}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Record Payment or Refund</h2><p className="mb-4 text-sm text-slate-500">Manual transactions update the selected registration's amount paid and payment status.</p>
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <select className="rounded-lg border bg-white px-3 py-2" value={registrationId} onChange={(event) => setRegistrationId(event.target.value)}><option value="">Select registration</option>{eventRegistrations.map((item) => <option key={item.id} value={item.id}>{item.id.slice(0,8)} · {item.payment_status} · paid {money(item.amount_paid)}</option>)}</select>
              <select className="rounded-lg border bg-white px-3 py-2" value={transactionType} onChange={(event) => setTransactionType(event.target.value as typeof transactionType)}><option value="payment">Payment</option><option value="refund">Refund</option><option value="adjustment">Adjustment</option></select>
              <input className="rounded-lg border px-3 py-2" type="number" min="0.01" step="0.01" placeholder="Amount" value={transactionAmount || ""} onChange={(event) => setTransactionAmount(Number(event.target.value || 0))} />
              <select className="rounded-lg border bg-white px-3 py-2" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="check">Check</option><option value="credit_card">Credit card</option><option value="debit_card">Debit card</option><option value="other">Other</option></select>
              <Button onClick={() => void addTransaction()} disabled={saving || !registrationId || transactionAmount <= 0}>Record</Button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <header className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Recent Transactions</h2></header>
            {eventTransactions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Processed</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{eventTransactions.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3">{new Date(item.processed_at).toLocaleString()}</td><td className="px-4 py-3 font-mono text-xs">{item.registration_id.slice(0,8)}</td><td className="px-4 py-3 capitalize">{item.transaction_type}</td><td className="px-4 py-3 capitalize">{item.provider}</td><td className="px-4 py-3">{item.payment_method || "—"}</td><td className={`px-4 py-3 text-right font-semibold ${item.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>{money(item.amount)}</td></tr>)}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">No transactions recorded for this event.</div>}
          </section>
        </div>
      </PageContainer>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof TicketCheck; label: string; value: string }) { return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="text-xl font-bold">{value}</p></div></div></div> }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label> }
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label className="space-y-1 text-sm font-medium">{label}<input className="w-full rounded-lg border px-3 py-2" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label> }
