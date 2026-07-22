import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Banknote, Download, FileSpreadsheet, Printer, ReceiptText, RefreshCw, Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadTreasurerData,
  type TreasurerAthlete,
  type TreasurerClass,
  type TreasurerEnrollment,
  type TreasurerEvent,
  type TreasurerNamedRecord,
  type TreasurerRegistration,
  type TreasurerSeason,
  type TreasurerShoot,
} from "@/lib/services/treasurer"

type Data = {
  seasons: TreasurerSeason[]
  events: TreasurerEvent[]
  shoots: TreasurerShoot[]
  registrations: TreasurerRegistration[]
  enrollments: TreasurerEnrollment[]
  athletes: TreasurerAthlete[]
  teams: TreasurerNamedRecord[]
  classes: TreasurerClass[]
}

type LedgerRow = {
  registrationId: string
  eventId: string
  eventName: string
  eventDate: string | null
  participant: string
  cyssaNumber: string | null
  team: string
  classCode: string
  shoots: string
  paymentStatus: string
  paymentMethod: string
  registrationSource: string
  eventFee: number
  shootFees: number
  organizationFees: number
  adjustments: number
  expected: number
  paid: number
  balance: number
}

const emptyData: Data = { seasons: [], events: [], shoots: [], registrations: [], enrollments: [], athletes: [], teams: [], classes: [] }
const inactiveStatuses = new Set(["withdrawn", "cancelled"])

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0)
}

function csvValue(value: string | number | null) {
  const text = value === null ? "" : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function participantName(athlete: TreasurerAthlete | undefined) {
  if (!athlete) return "Unknown participant"
  const first = athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim() || "Unnamed participant"
}

function formatDate(date: string | null) {
  if (!date) return "No date"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`))
}

export function TreasurerPage() {
  const [data, setData] = useState<Data>(emptyData)
  const [seasonId, setSeasonId] = useState("all")
  const [eventId, setEventId] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const next = await loadTreasurerData()
      setData(next)
      if (seasonId === "all") {
        const active = next.seasons.find((season) => season.status === "active")
        if (active) setSeasonId(active.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load treasurer reports.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const seasonEvents = useMemo(() => seasonId === "all" ? data.events : data.events.filter((event) => event.season_id === seasonId), [data.events, seasonId])

  useEffect(() => {
    if (eventId !== "all" && !seasonEvents.some((event) => event.id === eventId)) setEventId("all")
  }, [seasonEvents, eventId])

  const rows = useMemo<LedgerRow[]>(() => {
    const events = new Map(data.events.map((event) => [event.id, event]))
    const athletes = new Map(data.athletes.map((athlete) => [athlete.id, athlete]))
    const teams = new Map(data.teams.map((team) => [team.id, team]))
    const classes = new Map(data.classes.map((cls) => [cls.id, cls]))
    const shoots = new Map(data.shoots.map((shoot) => [shoot.id, shoot]))
    const enrollmentsByRegistration = new Map<string, TreasurerEnrollment[]>()
    for (const enrollment of data.enrollments) {
      if (inactiveStatuses.has(enrollment.status)) continue
      enrollmentsByRegistration.set(enrollment.registration_id, [...(enrollmentsByRegistration.get(enrollment.registration_id) || []), enrollment])
    }

    return data.registrations.filter((registration) => !inactiveStatuses.has(registration.status)).map((registration) => {
      const event = events.get(registration.event_id)
      const athlete = athletes.get(registration.athlete_id)
      const registrationEnrollments = enrollmentsByRegistration.get(registration.id) || []
      const eventFee = Math.max(0, Number(registration.registration_fee || 0) - Number(registration.discount_amount || 0))
      const shootFees = registrationEnrollments.reduce((sum, enrollment) => sum + Number(enrollment.entry_fee || 0), 0)
      const organizationFees = registrationEnrollments.reduce((sum, enrollment) => sum + Number(enrollment.organization_fee || 0), 0)
      const adjustments = registrationEnrollments.reduce((sum, enrollment) => sum + Number(enrollment.fee_adjustment || 0), 0)
      const expected = eventFee + shootFees + organizationFees + adjustments
      const paid = Number(registration.amount_paid || 0)
      return {
        registrationId: registration.id,
        eventId: registration.event_id,
        eventName: event?.name || "Unknown event",
        eventDate: event?.start_date || null,
        participant: participantName(athlete),
        cyssaNumber: athlete?.cyssa_number || null,
        team: teams.get(registration.team_id || "")?.name || "No team",
        classCode: classes.get(registration.class_id || "")?.code || "—",
        shoots: registrationEnrollments.map((enrollment) => shoots.get(enrollment.shoot_id)?.name || "Unknown shoot").join(", ") || "No shoots",
        paymentStatus: registration.payment_status,
        paymentMethod: registration.payment_method || "Not recorded",
        registrationSource: registration.registration_source,
        eventFee,
        shootFees,
        organizationFees,
        adjustments,
        expected,
        paid,
        balance: Math.max(0, expected - paid),
      }
    }).sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || "") || a.participant.localeCompare(b.participant))
  }, [data])

  const filteredRows = useMemo(() => {
    const eligibleEventIds = new Set(seasonEvents.map((event) => event.id))
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (seasonId !== "all" && !eligibleEventIds.has(row.eventId)) return false
      if (eventId !== "all" && row.eventId !== eventId) return false
      if (paymentFilter === "balance" && row.balance <= 0) return false
      if (paymentFilter !== "all" && paymentFilter !== "balance" && row.paymentStatus !== paymentFilter) return false
      if (!needle) return true
      return [row.participant, row.cyssaNumber || "", row.team, row.classCode, row.eventName, row.shoots].some((value) => value.toLowerCase().includes(needle))
    })
  }, [rows, seasonEvents, seasonId, eventId, paymentFilter, search])

  const summary = useMemo(() => filteredRows.reduce((acc, row) => ({
    registrations: acc.registrations + 1,
    expected: acc.expected + row.expected,
    paid: acc.paid + row.paid,
    balance: acc.balance + row.balance,
    organizationFees: acc.organizationFees + row.organizationFees,
  }), { registrations: 0, expected: 0, paid: 0, balance: 0, organizationFees: 0 }), [filteredRows])

  const eventSummary = useMemo(() => {
    const grouped = new Map<string, LedgerRow[]>()
    for (const row of filteredRows) grouped.set(row.eventId, [...(grouped.get(row.eventId) || []), row])
    return Array.from(grouped.values()).map((eventRows) => ({
      eventId: eventRows[0].eventId,
      eventName: eventRows[0].eventName,
      eventDate: eventRows[0].eventDate,
      participants: eventRows.length,
      expected: eventRows.reduce((sum, row) => sum + row.expected, 0),
      paid: eventRows.reduce((sum, row) => sum + row.paid, 0),
      balance: eventRows.reduce((sum, row) => sum + row.balance, 0),
      organizationFees: eventRows.reduce((sum, row) => sum + row.organizationFees, 0),
    })).sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || ""))
  }, [filteredRows])

  function exportCsv() {
    const headers = ["Event", "Date", "Participant", "CYSSA #", "Team", "Class", "Shoots", "Payment Status", "Payment Method", "Source", "Event Fee", "Shoot Fees", "Organization Fees", "Adjustments", "Expected", "Paid", "Balance"]
    const lines = [headers.map(csvValue).join(",")]
    for (const row of filteredRows) lines.push([row.eventName, row.eventDate, row.participant, row.cyssaNumber, row.team, row.classCode, row.shoots, row.paymentStatus, row.paymentMethod, row.registrationSource, row.eventFee, row.shootFees, row.organizationFees, row.adjustments, row.expected, row.paid, row.balance].map(csvValue).join(","))
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "claykeeper-treasurer-ledger.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      <AppHeader title="Treasurer Center" description="Review registration income, organization fees, payments, and outstanding balances by season and event" />
      <PageContainer>
        <div className="space-y-5">
          <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto] print:hidden">
            <label className="space-y-1 text-sm font-medium">Season
              <select className="w-full rounded-lg border bg-white px-3 py-2" value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
                <option value="all">All seasons</option>
                {data.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.status === "active" ? " (Active)" : ""}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Event
              <select className="w-full rounded-lg border bg-white px-3 py-2" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                <option value="all">All events</option>
                {seasonEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Payment
              <select className="w-full rounded-lg border bg-white px-3 py-2" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="all">All payment statuses</option><option value="balance">Outstanding balance</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option><option value="waived">Waived</option><option value="refunded">Refunded</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Search
              <input className="w-full rounded-lg border px-3 py-2" placeholder="Participant, team, event…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
              <Button variant="outline" onClick={() => window.print()}><Printer /></Button>
              <Button onClick={exportCsv} disabled={!filteredRows.length}><Download />CSV</Button>
            </div>
          </section>

          {error ? <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Treasurer reports could not load.</strong><p>{error}</p></div></div> : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat icon={Users} label="Registrations" value={summary.registrations} />
            <Stat icon={ReceiptText} label="Expected revenue" value={money(summary.expected)} />
            <Stat icon={Banknote} label="Amount paid" value={money(summary.paid)} />
            <Stat icon={AlertCircle} label="Outstanding" value={money(summary.balance)} emphasis={summary.balance > 0} />
            <Stat icon={FileSpreadsheet} label="Organization fees" value={money(summary.organizationFees)} />
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <header className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Event Financial Summary</h2><p className="text-sm text-slate-500">A season-level view of registration activity and fee totals.</p></header>
            {loading ? <div className="p-10 text-center text-slate-500">Loading financial records…</div> : eventSummary.length === 0 ? <div className="p-10 text-center text-slate-500">No financial records match the selected filters.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Event</th><th className="px-4 py-3 text-center">Participants</th><th className="px-4 py-3 text-right">Expected</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Organization Fees</th></tr></thead><tbody>{eventSummary.map((event) => <tr key={event.eventId} className="border-t"><td className="px-4 py-3"><p className="font-semibold">{event.eventName}</p><p className="text-xs text-slate-500">{formatDate(event.eventDate)}</p></td><td className="px-4 py-3 text-center">{event.participants}</td><td className="px-4 py-3 text-right font-medium">{money(event.expected)}</td><td className="px-4 py-3 text-right font-medium text-emerald-700">{money(event.paid)}</td><td className="px-4 py-3 text-right font-medium text-amber-700">{money(event.balance)}</td><td className="px-4 py-3 text-right font-medium">{money(event.organizationFees)}</td></tr>)}</tbody></table></div>}
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <header className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Participant Ledger</h2><p className="text-sm text-slate-500">One row per event registration, including every enrolled shoot and fee snapshot.</p></header>
            {filteredRows.length === 0 ? <div className="p-10 text-center text-slate-500">No participant ledger records match the selected filters.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1350px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Team / Class</th><th className="px-4 py-3">Shoots</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right">Event Fee</th><th className="px-4 py-3 text-right">Shoot Fees</th><th className="px-4 py-3 text-right">Org Fees</th><th className="px-4 py-3 text-right">Expected</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Balance</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.registrationId} className="border-t align-top"><td className="px-4 py-3"><p className="font-semibold">{row.participant}</p><p className="text-xs text-slate-500">{row.cyssaNumber ? `CYSSA ${row.cyssaNumber}` : "No CYSSA number"}</p></td><td className="px-4 py-3"><p className="font-medium">{row.eventName}</p><p className="text-xs text-slate-500">{formatDate(row.eventDate)}</p></td><td className="px-4 py-3"><p>{row.team}</p><p className="text-xs text-slate-500">Class {row.classCode}</p></td><td className="max-w-[260px] px-4 py-3 text-slate-600">{row.shoots}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.balance > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{row.paymentStatus}</span><p className="mt-1 text-xs text-slate-500">{row.paymentMethod}</p></td><td className="px-4 py-3 text-right">{money(row.eventFee)}</td><td className="px-4 py-3 text-right">{money(row.shootFees)}</td><td className="px-4 py-3 text-right">{money(row.organizationFees)}</td><td className="px-4 py-3 text-right font-semibold">{money(row.expected)}</td><td className="px-4 py-3 text-right font-semibold text-emerald-700">{money(row.paid)}</td><td className="px-4 py-3 text-right font-semibold text-amber-700">{money(row.balance)}</td></tr>)}</tbody></table></div>}
          </section>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 print:hidden"><strong>Historical import note:</strong> The 2026 US Open contains competition fees, but the source workbook may not contain actual payment transactions. Expected revenue will be populated from imported fees; Amount Paid remains zero until payment information is imported or entered.</div>
        </div>
      </PageContainer>
    </div>
  )
}

function Stat({ icon: Icon, label, value, emphasis = false }: { icon: typeof Users; label: string; value: string | number; emphasis?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm ${emphasis ? "border-amber-200 bg-amber-50" : "bg-white"}`}><div className="rounded-lg bg-slate-100 p-2"><Icon className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="text-xl font-bold">{value}</p></div></div>
}
