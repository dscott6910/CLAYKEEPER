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
type AlertSeverity = "critical" | "warning" | "info"

type OperationsAlert = {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  href: string
  action: string
}

type SystemCard = {
  title: string
  value: string
  detail: string
  health: Health
  icon: LucideIcon
  href: string
  action: string
}

type QuickAction = {
  id: string
  label: string
  detail: string
  href: string
  icon: LucideIcon
  badge?: string
  emphasis?: "primary" | "attention" | "standard"
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

function awardsLabel(data: OperationsSnapshot) {
  if (data.awardsStatus === "published") return "Published"
  if (data.awardsStatus === "approved") return "Approved"
  if (data.awardsStatus === "provisional") return "Provisional"
  if (data.awardsReady) return "Ready"
  return "Pending"
}

export function DirectorDashboardPage() {
  const { eventId } = useParams()
  const [data, setData] = useState<OperationsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  const load = useCallback(
    async (background = false) => {
      if (!eventId) return
      if (background) setRefreshing(true)
      else setLoading(true)
      setError("")
      try {
        setData(await loadTournamentOperations(eventId))
        setRefreshedAt(new Date())
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The director dashboard could not be loaded.",
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [eventId],
  )

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 30000)
    return () => window.clearInterval(timer)
  }, [load])

  const systems = useMemo<SystemCard[]>(() => {
    if (!data || !eventId) return []

    return [
      {
        title: "Registration",
        value: `${data.registrationReadyPercent}%`,
        detail:
          data.unpaidRegistrations > 0
            ? `${data.unpaidRegistrations} registrations need payment review`
            : `${data.eligibleRegistrations} eligible registrations are ready`,
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
        value: `${data.checkInPercent}%`,
        detail: `${data.checkedIn} checked in · ${data.lateArrivals} late · ${data.noShows} no-shows`,
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
        title: "Digital Scoring",
        value: `${data.scoringCompletionPercent}%`,
        detail: `${data.athletesCurrentlyShooting} in progress · ${data.athletesFinished} finished`,
        health:
          data.scoringEnabledShoots === 0
            ? "disabled"
            : data.scorecardsMissing > 0 && data.scorecardsStarted > 0
              ? "warning"
              : "healthy",
        icon: Target,
        href: `/events/${eventId}/digital-scoring`,
        action: "Open Scoring",
      },
      {
        title: "Squad Progress",
        value: `${data.squadsComplete} / ${data.squads}`,
        detail: `${data.squadsInProgress} shooting · ${data.squadsNotStarted} not started`,
        health:
          data.squads === 0
            ? "disabled"
            : data.squadsInProgress > 0 || data.squadsNotStarted > 0
              ? "warning"
              : "healthy",
        icon: Activity,
        href: `/events/${eventId}/leaderboard`,
        action: "View Progress",
      },
      {
        title: "Awards",
        value: awardsLabel(data),
        detail:
          data.awardsStatus === "published"
            ? "Official results are published"
            : data.awardsReady
              ? "Scoring is complete; awards can be finalized"
              : "Awards are waiting on scoring completion",
        health:
          data.awardsStatus === "published" || data.awardsStatus === "approved"
            ? "healthy"
            : data.awardsReady || data.awardsStatus === "provisional"
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
          ? "Live scores are visible to spectators"
          : "Live scores are hidden from spectators",
        health: data.publicPortalOpen ? "healthy" : "disabled",
        icon: Globe2,
        href: `/events/${eventId}/public`,
        action: "Manage Public Portal",
      },
    ]
  }, [data, eventId])

  const alerts = useMemo<OperationsAlert[]>(() => {
    if (!data || !eventId) return []

    const next: OperationsAlert[] = []

    if (data.scorecardsMissing > 0 && data.scorecardsStarted > 0) {
      next.push({
        id: "missing-scorecards",
        severity: "critical",
        title: `${data.scorecardsMissing} scorecards have not been started`,
        detail: "Assigned athletes are missing scorecard activity while scoring is underway.",
        href: `/events/${eventId}/digital-scoring`,
        action: "Review scoring",
      })
    }

    if (data.scorecardsDraft > 0) {
      next.push({
        id: "draft-scorecards",
        severity: "warning",
        title: `${data.scorecardsDraft} scorecards remain in draft`,
        detail: "Draft scorecards must be finalized before event scoring can be considered complete.",
        href: `/events/${eventId}/digital-scoring`,
        action: "Open Digital Scoring",
      })
    }

    if (data.unassignedEnrollments > 0) {
      next.push({
        id: "unassigned-enrollments",
        severity: "critical",
        title: `${data.unassignedEnrollments} shoot enrollments are not assigned to squads`,
        detail: "These athletes cannot progress normally through squad-based tournament operations.",
        href: `/events/${eventId}/operations`,
        action: "Review assignments",
      })
    }

    if (data.unpaidRegistrations > 0) {
      next.push({
        id: "payment-review",
        severity: "warning",
        title: `${data.unpaidRegistrations} registrations need payment review`,
        detail: "Resolve payment eligibility before relying on final registration and check-in totals.",
        href: "/registration-payments",
        action: "Review payments",
      })
    }

    if (data.refundsPending > 0) {
      next.push({
        id: "refund-review",
        severity: "warning",
        title: `${data.refundsPending} refunds require review`,
        detail: "Pending refund decisions remain open for this event.",
        href: "/registration-payments",
        action: "Review refunds",
      })
    }

    if (data.noShows > 0) {
      next.push({
        id: "no-shows",
        severity: "info",
        title: `${data.noShows} athletes are marked as no-shows`,
        detail: "Confirm attendance records before finalizing tournament participation totals.",
        href: `/events/${eventId}/check-in`,
        action: "Review check-in",
      })
    }

    if (data.squadsNotStarted > 0 && data.squadsInProgress + data.squadsComplete > 0) {
      next.push({
        id: "squads-not-started",
        severity: "warning",
        title: `${data.squadsNotStarted} squads have not started`,
        detail: "Other squads have begun or completed scoring. Confirm the remaining squads are on schedule.",
        href: `/events/${eventId}/leaderboard`,
        action: "View squad progress",
      })
    }

    if (data.awardsReady && data.awardsStatus !== "published") {
      next.push({
        id: "awards-ready",
        severity: data.awardsStatus === "approved" ? "warning" : "info",
        title: data.awardsStatus === "approved" ? "Awards are approved but not published" : "Awards are ready for review",
        detail: "Scoring is complete. Finish the awards workflow when official results are ready.",
        href: `/events/${eventId}/awards`,
        action: "Open awards",
      })
    }

    if (!data.publicPortalOpen) {
      next.push({
        id: "public-portal-closed",
        severity: "info",
        title: "Public spectator portal is closed",
        detail: "Spectators cannot access this event's public results page until the portal is opened.",
        href: `/events/${eventId}/public`,
        action: "Manage portal",
      })
    } else if (!data.publicLiveScores && data.scoringEnabledShoots > 0) {
      next.push({
        id: "public-live-scores-hidden",
        severity: "info",
        title: "Public live scores are hidden",
        detail: "The public portal is open, but scoring results are not currently visible.",
        href: `/events/${eventId}/public`,
        action: "Manage portal",
      })
    }

    const priority: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
    return next.sort((a, b) => priority[a.severity] - priority[b.severity])
  }, [data, eventId])

  const alertCounts = useMemo(() => ({
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    warning: alerts.filter((alert) => alert.severity === "warning").length,
    info: alerts.filter((alert) => alert.severity === "info").length,
  }), [alerts])

  const suggestedAction = useMemo(() => {
    if (!eventId || !data) return null
    if (alerts.length > 0) {
      const alert = alerts[0]
      return {
        title: alert.title,
        detail: alert.detail,
        href: alert.href,
        action: alert.action,
        severity: alert.severity,
      }
    }
    if (data.checkedIn < data.eligibleRegistrations) {
      return {
        title: "Continue athlete check-in",
        detail: `${data.eligibleRegistrations - data.checkedIn} eligible athletes have not checked in yet.`,
        href: `/events/${eventId}/check-in`,
        action: "Open Check-In",
        severity: "info" as AlertSeverity,
      }
    }
    if (data.scorecardsFinalized < data.assignedMembers) {
      return {
        title: "Continue tournament scoring",
        detail: `${data.assignedMembers - data.scorecardsFinalized} assigned scorecards are not finalized yet.`,
        href: `/events/${eventId}/digital-scoring`,
        action: "Open Digital Scoring",
        severity: "info" as AlertSeverity,
      }
    }
    return {
      title: "Review final results",
      detail: "Tournament operations are current. Review leaderboards, awards, and publication status.",
      href: `/events/${eventId}/awards`,
      action: "Open Awards",
      severity: "info" as AlertSeverity,
    }
  }, [alerts, data, eventId])

  const quickActions = useMemo<QuickAction[]>(() => {
    if (!data || !eventId) return []
    return [
      { id: "operations", label: "Operations Center", detail: "Full event workflow and readiness", href: `/events/${eventId}/operations`, icon: MonitorUp, emphasis: "primary" },
      { id: "check-in", label: "Check-In / QR", detail: `${data.checkedIn} checked in · ${data.eligibleRegistrations - data.checkedIn} remaining`, href: `/events/${eventId}/check-in`, icon: ScanLine, badge: `${data.checkInPercent}%`, emphasis: data.checkedIn < data.eligibleRegistrations ? "attention" : "standard" },
      { id: "scoring", label: "Digital Scoring", detail: `${data.athletesCurrentlyShooting} active · ${data.scorecardsDraft} drafts`, href: `/events/${eventId}/digital-scoring`, icon: Target, badge: `${data.scoringCompletionPercent}%`, emphasis: data.scorecardsDraft > 0 || data.scorecardsMissing > 0 ? "attention" : "standard" },
      { id: "scorecards", label: "Scorecards", detail: "Print and manage event scorecards", href: `/events/${eventId}/scoring`, icon: Printer },
      { id: "leaderboard", label: "Leaderboards", detail: `${data.scorecardsFinalized} finalized scores`, href: `/events/${eventId}/leaderboard`, icon: Trophy },
      { id: "awards", label: "Awards", detail: data.awardsStatus === "published" ? "Official results published" : data.awardsReady ? "Ready for awards review" : "Waiting on scoring", href: `/events/${eventId}/awards`, icon: Award, badge: awardsLabel(data), emphasis: data.awardsReady && data.awardsStatus !== "published" ? "attention" : "standard" },
      { id: "public", label: "Public Portal", detail: data.publicPortalOpen ? (data.publicLiveScores ? "Open · live scores visible" : "Open · scores hidden") : "Closed to spectators", href: `/events/${eventId}/public`, icon: Globe2, badge: data.publicPortalOpen ? "Open" : "Closed" },
      { id: "payments", label: "Payments / Refunds", detail: `${data.unpaidRegistrations} payment reviews · ${data.refundsPending} refunds`, href: "/registration-payments", icon: BadgeDollarSign, emphasis: data.unpaidRegistrations > 0 || data.refundsPending > 0 ? "attention" : "standard" },
      { id: "reports", label: "Reports", detail: "Official reports and exports", href: "/reports", icon: Clock3 },
    ]
  }, [data, eventId])

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
                {refreshing ? "Refreshing live data…" : "Automatically refreshes every 30 seconds"}
                {refreshedAt
                  ? ` · Last refreshed ${new Intl.DateTimeFormat("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    }).format(refreshedAt)}`
                  : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to={`/events/${eventId}/operations`}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                <MonitorUp className="h-4 w-4" />
                Operations Center
              </Link>
              <Button
                variant="outline"
                onClick={() => void load(true)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Summary
            label="Registered"
            value={data.registrations}
            detail={`${data.eligibleRegistrations} eligible`}
          />
          <Summary
            label="Checked In"
            value={data.checkedIn}
            detail={`${data.checkInPercent}% of eligible`}
          />
          <Summary
            label="On Course"
            value={data.athletesCurrentlyShooting}
            detail={`${data.squadsInProgress} squads in progress`}
          />
          <Summary
            label="Finished"
            value={data.athletesFinished}
            detail={`${data.scoringCompletionPercent}% scoring complete`}
          />
          <Summary
            label="Missing Scores"
            value={data.scorecardsMissing}
            detail={`${data.scorecardsDraft} drafts open`}
          />
          <Summary
            label="Last Score"
            value={formatTime(data.lastScoreAt)}
            detail={`${data.scorecardsFinalized} finalized`}
          />
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="text-lg font-bold">Live Event Progress</h2>
              <p className="text-sm text-slate-500">
                Operational completion from registration through awards.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <ProgressRow
              label="Registration Ready"
              value={data.registrationReadyPercent}
              detail={`${data.eligibleRegistrations} of ${data.registrations} registrations eligible`}
            />
            <ProgressRow
              label="Check-In"
              value={data.checkInPercent}
              detail={`${data.checkedIn} of ${data.eligibleRegistrations} eligible athletes checked in`}
            />
            <ProgressRow
              label="Scoring"
              value={data.scoringCompletionPercent}
              detail={`${data.scorecardsFinalized} of ${data.assignedMembers} assigned athletes finalized`}
            />
            <ProgressRow
              label="Awards"
              value={data.awardsProgressPercent}
              detail={
                data.awardsStatus === "published"
                  ? "Official awards published"
                  : data.awardsReady
                    ? "Scoring complete; awards ready"
                    : "Waiting for finalized scoring"
              }
            />
          </div>
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
                    <h2 className="font-bold text-slate-950">{system.title}</h2>
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


        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="text-lg font-bold">Live Activity Feed</h2>
                <p className="text-sm text-slate-500">
                  Most recent scoring and awards activity for this event.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500">Latest 12 updates</span>
          </div>

          {data.recentActivity.length ? (
            <div className="mt-4 divide-y rounded-xl border">
              {data.recentActivity.map((item) => (
                <div key={item.id} className="flex gap-3 p-4">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    item.kind === "score_finalized"
                      ? "bg-emerald-100 text-emerald-700"
                      : item.kind === "awards"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-sky-100 text-sky-700"
                  }`}>
                    {item.kind === "awards" ? (
                      <Award className="h-4 w-4" />
                    ) : item.kind === "score_finalized" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Target className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-950">{item.title}</p>
                      <time className="text-xs font-semibold text-slate-500" dateTime={item.occurredAt}>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(item.occurredAt))}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
              Activity will appear here as digital scorecards and awards are updated.
            </div>
          )}
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

            {alerts.length ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                  {alertCounts.critical > 0 ? <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">{alertCounts.critical} critical</span> : null}
                  {alertCounts.warning > 0 ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">{alertCounts.warning} warning</span> : null}
                  {alertCounts.info > 0 ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">{alertCounts.info} advisory</span> : null}
                </div>
                <div className="mt-3 space-y-3">
                  {alerts.map((alert) => (
                    <OperationalAlert key={alert.id} alert={alert} />
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                No immediate operational warnings.
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="text-lg font-bold">Quick Actions</h2>
                <p className="text-sm text-slate-500">
                  One-click access to tournament-day tools.
                </p>
              </div>
            </div>

            {suggestedAction ? (
              <div className={`mt-4 rounded-xl border p-4 ${
                suggestedAction.severity === "critical"
                  ? "border-red-200 bg-red-50"
                  : suggestedAction.severity === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
              }`}>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Recommended Next Action</p>
                <p className="mt-1 font-bold text-slate-950">{suggestedAction.title}</p>
                <p className="mt-1 text-sm text-slate-600">{suggestedAction.detail}</p>
                <Link
                  to={suggestedAction.href}
                  className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  {suggestedAction.action}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <QuickLink key={action.id} action={action} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  )
}

function OperationalAlert(props: { alert: OperationsAlert }) {
  const styles =
    props.alert.severity === "critical"
      ? "border-red-200 bg-red-50 text-red-900"
      : props.alert.severity === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-sky-200 bg-sky-50 text-sky-900"

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{props.alert.title}</p>
            <span className="text-[11px] font-black uppercase tracking-wide opacity-70">
              {props.alert.severity === "info" ? "Advisory" : props.alert.severity}
            </span>
          </div>
          <p className="mt-1 text-sm opacity-80">{props.alert.detail}</p>
          <Link
            to={props.alert.href}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold underline-offset-4 hover:underline"
          >
            {props.alert.action}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function ProgressRow(props: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-slate-800">{props.label}</span>
        <span className="font-bold text-slate-950">{props.value}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${props.value}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{props.detail}</p>
    </div>
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
      <p className="mt-1 text-2xl font-black text-slate-950">{props.value}</p>
      <p className="mt-1 text-xs text-slate-500">{props.detail}</p>
    </div>
  )
}

function QuickLink(props: { action: QuickAction }) {
  const emphasis = props.action.emphasis ?? "standard"
  const classes =
    emphasis === "primary"
      ? "border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
      : emphasis === "attention"
        ? "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"

  return (
    <Link
      to={props.action.href}
      className={`group flex min-h-[76px] items-start gap-3 rounded-xl border p-3 transition ${classes}`}
    >
      <div className={`mt-0.5 rounded-lg p-2 ${emphasis === "primary" ? "bg-white/10" : "bg-slate-100/80"}`}>
        <props.action.icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold">{props.action.label}</span>
          {props.action.badge ? (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${emphasis === "primary" ? "bg-white/15 text-white" : "bg-white/80 text-slate-700"}`}>
              {props.action.badge}
            </span>
          ) : null}
        </div>
        <p className={`mt-1 text-xs ${emphasis === "primary" ? "text-slate-300" : "text-slate-500"}`}>
          {props.action.detail}
        </p>
      </div>
    </Link>
  )
}
