import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Award,
  BadgeDollarSign,
  CalendarCheck,
  Check,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Flag,
  Globe2,
  Import,
  Loader2,
  Printer,
  RefreshCw,
  Route,
  ScanLine,
  Target,
  Trophy,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadTournamentOperations,
  type OperationsSnapshot,
  type OperationsStatus,
} from "@/lib/services/tournamentOperations"

type WorkflowCard = {
  key: string
  title: string
  description: string
  detail: string
  status: OperationsStatus
  href: string
  action: string
  icon: LucideIcon
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "Date not set"
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

function statusLabel(status: OperationsStatus) {
  if (status === "complete") return "Complete"
  if (status === "ready") return "Ready"
  if (status === "needs_attention") return "Needs Attention"
  return "Not Started"
}

function statusClasses(status: OperationsStatus) {
  if (status === "complete") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }
  if (status === "ready") {
    return "border-blue-200 bg-blue-50 text-blue-800"
  }
  if (status === "needs_attention") {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }
  return "border-slate-200 bg-slate-50 text-slate-600"
}

export function TournamentOperationsCenterPage() {
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
          : "Unable to load tournament operations.",
      )
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const cards = useMemo<WorkflowCard[]>(() => {
    if (!data || !eventId) return []

    const eventReady = Boolean(
      data.event.name &&
        data.event.start_date &&
        data.event.discipline &&
        data.event.location_name,
    )
    const registrationStatus: OperationsStatus =
      data.registrations === 0
        ? "not_started"
        : data.unpaidRegistrations > 0
          ? "needs_attention"
          : "ready"
    const courseStatus: OperationsStatus =
      data.courses === 0
        ? "not_started"
        : data.enabledStations === 0
          ? "needs_attention"
          : "ready"
    const squadStatus: OperationsStatus =
      data.enrollments === 0
        ? "not_started"
        : data.unassignedEnrollments > 0
          ? "needs_attention"
          : "ready"
    const checkInStatus: OperationsStatus =
      data.eligibleRegistrations === 0
        ? "not_started"
        : data.checkedIn === data.eligibleRegistrations
          ? "complete"
          : data.checkedIn > 0
            ? "needs_attention"
            : "not_started"

    return [
      {
        key: "event",
        title: "Event Setup",
        description: "Date, discipline, location, host, and status.",
        detail: eventReady
          ? "Required event details are present."
          : "Complete the required event information.",
        status: eventReady ? "complete" : "needs_attention",
        href: "/events",
        action: "Review Event",
        icon: CalendarCheck,
      },
      {
        key: "import",
        title: "ActiveNet Import",
        description: "Bring registered athletes into the event.",
        detail:
          data.registrations > 0
            ? `${data.registrations} event registration${data.registrations === 1 ? "" : "s"} available.`
            : "No event registrations are available yet.",
        status: data.registrations > 0 ? "ready" : "not_started",
        href: "/participants/activenet",
        action: "Open Import",
        icon: Import,
      },
      {
        key: "registration",
        title: "Registration Review",
        description: "Confirm eligible athletes and payment status.",
        detail: `${data.eligibleRegistrations} eligible · ${data.unpaidRegistrations} need attention`,
        status: registrationStatus,
        href: "/registration",
        action: "Review Registration",
        icon: ClipboardCheck,
      },
      {
        key: "courses",
        title: "Course Configuration",
        description: "Configure stations and birds for each course.",
        detail: `${data.courses} course${data.courses === 1 ? "" : "s"} · ${data.enabledStations} active station rows`,
        status: courseStatus,
        href: `/events/${eventId}/course`,
        action: "Build Courses",
        icon: Route,
      },
      {
        key: "shoots",
        title: "Shoot Setup",
        description: "Configure competitions, dates, fees, and scoring.",
        detail: `${data.shoots} shoot${data.shoots === 1 ? "" : "s"} configured`,
        status: data.shoots > 0 ? "ready" : "not_started",
        href: `/events/${eventId}/shoots`,
        action: "Manage Shoots",
        icon: Target,
      },
      {
        key: "squads",
        title: "Squads and Posts",
        description: "Assign athletes to squads and post positions.",
        detail: `${data.assignedMembers} assigned · ${data.unassignedEnrollments} unassigned`,
        status: squadStatus,
        href: "/squads",
        action: "Open Squads",
        icon: Users,
      },
      {
        key: "scorecards",
        title: "Scorecard Printing",
        description: "Generate QR-coded cards from the saved course.",
        detail:
          data.courses > 0 && data.assignedMembers > 0
            ? `${data.assignedMembers} assigned athlete card${data.assignedMembers === 1 ? "" : "s"} can be prepared.`
            : "Courses and squad assignments are required.",
        status:
          data.courses > 0 && data.assignedMembers > 0
            ? "ready"
            : "not_started",
        href: `/events/${eventId}/scoring`,
        action: "Open Scorecards",
        icon: Printer,
      },
      {
        key: "checkin",
        title: "Check-In",
        description: "Track arriving athletes and last-minute no-shows.",
        detail: `${data.checkedIn} / ${data.eligibleRegistrations} checked in`,
        status: checkInStatus,
        href: `/events/${eventId}/check-in`,
        action: "Open Check-In",
        icon: Check,
      },
      {
        key: "scoring",
        title: "Live Scoring",
        description: "Enable score entry and monitor progress.",
        detail: `${data.scorecardsFinalized} finalized · ${data.scorecardsStarted - data.scorecardsFinalized} drafts · ${data.scorecardsMissing} missing`,
        status:
          data.scorecardsFinalized > 0
            ? "ready"
            : data.scorecardsStarted > 0
              ? "needs_attention"
              : "not_started",
        href: `/events/${eventId}/live-scoring`,
        action: "Open Digital Scoring",
        icon: Flag,
      },
      {
        key: "leaderboard",
        title: "Live Leaderboard",
        description: "Monitor standings, squad progress, ties, and missing scorecards.",
        detail: `${data.scoringCompletionPercent}% complete · ${data.scorecardsMissing} missing`,
        status:
          data.scorecardsFinalized > 0
            ? data.scorecardsMissing > 0
              ? "needs_attention"
              : "ready"
            : "not_started",
        href: `/events/${eventId}/leaderboard`,
        action: "Open Leaderboard",
        icon: Trophy,
      },
      {
        key: "public",
        title: "Public Spectator Portal",
        description: "Share live standings, squads, and published awards with families and spectators.",
        detail: data.publicPortalOpen
          ? data.publicLiveScores
            ? "Public page is open with live scores."
            : "Public page is open; live scores are hidden."
          : "Public page is currently closed.",
        status: data.publicPortalOpen ? "ready" : "not_started",
        href: `/events/${eventId}/public`,
        action: "Manage Public Page",
        icon: Globe2,
      },
      {
        key: "scanning",
        title: "Scorecard Scanning",
        description: "Scan and review completed paper scorecards.",
        detail: "The current scanner remains in testing mode.",
        status: "not_started",
        href: "/scorecard-scan-lab",
        action: "Open Scan Lab",
        icon: ScanLine,
      },
      {
        key: "awards",
        title: "Awards",
        description: "Review individual, team, class, and HOA results.",
        detail:
          data.awardsStatus === "published"
            ? "Official awards have been published."
            : data.awardsStatus === "approved"
              ? "Awards are approved and ready to publish."
              : data.awardsStatus === "provisional"
                ? "Provisional awards have been saved."
                : "Awards become available as finalized scores arrive.",
        status:
          data.awardsStatus === "published"
            ? "complete"
            : data.awardsStatus === "approved"
              ? "ready"
              : data.awardsStatus === "provisional" || data.scorecardsFinalized > 0
                ? "needs_attention"
                : "not_started",
        href: `/events/${eventId}/awards`,
        action: "Open Awards",
        icon: Award,
      },
      {
        key: "invoices",
        title: "Team Invoices",
        description: "Prepare team-level payment summaries.",
        detail: `${formatMoney(data.collected)} currently collected`,
        status: data.registrations > 0 ? "ready" : "not_started",
        href: "/treasurer",
        action: "Open Finance",
        icon: WalletCards,
      },
      {
        key: "refunds",
        title: "No-Shows and Refunds",
        description: "Track paid no-shows and refund decisions.",
        detail: `${data.noShows} no-show${data.noShows === 1 ? "" : "s"} · ${data.refundsPending} refund${data.refundsPending === 1 ? "" : "s"} pending`,
        status: data.refundsPending > 0 ? "needs_attention" : data.noShows > 0 ? "ready" : "not_started",
        href: `/events/${eventId}/check-in`,
        action: "Open Payments",
        icon: BadgeDollarSign,
      },
      {
        key: "reports",
        title: "Final Reports",
        description: "Publish results and archive the event.",
        detail:
          data.event.status === "completed" || data.event.status === "archived"
            ? "The event is marked complete."
            : "Complete scoring and awards before archiving.",
        status:
          data.event.status === "archived"
            ? "complete"
            : data.event.status === "completed"
              ? "ready"
              : "not_started",
        href: "/reports",
        action: "Open Reports",
        icon: FileText,
      },
    ]
  }, [data, eventId])

  const progress = useMemo(() => {
    const counted = cards.filter((card) =>
      ["ready", "complete"].includes(card.status),
    ).length
    return cards.length ? Math.round((counted / cards.length) * 100) : 0
  }, [cards])

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading Tournament Operations…
        </div>
      </PageContainer>
    )
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="rounded-2xl border bg-white p-8">
          Tournament operations are unavailable.
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
                Tournament Operations Center
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                {data.event.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {formatDate(data.event.start_date)}
                {data.event.location_name ? ` · ${data.event.location_name}` : ""}
              </p>
            </div>

            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh Status
            </Button>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">
                Event readiness
              </span>
              <span className="font-bold text-slate-950">{progress}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
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
            label="Eligible Athletes"
            value={data.eligibleRegistrations}
            detail={`${data.unpaidRegistrations} need attention`}
          />
          <Summary
            label="Courses"
            value={data.courses}
            detail={`${data.enabledStations} enabled station rows`}
          />
          <Summary
            label="Squad Assignments"
            value={data.assignedMembers}
            detail={`${data.unassignedEnrollments} unassigned`}
          />
          <Summary
            label="Collected"
            value={formatMoney(data.collected)}
            detail={`${data.checkedIn} checked in · ${data.noShows} no-shows`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {cards.map((card, index) => (
            <article
              key={card.key}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-100 p-2.5">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Step {index + 1}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">
                      {card.title}
                    </h2>
                  </div>
                </div>

                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(card.status)}`}
                >
                  {statusLabel(card.status)}
                </span>
              </div>

              <p className="mt-4 text-sm text-slate-600">{card.description}</p>

              <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                {card.status === "needs_attention" ? (
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                )}
                <span>{card.detail}</span>
              </div>

              <Link
                to={card.href}
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {card.action}
              </Link>
            </article>
          ))}
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