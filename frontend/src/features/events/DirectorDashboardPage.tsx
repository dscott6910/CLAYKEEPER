import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  ArrowLeft,
  Award,
  BadgeDollarSign,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Globe2,
  Loader2,
  MonitorUp,
  Printer,
  RefreshCw,
  ScanLine,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadTournamentOperations,
  type OperationsSnapshot,
} from "@/lib/services/tournamentOperations"

type Health = "healthy" | "warning" | "disabled"

type SystemCard = {
  title: string
  value: string
  detail: string
  health: Health
  icon: LucideIcon
  href: string
  action: string
}

function formatDate(value: string | null) {
  if (!value) return "Date not set"
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

function formatTime(value: string | null) {
  if (!value) return "No scores received"
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function healthLabel(health: Health) {
  if (health === "healthy") return "Healthy"
  if (health === "warning") return "Warning"
  return "Disabled"
}

function healthClasses(health: Health) {
  if (health === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }
  if (health === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }
  return "border-slate-200 bg-slate-100 text-slate-600"
}

export function DirectorDashboardPage() {
  const { eventId } = useParams()
  const [data, setData] = useState<OperationsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError("")
    try {
      setData(await loadTournamentOperations(eventId))
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The director dashboard could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(timer)
  }, [load])

  const systems = useMemo<SystemCard[]>(() => {
    if (!data || !eventId) return []

    return [
      {
        title: "Registration",
        value: String(data.eligibleRegistrations),
        detail:
          data.unpaidRegistrations > 0
            ? `${data.unpaidRegistrations} registrations need attention`
            : "Eligible registrations are ready",
        health:
          data.registrations === 0
            ? "disabled"
            : data.unpaidRegistrations > 0
              ? "warning"
              : "healthy",
        icon: ClipboardCheck,
        href: "/registration",
        action: "Open Registration",
      },
      {
        title: "Check-In",
        value: `${data.checkedIn} / ${data.eligibleRegistrations}`,
        detail: `${data.lateArrivals} late · ${data.noShows} no-shows`,
        health:
          data.eligibleRegistrations === 0
            ? "disabled"
            : data.noShows > 0 || data.refundsPending > 0
              ? "warning"
              : "healthy",
        icon: Users,
        href: `/events/${eventId}/check-in`,
        action: "Open Check-In",
      },
      {
        title: "Live Scoring",
        value: `${data.scoringCompletionPercent}%`,
        detail: `${data.scorecardsFinalized} finalized · ${data.scorecardsMissing} missing`,
        health:
          data.scoringEnabledShoots === 0
            ? "disabled"
            : data.scorecardsMissing > 0 && data.scorecardsStarted > 0
              ? "warning"
              : "healthy",
        icon: Target,
        href: `/events/${eventId}/live-scoring`,
        action: "Open Scoring",
      },
      {
        title: "Leaderboards",
        value: `${data.scorecardsFinalized}`,
        detail: `Last score: ${formatTime(data.lastScoreAt)}`,
        health:
          data.scorecardsFinalized > 0 ? "healthy" : "disabled",
        icon: Trophy,
        href: `/events/${eventId}/leaderboard`,
        action: "View Leaderboards",
      },
      {
        title: "Awards",
        value: data.awardsStatus ?? "Not Started",
        detail:
          data.awardsStatus === "published"
            ? "Official results are published"
            : "Awards remain in the official workflow",
        health:
          data.awardsStatus === "published"
            ? "healthy"
            : data.awardsStatus === "approved"
              ? "healthy"
              : data.awardsStatus === "provisional"
                ? "warning"
                : "disabled",
        icon: Award,
        href: `/events/${eventId}/awards`,
        action: "Open Awards",
      },
      {
        title: "Public Portal",
        value: data.publicPortalOpen ? "Open" : "Closed",
        detail: data.publicLiveScores
          ? "Live scores are visible"
          : "Live scores are hidden",
        health: data.publicPortalOpen ? "healthy" : "disabled",
        icon: Globe2,
        href: `/events/${eventId}/public`,
        action: "Manage Public Portal",
      },
    ]
  }, [data, eventId])

  const alerts = useMemo(() => {
    if (!data) return []
    const next: string[] = []
    if (data.unpaidRegistrations > 0) {
      next.push(`${data.unpaidRegistrations} registrations need payment review.`)
    }
    if (data.unassignedEnrollments > 0) {
      next.push(`${data.unassignedEnrollments} shoot enrollments are not assigned to squads.`)
    }
    if (data.scorecardsMissing > 0) {
      next.push(`${data.scorecardsMissing} scorecards have not been started.`)
    }
    if (data.refundsPending > 0) {
      next.push(`${data.refundsPending} refunds require review.`)
    }
    if (!data.publicPortalOpen) {
      next.push("The public spectator portal is closed.")
    }
    if (data.awardsStatus !== "published") {
      next.push("Official awards have not been published.")
    }
    return next
  }, [data])

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading director dashboard…
        </div>
      </PageContainer>
    )
  }

  if (!data || !eventId) {
    return (
      <PageContainer>
        <div className="rounded-2xl border bg-white p-8">
          Director dashboard data is unavailable.
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Event Workspace
          </Link>

          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">
                Tournament Mission Control
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                Director Dashboard
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {data.event.name} · {formatDate(data.event.start_date)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Automatically refreshes every 30 seconds
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to={`/events/${eventId}/operations`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
                  <MonitorUp className="h-4 w-4" />
                  Operations Center
                </Link>
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
                Refresh Now
              </Button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary
            label="Registered"
            value={data.registrations}
            detail={`${data.eligibleRegistrations} eligible`}
          />
          <Summary
            label="Checked In"
            value={data.checkedIn}
            detail={`${data.lateArrivals} late arrivals`}
          />
          <Summary
            label="Scoring Complete"
            value={`${data.scoringCompletionPercent}%`}
            detail={`${data.scorecardsFinalized} finalized`}
          />
          <Summary
            label="Collected"
            value={new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(data.collected)}
            detail={`${data.refundsPending} refunds pending`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {systems.map((system) => (
            <article
              key={system.title}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-100 p-2.5">
                    <system.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-950">
                      {system.title}
                    </h2>
                    <p className="mt-1 text-2xl font-black capitalize">
                      {system.value}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold ${healthClasses(system.health)}`}
                >
                  {healthLabel(system.health)}
                </span>
              </div>
              <p className="mt-4 min-h-10 text-sm text-slate-600">
                {system.detail}
              </p>
              <Link
                to={system.href}
                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-slate-50"
              >
                {system.action}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <CircleAlert className="h-5 w-5 text-amber-600" />
              <div>
                <h2 className="text-lg font-bold">Needs Attention</h2>
                <p className="text-sm text-slate-500">
                  Live operational warnings for this event.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {alerts.length ? (
                alerts.map((alert) => (
                  <div
                    key={alert}
                    className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {alert}
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                  No immediate operational warnings.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="text-lg font-bold">Quick Actions</h2>
                <p className="text-sm text-slate-500">
                  Common tournament-day tools.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <QuickLink href={`/events/${eventId}/check-in`} icon={ScanLine} label="Check In" />
              <QuickLink href={`/events/${eventId}/live-scoring`} icon={Target} label="Live Scores" />
              <QuickLink href={`/events/${eventId}/leaderboard`} icon={Trophy} label="Leaderboards" />
              <QuickLink href={`/events/${eventId}/awards`} icon={Award} label="Awards" />
              <QuickLink href={`/events/${eventId}/public`} icon={Globe2} label="Public Portal" />
              <QuickLink href={`/events/${eventId}/scoring`} icon={Printer} label="Scorecards" />
              <QuickLink href="/registration-payments" icon={BadgeDollarSign} label="Refunds" />
              <QuickLink href="/reports" icon={Clock3} label="Reports" />
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  )
}

function Summary(props: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-950">
        {props.value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{props.detail}</p>
    </div>
  )
}

function QuickLink(props: {
  href: string
  icon: LucideIcon
  label: string
}) {
  return (
    <Link
      to={props.href}
      className="flex min-h-12 items-center gap-3 rounded-xl border p-3 text-sm font-semibold hover:bg-slate-50"
    >
      <props.icon className="h-5 w-5 text-emerald-700" />
      {props.label}
    </Link>
  )
}
