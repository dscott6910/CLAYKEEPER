import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Medal,
  School,
  Target,
  Trophy,
  Upload,
  UserPlus,
  Users,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { DashboardSkeleton } from "@/features/analytics/components/DashboardSkeleton"
import { loadExecutiveAnalytics, type ExecutiveAnalytics } from "@/lib/services/analytics"
import { loadDashboardSnapshot, type DashboardSnapshot } from "@/lib/services/dashboard"
import { CYSSA_LOGO } from "@/lib/branding"

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function dateLabel(value: string | null) {
  if (!value) return "Date not set"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
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

  useEffect(() => {
    void refresh()
  }, [])

  const readiness = useMemo(() => {
    if (!operations) return []
    return [
      {
        label: "Check-in",
        value: percent(operations.checkedIn, operations.registrations),
        detail: `${operations.checkedIn} of ${operations.registrations}`,
        href: "/registration",
      },
      {
        label: "Squadding",
        value: percent(operations.assignedParticipants, operations.enrolledParticipants),
        detail: `${operations.assignedParticipants} of ${operations.enrolledParticipants}`,
        href: "/squads",
      },
    ]
  }, [operations])

  if (loading && !analytics) {
    return (
      <div className="min-h-screen">
        <AppHeader
          title="Executive Dashboard"
          description="Organization performance, financial health, and tournament readiness"
          seasonLabel="CYSSA-Active Season"
        />
        <DashboardSkeleton />
      </div>
    )
  }

  const metrics = [
    {
      label: "Active Participants",
      value: analytics?.activeParticipants ?? 0,
      detail: "Organization-wide roster",
      icon: Users,
      href: "/participants",
    },
    {
      label: "Active Teams",
      value: analytics?.activeTeams ?? 0,
      detail: "Current competitive teams",
      icon: School,
      href: "/teams",
    },
    {
      label: "Events Scheduled",
      value: analytics?.scheduledEvents ?? 0,
      detail: `${analytics?.liveEvents ?? 0} currently active`,
      icon: CalendarDays,
      href: "/events",
    },
    {
      label: "Revenue Collected",
      value: currency(analytics?.revenueCollected ?? 0),
      detail: "Total collected this season",
      icon: CreditCard,
      href: "/treasurer",
    },
    {
      label: "Outstanding",
      value: currency(analytics?.outstandingBalance ?? 0),
      detail: "Outstanding balances",
      icon: ClipboardList,
      href: "/registration-payments",
    },
    {
      label: "Event Registrations",
      value: analytics?.totalRegistrations ?? 0,
      detail: "Total registrations",
      icon: ClipboardList,
      href: "/reports",
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader
        title="Executive Dashboard"
        description="Organization performance, financial health, and tournament readiness"
        seasonLabel="CYSSA-Active Season"
      />

      <main className="space-y-5 p-4 md:p-6">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-sm">
          <div className="grid min-h-[276px] grid-cols-1 items-center gap-6 p-6 lg:grid-cols-[240px_1fr_260px] lg:p-7">
            <div className="flex items-center justify-center lg:justify-start">
              <img
                src={CYSSA_LOGO}
                alt="CYSSA"
                className="h-auto max-h-32 w-full max-w-[235px] object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)]"
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
                CYSSA-Active Season
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                {analytics?.activeSeason?.name ?? "No active season"}
              </h2>
              <p className="mt-2 text-sm text-slate-200">
                {analytics?.activeSeason
                  ? `${dateLabel(analytics.activeSeason.startDate)} – ${dateLabel(analytics.activeSeason.endDate)}`
                  : "Create or activate a season to organize events and analytics."}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {readiness.map((item) => (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-100">{item.label}</span>
                      <span className="font-bold">{item.value}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${Math.min(100, item.value)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{item.detail}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div aria-hidden="true" className="hidden min-h-44 lg:block" />
          </div>
        </section>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map(({ label, value, detail, icon: Icon, href }) => (
            <Link
              key={label}
              to={href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
                  <p className="mt-1 text-sm text-slate-500">{detail}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-950">Recent Activity</h3>
              </div>
              <Link to="/reports" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                View All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Upload className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">Latest import activity</p>
                  <p className="text-xs text-slate-500">{analytics?.totalRegistrations ?? 0} registrations currently available</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><UserPlus className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">Participant roster updated</p>
                  <p className="text-xs text-slate-500">{analytics?.activeParticipants ?? 0} active participants</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="rounded-lg bg-violet-50 p-2 text-violet-700"><Trophy className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">Awards center ready</p>
                  <p className="text-xs text-slate-500">Review current event results and standings</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <Target className="h-5 w-5 text-slate-950" />
              <h3 className="font-semibold text-slate-950">Quick Actions</h3>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {[
                { label: "Add Event", href: "/events", icon: CalendarDays },
                { label: "Import Shooters", href: "/operations", icon: Upload },
                { label: "Create Shoot", href: "/events", icon: Target },
                { label: "View Reports", href: "/reports", icon: BarChart3 },
                { label: "Digital Scoring", href: "/scoring", icon: Trophy },
                { label: "Awards & Results", href: "/awards", icon: Medal },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  to={href}
                  className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
