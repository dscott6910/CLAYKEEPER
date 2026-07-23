import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, BadgeDollarSign, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, ExternalLink, RefreshCw, Siren, Target, Trophy, Users } from "lucide-react"
import { AppHeader } from "@/app/AppHeader"
import { Button } from "@/components/ui/button"
import { loadEventOperations, type EventOperationsSnapshot, type OperationsAlert } from "@/lib/services/eventOperations"

function pct(value: number, total: number) { return total > 0 ? Math.round((value / total) * 100) : 0 }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value) }
function time(value: string | null) { if (!value) return "Not scheduled"; const [h = "0", m = "00"] = value.split(":"); return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, Number(h), Number(m))) }
function when(value: string | null) { if (!value) return "Recently"; return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) }
function alertStyle(severity: OperationsAlert["severity"]) { return severity === "urgent" ? "border-red-200 bg-red-50 text-red-800" : severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : severity === "info" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-emerald-200 bg-emerald-50 text-emerald-800" }

export function EventOperationsPage() {
  const [snapshot, setSnapshot] = useState<EventOperationsSnapshot | null>(null)
  const [eventId, setEventId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function refresh(nextEventId?: string) {
    setLoading(true); setError("")
    try { const next = await loadEventOperations(nextEventId || undefined); setSnapshot(next); setEventId(next.selectedEvent?.id ?? "") }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load event operations.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  const checkIn = pct(snapshot?.checkedIn ?? 0, snapshot?.registrations ?? 0)
  const squadding = pct(snapshot?.assigned ?? 0, snapshot?.enrollments ?? 0)
  const scoring = pct(snapshot?.scoreEntries ?? 0, snapshot?.expectedScoreEntries ?? 0)
  const revenue = pct(snapshot?.amountPaid ?? 0, snapshot?.expectedRevenue ?? 0)
  const squadCounts = useMemo(() => ({ waiting: snapshot?.squads.filter((row) => row.status === "waiting").length ?? 0, active: snapshot?.squads.filter((row) => row.status === "in_progress").length ?? 0, complete: snapshot?.squads.filter((row) => row.status === "complete").length ?? 0 }), [snapshot])

  const actions = [
    ["Registration", "/registration", ClipboardCheck], ["Squadding", "/squads", Users], ["Live Scoring", "/scoring", Target], ["Awards", "/awards", Trophy], ["Treasurer", "/treasurer", BadgeDollarSign], ["Reports", "/reports", CalendarDays],
  ] as const

  return <div className="min-h-screen">
    <AppHeader title="Event Operations Center" description="Real-time tournament monitoring, alerts, and staff actions" />
    <div className="space-y-6 p-4 md:p-6">
      <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[.18em] text-emerald-400">Live operations</p><h2 className="mt-2 text-3xl font-bold">{snapshot?.selectedEvent?.name ?? "Select an event"}</h2><p className="mt-2 text-sm text-slate-400">One screen for tournament readiness, field activity, scoring, awards, and payments.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row"><select value={eventId} onChange={(e) => { setEventId(e.target.value); void refresh(e.target.value) }} className="min-w-64 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white">{snapshot?.events.map((event) => <option className="text-slate-950" value={event.id} key={event.id}>{event.name}</option>)}</select><Button variant="secondary" onClick={() => void refresh(eventId)} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button></div>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Check-in", checkIn, `${snapshot?.checkedIn ?? 0} of ${snapshot?.registrations ?? 0}`], ["Squadding", squadding, `${snapshot?.assigned ?? 0} of ${snapshot?.enrollments ?? 0}`], ["Scoring", scoring, `${snapshot?.scoreEntries ?? 0} of ${snapshot?.expectedScoreEntries ?? 0}`], ["Revenue collected", revenue, `${money(snapshot?.amountPaid ?? 0)} of ${money(snapshot?.expectedRevenue ?? 0)}`]].map(([label, value, detail]) => <div key={String(label)} className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex justify-between text-sm"><span>{label}</span><strong>{value}%</strong></div><div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Number(value))}%` }} /></div><p className="mt-2 text-xs text-slate-400">{detail}</p></div>)}</div>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[
        { label: "Registrations", value: snapshot?.registrations ?? 0, detail: `${snapshot?.unpaid ?? 0} unpaid`, icon: Users },
        { label: "Squads", value: snapshot?.squads.length ?? 0, detail: `${squadCounts.active} active`, icon: Target },
        { label: "Completed scorecards", value: snapshot?.completedParticipants ?? 0, detail: `${snapshot?.enrollments ?? 0} enrollments`, icon: CheckCircle2 },
        { label: "Published awards", value: snapshot?.awardPublications ?? 0, detail: `${snapshot?.shoots.length ?? 0} shoots`, icon: Trophy },
      ].map(({ label, value, detail, icon: Icon }) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></div></div></article>)}</section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h3 className="text-lg font-semibold">Staff alerts</h3><p className="mt-1 text-sm text-slate-500">Automatically detected items that may need attention</p></div><div className="space-y-3 p-5">{snapshot?.alerts.map((alert) => <Link key={alert.id} to={alert.path} className={`flex items-start gap-3 rounded-xl border p-4 transition hover:shadow-sm ${alertStyle(alert.severity)}`}>{alert.severity === "urgent" ? <Siren className="mt-0.5 h-5 w-5" /> : alert.severity === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}<div className="flex-1"><p className="font-semibold">{alert.title}</p><p className="mt-1 text-sm opacity-80">{alert.detail}</p></div><ExternalLink className="h-4 w-4" /></Link>)}</div></article>
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h3 className="text-lg font-semibold">Staff action center</h3><p className="mt-1 text-sm text-slate-500">Jump directly to core tournament tools</p></div><div className="grid grid-cols-2 gap-3 p-5">{actions.map(([label, path, Icon]) => <Link key={path} to={path} className="rounded-xl border border-slate-200 p-4 text-center transition hover:border-emerald-300 hover:bg-emerald-50"><Icon className="mx-auto h-5 w-5 text-emerald-700" /><p className="mt-2 text-sm font-semibold text-slate-800">{label}</p></Link>)}</div></article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h3 className="text-lg font-semibold">Field and squad monitor</h3><p className="mt-1 text-sm text-slate-500">Waiting, active, and completed squads</p></div><div className="flex gap-2 text-xs font-semibold"><span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{squadCounts.waiting} waiting</span><span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">{squadCounts.active} active</span><span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{squadCounts.complete} complete</span></div></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Shoot</th><th className="px-5 py-3">Squad</th><th className="px-5 py-3">Start</th><th className="px-5 py-3">Participants</th><th className="px-5 py-3">Progress</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot?.squads.map((row) => <tr key={row.id}><td className="px-5 py-4 font-medium">{row.shootName}</td><td className="px-5 py-4">{row.squadNumber}</td><td className="px-5 py-4">{time(row.startTime)}</td><td className="px-5 py-4">{row.participants}</td><td className="px-5 py-4">{row.scoreEntries}/{row.expectedScores}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "complete" ? "bg-emerald-100 text-emerald-800" : row.status === "in_progress" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{row.status.replace("_", " ")}</span></td></tr>)}{!snapshot?.squads.length ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No squads have been created for this event.</td></tr> : null}</tbody></table></div></article>
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h3 className="text-lg font-semibold">Operations timeline</h3><p className="mt-1 text-sm text-slate-500">Latest event activity</p></div><div className="divide-y divide-slate-100">{snapshot?.timeline.map((item) => <div key={item.id} className="flex gap-3 p-4"><div className="mt-1 rounded-full bg-slate-100 p-2"><Clock3 className="h-4 w-4 text-slate-600" /></div><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p><p className="mt-1 text-xs text-slate-400">{when(item.time)}</p></div></div>)}{!snapshot?.timeline.length ? <p className="p-6 text-center text-sm text-slate-500">No recent activity yet.</p> : null}</div></article>
      </section>
    </div>
  </div>
}
