import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
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
import {
  assignCoachToTeam,
  createCoachActivationLink,
  createCoachPortalCoach,
  createCoachPortalTeam,
  endCoachTeamAssignment,
  loadCoachManagementData,
  loadCoachPortalData,
  updateCoachPortalCoach,
  updateCoachPortalTeam,
  type CoachManagementRecord,
  type TeamCoachAssignment,
} from "@/lib/services/coachPortal"

type PortalData = Awaited<ReturnType<typeof loadCoachPortalData>>
type Tab =
  | "overview"
  | "roster"
  | "events"
  | "scores"
  | "history"
  | "management"

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

  const [managementCoaches, setManagementCoaches] = useState<
    CoachManagementRecord[]
  >([])
  const [managementAssignments, setManagementAssignments] = useState<
    TeamCoachAssignment[]
  >([])
  const [managementLoaded, setManagementLoaded] = useState(false)
  const [managementBusy, setManagementBusy] = useState(false)
  const [managementError, setManagementError] = useState("")
  const [managementMessage, setManagementMessage] = useState("")
  const [teamName, setTeamName] = useState("")
  const [schoolClubName, setSchoolClubName] = useState("")
  const [mascot, setMascot] = useState("")
  const [primaryColor, setPrimaryColor] = useState("")
  const [secondaryColor, setSecondaryColor] = useState("")
  const [teamNotes, setTeamNotes] = useState("")
  const [coachIdToAssign, setCoachIdToAssign] = useState("")
  const [coachRole, setCoachRole] = useState("coach")
  const [headCoach, setHeadCoach] = useState(false)

  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamSchoolClub, setNewTeamSchoolClub] =
    useState("")

  const [newCoachFirstName, setNewCoachFirstName] =
    useState("")
  const [newCoachLastName, setNewCoachLastName] =
    useState("")
  const [newCoachPreferredName, setNewCoachPreferredName] =
    useState("")
  const [newCoachEmail, setNewCoachEmail] = useState("")
  const [newCoachPhone, setNewCoachPhone] = useState("")

  const [coachActivationLink, setCoachActivationLink] =
    useState("")
  const [coachActivationEmail, setCoachActivationEmail] =
    useState("")

  const [editCoachFirstName, setEditCoachFirstName] =
    useState("")
  const [editCoachLastName, setEditCoachLastName] =
    useState("")
  const [editCoachPreferredName, setEditCoachPreferredName] =
    useState("")
  const [editCoachEmail, setEditCoachEmail] =
    useState("")
  const [editCoachPhone, setEditCoachPhone] =
    useState("")

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

  const finalizedDigitalByMember = useMemo(
    () =>
      new Map(
        (data?.digitalScorecards ?? [])
          .filter(
            (scorecard) =>
              scorecard.status === "finalized" &&
              scorecard.total_targets > 0 &&
              memberIds.has(scorecard.squad_member_id),
          )
          .map((scorecard) => [scorecard.squad_member_id, scorecard]),
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

        const total = athleteEnrollments.reduce((sum, entry) => {
          if (entry.historical_total_score !== null) {
            return sum + entry.historical_total_score
          }

          const member = athleteMembers.find(
            (item) => item.registration_shoot_id === entry.id,
          )
          const digitalScorecard = member
            ? finalizedDigitalByMember.get(member.id)
            : undefined

          if (digitalScorecard) {
            return sum + digitalScorecard.total_score
          }

          return (
            sum +
            athleteScores
              .filter((score) => score.squad_member_id === member?.id)
              .reduce((scoreSum, score) => scoreSum + (score.score ?? 0), 0)
          )
        }, 0)

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
    [
      registrations,
      data,
      enrollments,
      members,
      scores,
      finalizedDigitalByMember,
    ],
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

        if (member && finalizedDigitalByMember.has(member.id)) {
          return true
        }

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

  const selectedTeam = data?.teams.find((team) => team.id === teamId)

  async function loadManagement() {
    if (!data?.isManager) return

    setManagementBusy(true)
    setManagementError("")

    try {
      const result = await loadCoachManagementData()
      setManagementCoaches(result.coaches)
      setManagementAssignments(result.assignments)
      setManagementLoaded(true)

      setCoachIdToAssign((current) =>
        current && result.coaches.some((coach) => coach.id === current)
          ? current
          : result.coaches[0]?.id || "",
      )
    } catch (nextError) {
      setManagementError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load team management.",
      )
    } finally {
      setManagementBusy(false)
    }
  }

  useEffect(() => {
    if (!selectedTeam) {
      setTeamName("")
      setSchoolClubName("")
      setMascot("")
      setPrimaryColor("")
      setSecondaryColor("")
      setTeamNotes("")
      return
    }

    setTeamName(selectedTeam.name)
    setSchoolClubName(selectedTeam.school_club_name ?? "")
    setMascot(selectedTeam.mascot ?? "")
    setPrimaryColor(selectedTeam.primary_color ?? "")
    setSecondaryColor(selectedTeam.secondary_color ?? "")
    setTeamNotes(selectedTeam.notes ?? "")
  }, [selectedTeam])

  useEffect(() => {
    if (tab === "management" && data?.isManager && !managementLoaded) {
      void loadManagement()
    }
  }, [tab, data?.isManager, managementLoaded])

  useEffect(() => {
    const coach = managementCoaches.find(
      (item) => item.id === coachIdToAssign,
    )

    if (!coach) {
      setEditCoachFirstName("")
      setEditCoachLastName("")
      setEditCoachPreferredName("")
      setEditCoachEmail("")
      setEditCoachPhone("")
      return
    }

    setEditCoachFirstName(coach.first_name)
    setEditCoachLastName(coach.last_name)
    setEditCoachPreferredName(
      coach.preferred_name ?? "",
    )
    setEditCoachEmail(coach.email ?? "")
    setEditCoachPhone(coach.phone ?? "")
  }, [coachIdToAssign, managementCoaches])

  async function createTeam() {
    setManagementBusy(true)
    setManagementError("")
    setManagementMessage("")

    try {
      const created = await createCoachPortalTeam({
        name: newTeamName,
        schoolClubName: newTeamSchoolClub,
      })

      setNewTeamName("")
      setNewTeamSchoolClub("")

      await refresh()
      setTeamId(created.id)
      setManagementMessage("Team created.")
    } catch (nextError) {
      setManagementError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create team.",
      )
    } finally {
      setManagementBusy(false)
    }
  }

  async function createCoach() {
    setManagementBusy(true)
    setManagementError("")
    setManagementMessage("")

    try {
      const created = await createCoachPortalCoach({
        firstName: newCoachFirstName,
        lastName: newCoachLastName,
        preferredName: newCoachPreferredName,
        email: newCoachEmail,
        phone: newCoachPhone,
      })

      setNewCoachFirstName("")
      setNewCoachLastName("")
      setNewCoachPreferredName("")
      setNewCoachEmail("")
      setNewCoachPhone("")

      const result = await loadCoachManagementData()

      setManagementCoaches(result.coaches)
      setManagementAssignments(result.assignments)
      setManagementLoaded(true)
      setCoachIdToAssign(created.id)
      setManagementMessage(
        "Coach created and ready to assign.",
      )
    } catch (nextError) {
      setManagementError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create coach.",
      )
    } finally {
      setManagementBusy(false)
    }
  }

  async function saveTeam() {
    if (!teamId) return

    setManagementBusy(true)
    setManagementError("")
    setManagementMessage("")

    try {
      await updateCoachPortalTeam(teamId, {
        name: teamName,
        school_club_name: schoolClubName,
        mascot,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        notes: teamNotes,
      })

      await refresh()
      setManagementMessage("Team details saved.")
    } catch (nextError) {
      setManagementError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save team details.",
      )
    } finally {
      setManagementBusy(false)
    }
  }

  async function saveCoachDetails() {
    if (!coachIdToAssign) return

    setManagementBusy(true)
    setManagementError("")
    setManagementMessage("")
    setCoachActivationLink("")
    setCoachActivationEmail("")

    try {
      await updateCoachPortalCoach(
        coachIdToAssign,
        {
          firstName: editCoachFirstName,
          lastName: editCoachLastName,
          preferredName: editCoachPreferredName,
          email: editCoachEmail,
          phone: editCoachPhone,
        },
      )

      const result =
        await loadCoachManagementData()

      setManagementCoaches(result.coaches)
      setManagementAssignments(
        result.assignments,
      )
      setManagementMessage(
        "Coach details saved.",
      )
    } catch (nextError) {
      setManagementError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save coach details.",
      )
    } finally {
      setManagementBusy(false)
    }
  }

  async function generateCoachActivationLink() {
    if (!coachIdToAssign) return

    setManagementBusy(true)
    setManagementError("")
    setManagementMessage("")
    setCoachActivationLink("")
    setCoachActivationEmail("")

    try {
      const result =
        await createCoachActivationLink(
          coachIdToAssign,
        )

      setCoachActivationLink(
        result.activationUrl,
      )
      setCoachActivationEmail(result.email)
      setManagementMessage(
        "Coach activation link created.",
      )
    } catch (nextError) {
      setManagementError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create coach activation link.",
      )
    } finally {
      setManagementBusy(false)
    }
  }

  async function assignCoach() {
    if (!teamId || !coachIdToAssign) return

    setManagementBusy(true)
    setManagementError("")
    setManagementMessage("")

    try {
      await assignCoachToTeam({
        teamId,
        coachId: coachIdToAssign,
        role: coachRole,
        isHeadCoach: headCoach,
      })

      const result = await loadCoachManagementData()
      setManagementCoaches(result.coaches)
      setManagementAssignments(result.assignments)
      setManagementMessage("Coach assigned to team.")
    } catch (nextError) {
      setManagementError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to assign coach.",
      )
    } finally {
      setManagementBusy(false)
    }
  }

  async function endAssignment(assignmentId: string) {
    setManagementBusy(true)
    setManagementError("")
    setManagementMessage("")

    try {
      await endCoachTeamAssignment(assignmentId)

      const result = await loadCoachManagementData()
      setManagementCoaches(result.coaches)
      setManagementAssignments(result.assignments)
      setManagementMessage("Coach assignment ended.")
    } catch (nextError) {
      setManagementError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to end coach assignment.",
      )
    } finally {
      setManagementBusy(false)
    }
  }

  const activeTeamAssignments = managementAssignments.filter(
    (assignment) =>
      assignment.team_id === teamId &&
      (!assignment.end_date ||
        assignment.end_date >= new Date().toISOString().slice(0, 10)),
  )

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Coach Portal"
        description="Team roster, event readiness, squadding, scores, and participant history in one workspace."
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
                ["history", "Participant History"],
                ...(data?.isManager
                  ? ([["management", "Team Management"]] as const)
                  : []),
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
                        <QuickAction href="/scoring" label="Digital Scoring" />
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
                              Participant # {athlete.cyssa_number || "—"}
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
                      Round totals update from scoring.
                    </p>
                  </div>

                  <TeamTable
                    rows={rows}
                    showScore
                    defaultSort="score"
                  />
                </section>
              ) : null}

              {tab === "history" ? (
                <section className="rounded-2xl border bg-white shadow-sm">
                  <div className="border-b p-5">
                    <h2 className="text-lg font-bold">Participant season history</h2>
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

                      const seasonTotal = athleteEntries.reduce(
                        (sum, entry) => {
                          if (entry.historical_total_score !== null) {
                            return sum + entry.historical_total_score
                          }

                          const member = data.members.find(
                            (item) =>
                              item.registration_shoot_id === entry.id,
                          )
                          const digitalScorecard = member
                            ? finalizedDigitalByMember.get(member.id)
                            : undefined

                          if (digitalScorecard) {
                            return sum + digitalScorecard.total_score
                          }

                          return (
                            sum +
                            data.scores
                              .filter(
                                (score) =>
                                  score.squad_member_id === member?.id,
                              )
                              .reduce(
                                (scoreSum, score) =>
                                  scoreSum + (score.score ?? 0),
                                0,
                              )
                          )
                        },
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
                          <p className="font-bold">{seasonTotal || "—"}</p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}

              {tab === "management" && data.isManager ? (
                <div className="space-y-6">
                  <section className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                      <h2 className="text-lg font-bold">
                        Create Team
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Add a team to this organization.
                      </p>

                      <div className="mt-4 space-y-4">
                        <label className="block text-sm font-medium">
                          Team Name
                          <input
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={newTeamName}
                            onChange={(event) =>
                              setNewTeamName(event.target.value)
                            }
                            placeholder="Team name"
                          />
                        </label>

                        <label className="block text-sm font-medium">
                          School / Club Name
                          <input
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={newTeamSchoolClub}
                            onChange={(event) =>
                              setNewTeamSchoolClub(
                                event.target.value,
                              )
                            }
                            placeholder="Optional"
                          />
                        </label>

                        <Button
                          onClick={() => void createTeam()}
                          disabled={
                            managementBusy ||
                            !newTeamName.trim()
                          }
                        >
                          Create Team
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                      <h2 className="text-lg font-bold">
                        Create Coach
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Add a coach, then assign the coach to a
                        team below.
                      </p>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium">
                          First Name
                          <input
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={newCoachFirstName}
                            onChange={(event) =>
                              setNewCoachFirstName(
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <label className="text-sm font-medium">
                          Last Name
                          <input
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={newCoachLastName}
                            onChange={(event) =>
                              setNewCoachLastName(
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <label className="text-sm font-medium">
                          Preferred Name
                          <input
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={newCoachPreferredName}
                            onChange={(event) =>
                              setNewCoachPreferredName(
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <label className="text-sm font-medium">
                          Email
                          <input
                            type="email"
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={newCoachEmail}
                            onChange={(event) =>
                              setNewCoachEmail(event.target.value)
                            }
                          />
                        </label>

                        <label className="text-sm font-medium sm:col-span-2">
                          Phone
                          <input
                            type="tel"
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={newCoachPhone}
                            onChange={(event) =>
                              setNewCoachPhone(event.target.value)
                            }
                          />
                        </label>
                      </div>

                      <Button
                        className="mt-4"
                        onClick={() => void createCoach()}
                        disabled={
                          managementBusy ||
                          !newCoachFirstName.trim() ||
                          !newCoachLastName.trim()
                        }
                      >
                        Create Coach
                      </Button>
                    </div>
                  </section>

                  {managementMessage ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                      {managementMessage}
                    </div>
                  ) : null}

                  {coachActivationLink ? (
                    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="font-semibold text-blue-900">
                        Coach activation link
                      </p>

                      <p className="mt-1 text-sm text-blue-800">
                        Send this private link to{" "}
                        <strong>
                          {coachActivationEmail}
                        </strong>
                        .
                      </p>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          readOnly
                          value={coachActivationLink}
                          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                        />

                        <Button
                          variant="outline"
                          onClick={() =>
                            void navigator.clipboard.writeText(
                              coachActivationLink,
                            )
                          }
                        >
                          Copy Link
                        </Button>
                      </div>

                      <p className="mt-2 text-xs text-blue-700">
                        The link expires after 7 days. Creating
                        another link invalidates the previous one.
                      </p>
                    </section>
                  ) : null}

                  {managementError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                      {managementError}
                    </div>
                  ) : null}

                  {managementMessage ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                      {managementMessage}
                    </div>
                  ) : null}

                  <section className="rounded-2xl border bg-white shadow-sm">
                    <div className="border-b p-5">
                      <h2 className="text-lg font-bold">Team details</h2>
                      <p className="text-sm text-slate-500">
                        Manage the selected team's identity and organization information.
                      </p>
                    </div>

                    <div className="grid gap-4 p-5 md:grid-cols-2">
                      <label className="text-sm font-medium">
                        Team name
                        <input
                          value={teamName}
                          onChange={(event) => setTeamName(event.target.value)}
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                      </label>

                      <label className="text-sm font-medium">
                        School / club
                        <input
                          value={schoolClubName}
                          onChange={(event) => setSchoolClubName(event.target.value)}
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                      </label>

                      <label className="text-sm font-medium">
                        Mascot
                        <input
                          value={mascot}
                          onChange={(event) => setMascot(event.target.value)}
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                      </label>

                      <div />

                      <label className="text-sm font-medium">
                        Primary color
                        <input
                          value={primaryColor}
                          onChange={(event) => setPrimaryColor(event.target.value)}
                          placeholder="#000000"
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                      </label>

                      <label className="text-sm font-medium">
                        Secondary color
                        <input
                          value={secondaryColor}
                          onChange={(event) => setSecondaryColor(event.target.value)}
                          placeholder="#000000"
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                      </label>

                      <label className="text-sm font-medium md:col-span-2">
                        Notes
                        <textarea
                          value={teamNotes}
                          onChange={(event) => setTeamNotes(event.target.value)}
                          rows={4}
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                      </label>

                      <div className="md:col-span-2">
                        <Button
                          onClick={() => void saveTeam()}
                          disabled={managementBusy || !teamId}
                        >
                          {managementBusy ? "Saving…" : "Save team details"}
                        </Button>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border bg-white shadow-sm">
                    <div className="border-b p-5">
                      <h2 className="text-lg font-bold">Coach assignments</h2>
                      <p className="text-sm text-slate-500">
                        Assign coaches to the selected team or end an existing assignment.
                      </p>
                    </div>

                    <div className="grid gap-4 border-b p-5 lg:grid-cols-[1fr_220px_auto_auto]">
                      <label className="text-sm font-medium">
                        Coach
                        <select
                          value={coachIdToAssign}
                          onChange={(event) => setCoachIdToAssign(event.target.value)}
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        >
                          <option value="">Select coach</option>
                          {managementCoaches.map((coach) => (
                            <option key={coach.id} value={coach.id}>
                              {`${coach.preferred_name?.trim() || coach.first_name} ${coach.last_name}`.trim()}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm font-medium">
                        Role
                        <input
                          value={coachRole}
                          onChange={(event) => setCoachRole(event.target.value)}
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                      </label>

                      <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={headCoach}
                          onChange={(event) => setHeadCoach(event.target.checked)}
                        />
                        Head coach
                      </label>

                      <div className="flex items-end">
                        {coachIdToAssign ? (
                          <div className="rounded-xl border bg-slate-50 p-4">
                            <p className="font-semibold">
                              Coach Account Details
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Add the coach&apos;s email here before
                              generating account access.
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <label className="text-sm font-medium">
                                First Name
                                <input
                                  value={editCoachFirstName}
                                  onChange={(event) =>
                                    setEditCoachFirstName(
                                      event.target.value,
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                                />
                              </label>

                              <label className="text-sm font-medium">
                                Last Name
                                <input
                                  value={editCoachLastName}
                                  onChange={(event) =>
                                    setEditCoachLastName(
                                      event.target.value,
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                                />
                              </label>

                              <label className="text-sm font-medium">
                                Preferred Name
                                <input
                                  value={editCoachPreferredName}
                                  onChange={(event) =>
                                    setEditCoachPreferredName(
                                      event.target.value,
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                                />
                              </label>

                              <label className="text-sm font-medium">
                                Email
                                <input
                                  type="email"
                                  value={editCoachEmail}
                                  onChange={(event) =>
                                    setEditCoachEmail(
                                      event.target.value,
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                                />
                              </label>

                              <label className="text-sm font-medium sm:col-span-2">
                                Phone
                                <input
                                  type="tel"
                                  value={editCoachPhone}
                                  onChange={(event) =>
                                    setEditCoachPhone(
                                      event.target.value,
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                                />
                              </label>
                            </div>

                            <Button
                              variant="outline"
                              className="mt-3"
                              onClick={() =>
                                void saveCoachDetails()
                              }
                              disabled={
                                managementBusy ||
                                !editCoachFirstName.trim() ||
                                !editCoachLastName.trim()
                              }
                            >
                              Save Coach Details
                            </Button>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => void assignCoach()}
                            disabled={
                              managementBusy ||
                              !teamId ||
                              !coachIdToAssign
                            }
                          >
                            Assign coach
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() =>
                              void generateCoachActivationLink()
                            }
                            disabled={
                              managementBusy ||
                              !coachIdToAssign
                            }
                          >
                            Generate Activation Link
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y">
                      {managementBusy && !managementLoaded ? (
                        <p className="p-5 text-sm text-slate-500">
                          Loading coach assignments…
                        </p>
                      ) : null}

                      {!managementBusy &&
                      managementLoaded &&
                      activeTeamAssignments.length === 0 ? (
                        <p className="p-5 text-sm text-slate-500">
                          No active coach assignments for this team.
                        </p>
                      ) : null}

                      {activeTeamAssignments.map((assignment) => {
                        const coach = managementCoaches.find(
                          (item) => item.id === assignment.coach_id,
                        )

                        return (
                          <div
                            key={assignment.id}
                            className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-semibold">
                                {coach
                                  ? `${coach.preferred_name?.trim() || coach.first_name} ${coach.last_name}`.trim()
                                  : "Coach"}
                              </p>
                              <p className="text-sm text-slate-500">
                                {assignment.role}
                                {assignment.is_head_coach ? " · Head coach" : ""}
                              </p>
                            </div>

                            <Button
                              variant="outline"
                              disabled={managementBusy}
                              onClick={() => void endAssignment(assignment.id)}
                            >
                              End assignment
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </div>
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
  defaultSort = "participant",
}: {
  rows: Array<any>
  showScore?: boolean
  defaultSort?: "participant" | "score"
}) {
  type SortKey =
    | "participant"
    | "class"
    | "checkin"
    | "squad"
    | "payment"
    | "score"

  type Filters = {
    participant: string
    class: string
    checkin: string
    squad: string
    payment: string
    score: string
  }

  const EMPTY_FILTERS: Filters = {
    participant: "",
    class: "",
    checkin: "",
    squad: "",
    payment: "",
    score: "",
  }

  const [sortKey, setSortKey] = useState<SortKey>(defaultSort)
  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">(defaultSort === "score" ? "desc" : "asc")
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  useEffect(() => {
    setSortKey(defaultSort)
    setSortDirection(defaultSort === "score" ? "desc" : "asc")
  }, [defaultSort])

  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-slate-500">
        No team participants are registered for this event.
      </div>
    )
  }

  function participantValue(row: any) {
    return row.athlete
      ? athleteName(row.athlete)
      : "Unknown participant"
  }

  function classValue(row: any) {
    return row.classRecord?.code || "—"
  }

  function checkInValue(row: any) {
    return row.registration.checked_in ? "Checked in" : "Pending"
  }

  function squadValue(row: any) {
    return row.squad
      ? `Squad ${row.squad.squad_number}${
          row.squadMember
            ? ` · ${
                row.squadMember.position_label ||
                `Post ${row.squadMember.position}`
              }`
            : ""
        }`
      : "Unassigned"
  }

  function paymentValue(row: any) {
    return (row.registration.payment_status || "unknown").replaceAll("_", " ")
  }

  function matches(value: unknown, filter: string) {
    return (
      !filter.trim() ||
      String(value ?? "")
        .toLowerCase()
        .includes(filter.trim().toLowerCase())
    )
  }

  const visibleRows = [...rows]
    .filter(
      (row) =>
        matches(participantValue(row), filters.participant) &&
        matches(classValue(row), filters.class) &&
        matches(checkInValue(row), filters.checkin) &&
        matches(squadValue(row), filters.squad) &&
        matches(paymentValue(row), filters.payment) &&
        (!showScore || matches(row.total, filters.score)),
    )
    .sort((left, right) => {
      const valueFor = (row: any): string | number => {
        if (sortKey === "participant") return participantValue(row)
        if (sortKey === "class") return classValue(row)
        if (sortKey === "checkin") return checkInValue(row)
        if (sortKey === "squad") return squadValue(row)
        if (sortKey === "payment") return paymentValue(row)
        return row.total ?? 0
      }

      const leftValue = valueFor(left)
      const rightValue = valueFor(right)

      let result: number

      if (
        typeof leftValue === "number" &&
        typeof rightValue === "number"
      ) {
        result = leftValue - rightValue
      } else {
        result = String(leftValue).localeCompare(
          String(rightValue),
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        )
      }

      if (result === 0) {
        result = participantValue(left).localeCompare(
          participantValue(right),
          undefined,
          {
            sensitivity: "base",
          },
        )
      }

      return sortDirection === "asc" ? result : -result
    })

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc",
      )
      return
    }

    setSortKey(key)
    setSortDirection(key === "score" ? "desc" : "asc")
  }

  function SortHeader({
    column,
    label,
    align = "left",
  }: {
    column: SortKey
    label: string
    align?: "left" | "right"
  }) {
    const Icon =
      sortKey !== column
        ? ArrowUpDown
        : sortDirection === "asc"
          ? ArrowUp
          : ArrowDown

    return (
      <th className={`px-5 pt-3 ${align === "right" ? "text-right" : ""}`}>
        <button
          type="button"
          onClick={() => toggleSort(column)}
          className={`inline-flex items-center gap-1 font-semibold hover:text-slate-900 ${
            align === "right" ? "justify-end" : ""
          }`}
        >
          {label}
          <Icon className="h-3.5 w-3.5" />
        </button>
      </th>
    )
  }

  function FilterCell({
    value,
    onChange,
    placeholder,
    align = "left",
  }: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    align?: "left" | "right"
  }) {
    return (
      <th className="px-5 py-2">
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-8 w-full min-w-20 rounded-md border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 ${
            align === "right" ? "text-right" : ""
          }`}
        />
      </th>
    )
  }

  const filtersActive = Object.values(filters).some(Boolean)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <SortHeader column="participant" label="Participant" />
            <SortHeader column="class" label="Class" />
            <SortHeader column="checkin" label="Check-in" />
            <SortHeader column="squad" label="Squad / Post" />
            <SortHeader column="payment" label="Payment" />

            {showScore ? (
              <SortHeader column="score" label="Score" align="right" />
            ) : null}
          </tr>

          <tr className="border-t border-slate-200 bg-white normal-case tracking-normal print:hidden">
            <FilterCell
              value={filters.participant}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  participant: value,
                }))
              }
              placeholder="Filter participant…"
            />

            <FilterCell
              value={filters.class}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  class: value,
                }))
              }
              placeholder="Filter class…"
            />

            <FilterCell
              value={filters.checkin}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  checkin: value,
                }))
              }
              placeholder="Filter check-in…"
            />

            <FilterCell
              value={filters.squad}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  squad: value,
                }))
              }
              placeholder="Filter squad/post…"
            />

            <FilterCell
              value={filters.payment}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  payment: value,
                }))
              }
              placeholder="Filter payment…"
            />

            {showScore ? (
              <FilterCell
                value={filters.score}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    score: value,
                  }))
                }
                placeholder="Filter score…"
                align="right"
              />
            ) : null}
          </tr>
        </thead>

        <tbody className="divide-y">
          {visibleRows.length === 0 ? (
            <tr>
              <td
                colSpan={showScore ? 6 : 5}
                className="px-5 py-8 text-center text-slate-500"
              >
                No matching participants.
                {filtersActive ? (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="ml-2 font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    Clear filters
                  </button>
                ) : null}
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr key={row.registration.id}>
                <td className="px-5 py-4 font-semibold">
                  {participantValue(row)}
                </td>

                <td className="px-5 py-4">
                  {classValue(row)}
                </td>

                <td className="px-5 py-4">
                  {checkInValue(row)}
                </td>

                <td className="px-5 py-4">
                  {squadValue(row)}
                </td>

                <td className="px-5 py-4 capitalize">
                  {paymentValue(row)}
                </td>

                {showScore ? (
                  <td className="px-5 py-4 text-right text-lg font-bold">
                    {row.total}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {filtersActive && visibleRows.length > 0 ? (
        <div className="border-t bg-slate-50 px-5 py-2 text-right print:hidden">
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  )
}
