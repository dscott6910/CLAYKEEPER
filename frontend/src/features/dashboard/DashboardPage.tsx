import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  RadioTower,
  RefreshCw,
  School,
  Target,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { Button } from "@/components/ui/button"
import { DashboardSection } from "@/features/analytics/components/DashboardSection"
import { DashboardSkeleton } from "@/features/analytics/components/DashboardSkeleton"
import { MetricCard } from "@/features/analytics/components/MetricCard"
import { TrendChart } from "@/features/analytics/components/TrendChart"
import { loadExecutiveAnalytics, type ExecutiveAnalytics } from "@/lib/services/analytics"
import { loadDashboardSnapshot, type DashboardSnapshot } from "@/lib/services/dashboard"

function currency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function dateLabel(value: string | null) {
  if (!value) return "Date not set"
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

export function DashboardPage() {
  const [analytics, setAnalytics] = useState<ExecutiveAnalytics | null>(null)
  const [operations, setOperations] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      const [nextAnalytics, nextOperations] = await Promise.all([
        loadExecutiveAnalytics(),
        loadDashboardSnapshot(),
      ])
      setAnalytics(nextAnalytics)
      setOperations(nextOperations)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the executive dashboard.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const readiness = useMemo(() => {
    if (!operations) return []
    return [
      { label: "Check-in", value: percent(operations.checkedIn, operations.registrations), detail: `${operations.checkedIn} of ${operations.registrations}`, href: "/registration" },
      { label: "Squadding", value: percent(operations.assignedParticipants, operations.enrolledParticipants), detail: `${operations.assignedParticipants} of ${operations.enrolledParticipants}`, href: "/squads" },
      { label: "Scoring", value: percent(operations.scoreEntries, operations.expectedScoreEntries), detail: `${operations.scoreEntries} of ${operations.expectedScoreEntries}`, href: "/scoring" },
    ]
  }, [operations])

  if (loading && !analytics) {
    return <div className="min-h-screen"><AppHeader title="Executive Dashboard" description="Organization performance, financial health, and tournament readiness" /><DashboardSkeleton /></div>
  }

  const metrics = [
    { label: "Active Participants", value: analytics?.activeParticipants ?? 0, detail: "Organization-wide roster", icon: Users, href: "/participants" },
    { label: "Active Teams", value: analytics?.activeTeams ?? 0, detail: "Current competitive teams", icon: School, href: "/teams" },
    { label: "Events Scheduled", value: analytics?.scheduledEvents ?? 0, detail: `${analytics?.liveEvents ?? 0} currently active`, icon: CalendarDays, href: "/events" },
    { label: "New Registrations", value: analytics?.registrationsThisWeek ?? 0, detail: "During the last 7 days", icon: UserPlus, href: "/registration" },
    { label: "Revenue Collected", value: currency(analytics?.revenueCollected ?? 0), detail: `${analytics?.collectionRate ?? 0}% collection rate`, icon: CreditCard, href: "/treasurer" },
    { label: "Outstanding", value: currency(analytics?.outstandingBalance ?? 0), detail: "Remaining registration balance", icon: ClipboardList, href: "/registration-payments" },
    { label: "Event Registrations", value: analytics?.totalRegistrations ?? 0, detail: "Across the last six months", icon: Target, href: "/reports" },
    { label: "Live Events", value: analytics?.liveEvents ?? 0, detail: "Open or in progress", icon: RadioTower, href: "/event-operations" },
  ]

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader title="Executive Dashboard" description="Organization performance, financial health, and tournament readiness" />
      <main className="space-y-6 p-4 md:p-6">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-sm">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Active season</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{analytics?.activeSeason?.name ?? "No active season"}</h2>
                <p className="mt-3 text-sm text-slate-300">
                  {analytics?.activeSeason ? `${dateLabel(analytics.activeSeason.startDate)} – ${dateLabel(analytics.activeSeason.endDate)}` : "Create or activate a season to organize events and analytics."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
                <Link to="/events" className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700">Open events <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {readiness.map((item) => (
                <Link key={item.label} to={item.href} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:bg-white/10">
                  <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-200">{item.label}</span><span className="font-bold">{item.value}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, item.value)}%` }} /></div>
                  <p className="mt-2 text-xs text-slate-400">{item.detail}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {error ? <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertCircle className="h-5 w-5" />{error}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <DashboardSection title="Registration trend" description="New registrations during the last six months" action={<Link to="/reports" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">View reports</Link>}>
            <TrendChart data={analytics?.recentTrend ?? []} />
          </DashboardSection>

          <DashboardSection title="Upcoming events" description="Next scheduled organization events" action={<Link to="/events" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">All events</Link>}>
            <div className="space-y-3">
              {(analytics?.upcomingEvents ?? []).length ? analytics?.upcomingEvents.map((event) => (
                <Link key={event.id} to={`/events/${event.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/40">
                  <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{event.name}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(event.startDate)} · {event.registrations} registrations</p></div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              )) : <p className="py-10 text-center text-sm text-slate-500">No upcoming events are scheduled.</p>}
            </div>
          </DashboardSection>
        </section>

        <DashboardSection title="Tournament readiness" description={operations?.selectedEvent ? `Operational status for ${operations.selectedEvent.name}` : "Select or create an event to begin operations"}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Registered", value: operations?.registrations ?? 0, detail: `${operations?.checkedIn ?? 0} checked in`, icon: ClipboardList, href: "/registration" },
              { label: "Assigned", value: operations?.assignedParticipants ?? 0, detail: `${operations?.unassignedParticipants ?? 0} unassigned`, icon: CheckCircle2, href: "/squads" },
              { label: "Squads", value: operations?.squads ?? 0, detail: `${operations?.squadOperations.filter((row) => row.status === "in_progress").length ?? 0} active`, icon: Target, href: "/squads" },
              { label: "Complete", value: operations?.completedParticipants ?? 0, detail: `${operations?.scoreEntries ?? 0} scores entered`, icon: Trophy, href: "/scoring" },
            ].map(({ label, value, detail, icon: Icon, href }) => (
              <Link key={label} to={href} className="rounded-xl border border-slate-100 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/40">
                <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><Icon className="h-4 w-4 text-emerald-700" /></div>
                <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p>
              </Link>
            ))}
          </div>
        </DashboardSection>
      </main>
    </div>
  )
}
