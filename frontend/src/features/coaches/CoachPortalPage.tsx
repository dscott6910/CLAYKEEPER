import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Printer,
  RefreshCw,
  Target,
  Trophy,
  Users,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { loadCoachPortalData } from "@/lib/services/coachPortal"

type PortalData = Awaited<ReturnType<typeof loadCoachPortalData>>
type Tab = "overview" | "roster" | "events" | "scores" | "history"

function athleteName(athlete: PortalData["athletes"][number]) {
  return `${athlete.preferred_name?.trim() || athlete.first_name} ${athlete.last_name}`.trim()
}

function formatDate(value: string | null) {
  if (!value) return "Date TBD"

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

export function CoachPortalPage() {
  const [data, setData] = useState<PortalData | null>(null)
  const [teamId, setTeamId] = useState("")
  const [eventId, setEventId] = useState("")
  const [tab, setTab] = useState<Tab>("overview")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function refresh() {
    setLoading(true)
    setError("")

    try {
      const next = await loadCoachPortalData()

      setData(next)

      setTeamId((current) =>
        current && next.teams.some((team) => team.id === current)
          ? current
          : next.teams[0]?.id || "",
      )

      setEventId((current) =>
        current && next.events.some((event) => event.id === current)
          ? current
          : next.events[0]?.id || "",
      )
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load the coach portal.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const teamAthleteIds = useMemo(
    () =>
      new Set(
        (data?.athleteTeams ?? [])
          .filter(
            (row) =>
              row.team_id === teamId &&
              (!row.end_date ||
                row.end_date >= new Date().toISOString().slice(0, 10)),
          )
          .map((row) => row.athlete_id),
      ),
    [data, teamId],
  )

  const roster = useMemo(
    () =>
      (data?.athletes ?? []).filter((athlete) =>
        teamAthleteIds.has(athlete.id),
      ),
    [data, teamAthleteIds],
  )

  const selectedEvent = data?.events.find((event) => event.id === eventId)

  const registrations = useMemo(
    () =>
      (data?.registrations ?? []).filter(
        (row) => row.event_id === eventId && row.team_id === teamId,
      ),
    [data, eventId, teamId],
  )

  const registrationIds = useMemo(
    () => new Set(registrations.map((row) => row.id)),
    [registrations],
  )

  const eventShoots = useMemo(
    () =>
      (data?.shoots ?? []).filter((shoot) => shoot.event_id === eventId),
    [data, eventId],
  )

  const shootIds = useMemo(
    () => new Set(eventShoots.map((shoot) => shoot.id)),
    [eventShoots],
  )

  const enrollments = useMemo(
    () =>
      (data?.enrollments ?? []).filter(
        (row) =>
          registrationIds.has(row.registration_id) &&
          shootIds.has(row.shoot_id),
      ),
    [data, registrationIds, shootIds],
  )

  const enrollmentIds = useMemo(
    () => new Set(enrollments.map((row) => row.id)),
    [enrollments],
  )

  const members = useMemo(
    () =>
      (data?.members ?? []).filter((row) =>
        enrollmentIds.has(row.registration_shoot_id),
      ),
    [data, enrollmentIds],
  )

  const memberIds = useMemo(
    () => new Set(members.map((row) => row.id)),
    [members],
  )

  const scores = useMemo(
    () =>
      (data?.scores ?? []).filter((row) =>
        memberIds.has(row.squad_member_id),
      ),
    [data, memberIds],
  )

  const rows = useMemo(
    () =>
      registrations.map((registration) => {
        const athlete = data?.athletes.find(
          (item) => item.id === registration.athlete_id,
        )

        const athleteEnrollments = enrollments.filter(
          (item) => item.registration_id === registration.id,
        )

        const athleteMembers = members.filter((member) =>
          athleteEnrollments.some(
            (entry) => entry.id === member.registration_shoot_id,
          ),
        )

        const athleteScores = scores.filter((score) =>
          athleteMembers.some(
            (member) => member.id === score.squad_member_id,
          ),
        )

        const total =
          athleteScores.reduce(
            (sum, score) => sum + (score.score ?? 0),
            0,
          ) +
          athleteEnrollments.reduce(
            (sum, entry) => sum + (entry.historical_total_score ?? 0),
            0,
          )

        const squadMember = athleteMembers[0]

        const squad = data?.squads.find(
          (item) => item.id === squadMember?.squad_id,
        )

        const classRecord = data?.classes.find(
          (item) => item.id === registration.class_id,
        )

        return {
          registration,
          athlete,
          athleteEnrollments,
          athleteScores,
          total,
          squadMember,
          squad,
          classRecord,
        }
      }),
    [registrations, data, enrollments, members, scores],
  )

  const checkedIn = registrations.filter((row) => row.checked_in).length

  const assigned = enrollments.filter(
    (row) => row.squad_assignment_status === "assigned",
  ).length

  const complete = rows.filter(
    (row) =>
      row.athleteEnrollments.length > 0 &&
      row.athleteEnrollments.every((entry) => {
        if (entry.historical_total_score !== null) {
          return true
        }

        const shoot = data?.shoots.find(
          (item) => item.id === entry.shoot_id,
        )

        const member = members.find(
          (item) => item.registration_shoot_id === entry.id,
        )

        return (
          !!shoot &&
          !!member &&
          scores.filter(
            (score) =>
              score.squad_member_id === member.id &&
              score.score !== null,
          ).length >= shoot.number_of_rounds
        )
      }),
  ).length

  const pendingCheckIn = Math.max(0, registrations.length - checkedIn)
  const pendingAssignments = Math.max(0, enrollments.length - assigned)

  const pendingPayments = registrations.filter(
    (row) =>
      !["paid", "waived", "refunded"].includes(
        row.payment_status?.toLowerCase() ?? "",
      ),
  ).length

  const scoringProgress =
    registrations.length > 0
      ? Math.round((complete / registrations.length) * 100)
      : 0

  const checkInProgress =
    registrations.length > 0
      ? Math.round((checkedIn / registrations.length) * 100)
      : 0

  const assignmentProgress =
    enrollments.length > 0
      ? Math.round((assigned / enrollments.length) * 100)
      : 0

  const attentionItems = [
    {
      label: "Participants awaiting check-in",
      count: pendingCheckIn,
      href: "/registration",
    },
    {
      label: "Shoot enrollments without squad assignments",
      count: pendingAssignments,
      href: "/squads",
    },
    {
      label: "Registrations requiring payment attention",
      count: pendingPayments,
      href: "/registration-payments",
    },
  ].filter((item) => item.count > 0)

  const nextShoot = [...eventShoots]
    .filter((shoot) => shoot.shoot_date)
    .sort((a, b) =>
      (a.shoot_date ?? "9999-12-31").localeCompare(
        b.shoot_date ?? "9999-12-31",
      ),
    )[0]

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Coach Portal"
        description="Team roster, event readiness, squadding, scores, and athlete history in one workspace."
      />

      <PageContainer>
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm font-medium">
                Team
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  {data?.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Event
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                >
                  {data?.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={() => void refresh()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          ) : null}

          {!loading && data && data.teams.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
              No team is assigned to this coach account. An owner or
              administrator can link the coach to a team in the database.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 print:hidden">
            {(
              [
                ["overview", "Overview"],
                ["roster", "Roster"],
                ["events", "Event Readiness"],
                ["scores", "Scores"],
                ["history", "Athlete History"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                variant={tab === key ? "default" : "outline"}
                onClick={() => setTab(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500">
              Loading coach workspace…
            </div>
          ) : null}

          {!loading && data ? (
            <>
              {tab === "overview" ? (
                <div className="space-y-6">
                  <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm">
                    <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
                          Coach Command Center
                        </p>

                        <h2 className="mt-2 text-3xl font-bold tracking-tight">
                          {selectedEvent?.name || "Select an event"}
                        </h2>

                        <p className="mt-2 text-sm text-slate-300">
                          {formatDate(selectedEvent?.start_date ?? null)}
                        </p>

                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                          <ProgressCard
                            label="Check-in"
                            value={checkInProgress}
                            detail={`${checkedIn} of ${registrations.length}`}
                          />

                          <ProgressCard
                            label="Squadding"
                            value={assignmentProgress}
                            detail={`${assigned} of ${enrollments.length}`}
                          />

                          <ProgressCard
                            label="Scoring"
                            value={scoringProgress}
                            detail={`${complete} participants complete`}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          Next Shoot
                        </p>

                        {nextShoot ? (
                          <>
                            <p className="mt-3 text-xl font-bold">
                              {nextShoot.name}
                            </p>

                            <p className="mt-1 text-sm capitalize text-slate-300">
                              {nextShoot.discipline.replaceAll("_", " ")}
                            </p>

                            <p className="mt-4 text-sm text-slate-200">
                              {formatDate(nextShoot.shoot_date)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-slate-300">
                            No upcoming shoot is scheduled for this event.
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <Metric icon={Users} label="Team roster" value={roster.length} />
                    <Metric icon={ClipboardList} label="Registered" value={registrations.length} />
                    <Metric icon={CheckCircle2} label="Checked in" value={checkedIn} />
                    <Metric icon={Target} label="Squad assigned" value={assigned} />
                    <Metric icon={Trophy} label="Scores complete" value={complete} />
                  </section>

                  <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-amber-600" />
                        <h2 className="text-lg font-bold">Needs Attention</h2>
                      </div>

                      {attentionItems.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <p className="font-semibold text-emerald-800">
                            Event preparations are caught up.
                          </p>

                          <p className="mt-1 text-sm text-emerald-700">
                            There are no outstanding check-in, squadding, or payment items.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {attentionItems.map((item) => (
                            <Link
                              key={item.label}
                              to={item.href}
                              className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100"
                            >
                              <span className="text-sm font-semibold text-amber-900">
                                {item.label}
                              </span>

                              <span className="rounded-full bg-amber-600 px-3 py-1 text-sm font-bold text-white">
                                {item.count}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                      <h2 className="text-lg font-bold">Quick Actions</h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Jump directly to the most common event-day tasks.
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <QuickAction href="/registration" label="Check In" />
                        <QuickAction href="/squads" label="Assign Squads" />
                        <QuickAction href="/scoring" label="Live Scoring" />
                        <QuickAction href="/registration-payments" label="Payments" />
                        <QuickAction href="/reports" label="Reports" />
                        <QuickAction href="/awards" label="Awards" />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border bg-white shadow-sm">
                    <div className="border-b p-5">
                      <h2 className="text-lg font-bold">
                        Team status for {selectedEvent?.name || "selected event"}
                      </h2>

                      <p className="text-sm text-slate-500">
                        {formatDate(selectedEvent?.start_date ?? null)}
                      </p>
                    </div>

                    <TeamTable rows={rows} />
                  </section>

                  <section className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Bell className="h-5 w-5 text-amber-600" />
                      <h2 className="text-lg font-bold">Coach Notifications</h2>
                    </div>

                    {data.announcements.filter(
                      (item) => !item.event_id || item.event_id === eventId,
                    ).length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No current announcements.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.announcements
                          .filter(
                            (item) => !item.event_id || item.event_id === eventId,
                          )
                          .map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl border bg-slate-50 p-4"
                            >
                              <p className="font-semibold">{item.title}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {item.message}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </section>
                </div>
              ) : null}

              {tab === "roster" ? (
                <section className="rounded-2xl border bg-white shadow-sm">
                  <div className="border-b p-5">
                    <h2 className="text-lg font-bold">Current team roster</h2>
                    <p className="text-sm text-slate-500">
                      Contact details and participant classifications.
                    </p>
                  </div>

                  <div className="divide-y">
                    {roster.map((athlete) => {
                      const classRecord = data.classes.find(
                        (item) => item.id === athlete.class_id,
                      )

                      return (
                        <div
                          key={athlete.id}
                          className="grid gap-2 p-5 sm:grid-cols-[1fr_auto_auto]"
                        >
                          <div>
                            <p className="font-semibold">{athleteName(athlete)}</p>
                            <p className="text-xs text-slate-500">
                              CYSSA #{athlete.cyssa_number || "—"}
                            </p>
                          </div>

                          <p className="text-sm">
                            {classRecord?.code || "No class"}
                          </p>

                          <p className="text-sm text-slate-500">
                            {athlete.email ||
                              athlete.phone ||
                              "No contact on file"}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}

              {tab === "events" ? (
                <section className="rounded-2xl border bg-white shadow-sm">
                  <div className="border-b p-5">
                    <h2 className="text-lg font-bold">Event readiness</h2>
                  </div>

                  <TeamTable rows={rows} />
                </section>
              ) : null}

              {tab === "scores" ? (
                <section className="rounded-2xl border bg-white shadow-sm">
                  <div className="border-b p-5">
                    <h2 className="text-lg font-bold">Live team scores</h2>
                    <p className="text-sm text-slate-500">
                      Round totals update from Live Scoring.
                    </p>
                  </div>

                  <TeamTable
                    rows={[...rows].sort((a, b) => b.total - a.total)}
                    showScore
                  />
                </section>
              ) : null}

              {tab === "history" ? (
                <section className="rounded-2xl border bg-white shadow-sm">
                  <div className="border-b p-5">
                    <h2 className="text-lg font-bold">Athlete season history</h2>
                    <p className="text-sm text-slate-500">
                      Completed and historical totals across available events.
                    </p>
                  </div>

                  <div className="divide-y">
                    {roster.map((athlete) => {
                      const athleteRegistrations = data.registrations.filter(
                        (item) => item.athlete_id === athlete.id,
                      )

                      const athleteRegistrationIds = new Set(
                        athleteRegistrations.map((item) => item.id),
                      )

                      const athleteEntries = data.enrollments.filter((item) =>
                        athleteRegistrationIds.has(item.registration_id),
                      )

                      const historical = athleteEntries.reduce(
                        (sum, item) => sum + (item.historical_total_score ?? 0),
                        0,
                      )

                      return (
                        <div
                          key={athlete.id}
                          className="grid grid-cols-[1fr_auto_auto] gap-4 p-5"
                        >
                          <p className="font-semibold">{athleteName(athlete)}</p>
                          <p className="text-sm text-slate-500">
                            {athleteRegistrations.length} events
                          </p>
                          <p className="font-bold">{historical || "—"}</p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </PageContainer>
    </div>
  )
}

function ProgressCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="font-bold">{value}%</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
          }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-400">{detail}</p>
    </div>
  )
}

function QuickAction({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      to={href}
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
    >
      {label}
    </Link>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <Icon className="h-5 w-5 text-emerald-600" />
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

function TeamTable({
  rows,
  showScore = false,
}: {
  rows: Array<any>
  showScore?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-slate-500">
        No team participants are registered for this event.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3">Participant</th>
            <th className="px-5 py-3">Class</th>
            <th className="px-5 py-3">Check-in</th>
            <th className="px-5 py-3">Squad / Post</th>
            <th className="px-5 py-3">Payment</th>

            {showScore ? (
              <th className="px-5 py-3 text-right">Score</th>
            ) : null}
          </tr>
        </thead>

        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.registration.id}>
              <td className="px-5 py-4 font-semibold">
                {row.athlete
                  ? athleteName(row.athlete)
                  : "Unknown participant"}
              </td>

              <td className="px-5 py-4">
                {row.classRecord?.code || "—"}
              </td>

              <td className="px-5 py-4">
                {row.registration.checked_in ? "Checked in" : "Pending"}
              </td>

              <td className="px-5 py-4">
                {row.squad
                  ? `Squad ${row.squad.squad_number}${
                      row.squadMember
                        ? ` · ${
                            row.squadMember.position_label ||
                            `Post ${row.squadMember.position}`
                          }`
                        : ""
                    }`
                  : "Unassigned"}
              </td>

              <td className="px-5 py-4 capitalize">
                {(row.registration.payment_status || "unknown").replaceAll(
                  "_",
                  " ",
                )}
              </td>

              {showScore ? (
                <td className="px-5 py-4 text-right text-lg font-bold">
                  {row.total}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
