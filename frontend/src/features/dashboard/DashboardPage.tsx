import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardList, RefreshCw, Target, Trophy, Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { Button } from "@/components/ui/button"
import { loadDashboardSnapshot, type DashboardSnapshot } from "@/lib/services/dashboard"

export function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      setSnapshot(await loadDashboardSnapshot())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the dashboard.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const scorePercent = snapshot?.expectedScoreEntries
    ? Math.round((snapshot.scoreEntries / snapshot.expectedScoreEntries) * 100)
    : 0

  const readiness = useMemo(() => {
    if (!snapshot) return []
    return [
      { label: "Participants added", done: snapshot.activeParticipants > 0, path: "/participants" },
      { label: "Event registrations created", done: snapshot.registrations > 0, path: "/registration" },
      { label: "Participants assigned to squads", done: snapshot.assignedParticipants > 0, path: "/squads" },
      { label: "Scores entered", done: snapshot.scoreEntries > 0, path: "/scoring" },
    ]
  }, [snapshot])

  const statistics = [
    { label: "Active Participants", value: snapshot?.activeParticipants ?? 0, icon: Users },
    { label: "Registrations", value: snapshot?.registrations ?? 0, icon: ClipboardList },
    { label: "Checked In", value: snapshot?.checkedIn ?? 0, icon: CheckCircle2 },
    { label: "Scores Entered", value: `${snapshot?.scoreEntries ?? 0} / ${snapshot?.expectedScoreEntries ?? 0}`, icon: Trophy },
  ]

  return (
    <div className="min-h-screen">
      <AppHeader title="Command Center" description="Live operational status across ClayKeeper" />
      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-400">Tournament Director Dashboard</p>
              <h3 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Everything important, in one place.</h3>
              <p className="mt-3 max-w-2xl text-slate-300">Track registration, squadding, check-in, and score-entry progress without moving between spreadsheets.</p>
            </div>
            <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm text-slate-300"><span>Scoring progress</span><span>{scorePercent}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, scorePercent)}%` }} /></div>
          </div>
        </section>

        {error ? <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertCircle className="h-5 w-5" />{error}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statistics.map(({ label, value, icon: Icon }) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></div></div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-emerald-600" /><h3 className="text-lg font-semibold">Upcoming shoots</h3></div>
            <div className="mt-5 space-y-3">
              {snapshot?.upcomingShoots.length ? snapshot.upcomingShoots.map((shoot) => (
                <div key={shoot.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-semibold">{shoot.name}</p><p className="text-sm text-slate-500">{shoot.discipline} · {shoot.shoot_date || "Date not set"}</p></div>
                  <Link to="/scoring" className="text-sm font-semibold text-emerald-700 hover:underline">Open scoring</Link>
                </div>
              )) : <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500">No upcoming shoots</div>}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><Target className="h-5 w-5 text-emerald-600" /><h3 className="text-lg font-semibold">Event readiness</h3></div>
            <div className="mt-5 space-y-3">
              {readiness.map((item) => (
                <Link key={item.label} to={item.path} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-slate-50">
                  {item.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-500" />}
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}
