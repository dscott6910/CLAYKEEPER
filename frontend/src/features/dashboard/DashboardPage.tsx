import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  RefreshCw,
  Target,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { Button } from "@/components/ui/button"
import { loadDashboardSnapshot, type DashboardSnapshot, type SquadOperationsRow } from "@/lib/services/dashboard"

function formatDate(value: string | null) {
  if (!value) return "Date not set"
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function formatTime(value: string | null) {
  if (!value) return "Time not set"
  const [hour = "0", minute = "00"] = value.split(":")
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, Number(hour), Number(minute)))
}

function eventCountdown(startDate: string | null) {
  if (!startDate) return "Event date not set"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${startDate}T00:00:00`)
  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000)
  if (days === 0) return "Event starts today"
  if (days === 1) return "Event starts tomorrow"
  if (days > 1) return `${days} days until the event`
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} since the event began`
}

function statusStyles(status: SquadOperationsRow["status"]) {
  if (status === "complete") return { label: "Complete", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 }
  if (status === "in_progress") return { label: "In progress", className: "bg-blue-100 text-blue-800", icon: CircleDot }
  return { label: "Waiting", className: "bg-amber-100 text-amber-800", icon: Clock3 }
}

export function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [selectedEventId, setSelectedEventId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function refresh(eventId?: string) {
    setLoading(true)
    setError("")
    try {
      const next = await loadDashboardSnapshot(eventId || undefined)
      setSnapshot(next)
      setSelectedEventId(next.selectedEvent?.id ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the command center.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const scorePercent = snapshot?.expectedScoreEntries
    ? Math.round((snapshot.scoreEntries / snapshot.expectedScoreEntries) * 100)
    : 0
  const checkInPercent = snapshot?.registrations
    ? Math.round((snapshot.checkedIn / snapshot.registrations) * 100)
    : 0
  const assignmentPercent = snapshot?.enrolledParticipants
    ? Math.round((snapshot.assignedParticipants / snapshot.enrolledParticipants) * 100)
    : 0

  const operations = useMemo(() => {
    const rows = snapshot?.squadOperations ?? []
    return {
      waiting: rows.filter((row) => row.status === "waiting").length,
      inProgress: rows.filter((row) => row.status === "in_progress").length,
      complete: rows.filter((row) => row.status === "complete").length,
    }
  }, [snapshot])

  const readiness = useMemo(() => {
    if (!snapshot) return []
    return [
      { label: "Participants registered", detail: `${snapshot.registrations} registrations`, done: snapshot.registrations > 0, path: "/registration" },
      { label: "Participants checked in", detail: `${snapshot.checkedIn} of ${snapshot.registrations}`, done: snapshot.registrations > 0 && snapshot.checkedIn === snapshot.registrations, path: "/registration" },
      { label: "Shoot assignments complete", detail: snapshot.unassignedParticipants ? `${snapshot.unassignedParticipants} still unassigned` : "All enrolled participants assigned", done: snapshot.enrolledParticipants > 0 && snapshot.unassignedParticipants === 0, path: "/squads" },
      { label: "Scoring underway", detail: `${snapshot.scoreEntries} of ${snapshot.expectedScoreEntries} round scores`, done: snapshot.scoreEntries > 0, path: "/scoring" },
    ]
  }, [snapshot])

  const statistics = [
    { label: "Registrations", value: snapshot?.registrations ?? 0, detail: `${snapshot?.checkedIn ?? 0} checked in`, icon: ClipboardList },
    { label: "Shoot Enrollments", value: snapshot?.enrolledParticipants ?? 0, detail: `${snapshot?.unassignedParticipants ?? 0} unassigned`, icon: UserCheck },
    { label: "Squads", value: snapshot?.squads ?? 0, detail: `${operations.inProgress} currently active`, icon: Users },
    { label: "Scores Entered", value: `${snapshot?.scoreEntries ?? 0} / ${snapshot?.expectedScoreEntries ?? 0}`, detail: `${snapshot?.completedParticipants ?? 0} participants complete`, icon: Trophy },
  ]

  return (
    <div className="min-h-screen">
      <AppHeader title="Tournament Command Center" description="Live event readiness, squad activity, and scoring progress" />
      <div className="space-y-6 p-4 md:p-6">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-sm">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Tournament operations</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{snapshot?.selectedEvent?.name ?? "Select an event"}</h2>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                  <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatDate(snapshot?.selectedEvent?.start_date ?? null)}</span>
                  <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{eventCountdown(snapshot?.selectedEvent?.start_date ?? null)}</span>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <select
                  value={selectedEventId}
                  onChange={(event) => { setSelectedEventId(event.target.value); void refresh(event.target.value) }}
                  className="min-w-64 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none ring-emerald-400 focus:ring-2"
                >
                  {(snapshot?.events ?? []).map((event) => <option key={event.id} value={event.id} className="text-slate-950">{event.name}</option>)}
                </select>
                <Button variant="secondary" onClick={() => void refresh(selectedEventId)} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                { label: "Check-in", value: checkInPercent, detail: `${snapshot?.checkedIn ?? 0} of ${snapshot?.registrations ?? 0}` },
                { label: "Squadding", value: assignmentPercent, detail: `${snapshot?.assignedParticipants ?? 0} of ${snapshot?.enrolledParticipants ?? 0}` },
                { label: "Scoring", value: scorePercent, detail: `${snapshot?.scoreEntries ?? 0} of ${snapshot?.expectedScoreEntries ?? 0}` },
              ].map((metric) => (
                <div key={metric.label} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-200">{metric.label}</span><span className="font-bold text-white">{metric.value}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, metric.value)}%` }} /></div>
                  <p className="mt-2 text-xs text-slate-400">{metric.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {error ? <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertCircle className="h-5 w-5" />{error}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statistics.map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></div>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-lg font-semibold text-slate-950">Squad operations</h3><p className="mt-1 text-sm text-slate-500">Live status based on score-entry progress</p></div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{operations.waiting} waiting</span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">{operations.inProgress} active</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{operations.complete} complete</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {snapshot?.squadOperations.length ? snapshot.squadOperations.slice(0, 10).map((row) => {
                const style = statusStyles(row.status)
                const StatusIcon = style.icon
                const percent = row.expectedScoreEntries ? Math.round((row.scoreEntries / row.expectedScoreEntries) * 100) : 0
                return (
                  <div key={row.id} className="grid gap-3 p-5 md:grid-cols-[1fr_120px_160px_120px] md:items-center">
                    <div><p className="font-semibold text-slate-950">Squad {row.squadNumber}</p><p className="text-sm text-slate-500">{row.shootName} · {formatTime(row.startTime)}</p></div>
                    <div><p className="text-sm font-medium text-slate-800">{row.participantCount} participants</p><p className="text-xs text-slate-500">{row.completedParticipants} complete</p></div>
                    <div><div className="flex justify-between text-xs text-slate-500"><span>Scores</span><span>{percent}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, percent)}%` }} /></div></div>
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}><StatusIcon className="h-3.5 w-3.5" />{style.label}</span>
                  </div>
                )
              }) : <div className="px-5 py-12 text-center text-slate-500">No squads have been created for this event.</div>}
            </div>
            <div className="border-t border-slate-200 p-4"><Link to="/scoring" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">Open live scoring <ChevronRight className="h-4 w-4" /></Link></div>
          </article>

          <div className="space-y-6">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3"><Target className="h-5 w-5 text-emerald-600" /><h3 className="text-lg font-semibold">Readiness checklist</h3></div>
              <div className="mt-5 space-y-3">
                {readiness.map((item) => (
                  <Link key={item.label} to={item.path} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50">
                    {item.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
                    <span><span className="block font-medium text-slate-900">{item.label}</span><span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span></span>
                  </Link>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-emerald-600" /><h3 className="text-lg font-semibold">Upcoming shoots</h3></div>
              <div className="mt-5 space-y-3">
                {snapshot?.upcomingShoots.length ? snapshot.upcomingShoots.map((shoot) => (
                  <div key={shoot.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-950">{shoot.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{shoot.discipline} · {formatDate(shoot.shoot_date)} · {formatTime(shoot.start_time)}</p>
                  </div>
                )) : <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No upcoming shoots</div>}
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Manage registrations", detail: "Check in participants and review payments", path: "/registration", icon: ClipboardList },
            { label: "Build squads", detail: "Assign posts, houses, and start times", path: "/squads", icon: Users },
            { label: "Enter scores", detail: "Open the live score-entry workspace", path: "/scoring", icon: Target },
            { label: "View leaderboard", detail: "Display live rankings and TV mode", path: "/leaderboard", icon: Trophy },
          ].map(({ label, detail, path, icon: Icon }) => (
            <Link key={label} to={path} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
              <Icon className="h-5 w-5 text-emerald-700" /><p className="mt-4 font-semibold text-slate-950">{label}</p><p className="mt-1 text-sm text-slate-500">{detail}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">Open <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
