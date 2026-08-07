import { supabase } from "@/lib/supabase"

export type OperationsStatus =
  | "not_started"
  | "needs_attention"
  | "ready"
  | "complete"

export type OperationsEvent = {
  id: string
  organization_id: string
  name: string
  start_date: string | null
  status: string | null
  discipline: string | null
  location_name: string | null
  host_sponsor: string | null
}

export type OperationsSnapshot = {
  event: OperationsEvent
  shoots: number
  scoringEnabledShoots: number
  registrations: number
  eligibleRegistrations: number
  unpaidRegistrations: number
  registrationReadyPercent: number
  checkedIn: number
  checkInPercent: number
  lateArrivals: number
  noShows: number
  refundsPending: number
  courses: number
  enabledStations: number
  enrollments: number
  squads: number
  assignedMembers: number
  unassignedEnrollments: number
  squadsNotStarted: number
  squadsInProgress: number
  squadsComplete: number
  collected: number
  scorecardsStarted: number
  scorecardsDraft: number
  scorecardsFinalized: number
  scorecardsMissing: number
  athletesCurrentlyShooting: number
  athletesFinished: number
  scoringCompletionPercent: number
  lastScoreAt: string | null
  awardsStatus: "provisional" | "approved" | "published" | null
  awardsReady: boolean
  awardsProgressPercent: number
  publicPortalOpen: boolean
  publicLiveScores: boolean
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)))
}

export async function loadTournamentOperations(
  eventId: string,
): Promise<OperationsSnapshot> {
  const eventResult = await supabase
    .from("events")
    .select(
      "id,organization_id,name,start_date,status,discipline,location_name,host_sponsor",
    )
    .eq("id", eventId)
    .single()

  throwIfError(eventResult.error)
  const event = eventResult.data as OperationsEvent

  const [
    shootsResult,
    registrationsResult,
    coursesResult,
    enrollmentsResult,
    scorecardsResult,
    awardsResult,
    publicSettingsResult,
  ] = await Promise.all([
    supabase
      .from("shoots")
      .select("id,allow_score_entry")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .eq("active", true),
    supabase
      .from("registrations")
      .select(
        "id,status,payment_status,checked_in,attendance_status,refund_status,amount_paid",
      )
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId),
    supabase
      .from("event_courses")
      .select("id")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .eq("active", true),
    supabase
      .from("registration_shoots")
      .select("id,shoot_id,status")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .eq("status", "registered"),
    supabase
      .from("digital_scorecards")
      .select("id,squad_member_id,status,updated_at")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId),
    supabase
      .from("award_publications")
      .select("status,updated_at")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("public_event_settings")
      .select("is_public,show_live_scores")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .maybeSingle(),
  ])

  for (const result of [
    shootsResult,
    registrationsResult,
    coursesResult,
    enrollmentsResult,
    scorecardsResult,
    awardsResult,
    publicSettingsResult,
  ]) {
    throwIfError(result.error)
  }

  const shoots = shootsResult.data ?? []
  const registrations = registrationsResult.data ?? []
  const courses = coursesResult.data ?? []
  const enrollments = enrollmentsResult.data ?? []
  const scorecards = scorecardsResult.data ?? []
  const courseIds = courses.map((row) => row.id)
  const shootIds = shoots.map((row) => row.id)
  const enrollmentIds = enrollments.map((row) => row.id)

  const [stationsResult, squadsResult, membersResult] = await Promise.all([
    courseIds.length
      ? supabase
          .from("course_stations")
          .select("id,bird_count")
          .in("course_id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    shootIds.length
      ? supabase
          .from("squads")
          .select("id,status")
          .eq("organization_id", event.organization_id)
          .in("shoot_id", shootIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? supabase
          .from("squad_members")
          .select("id,squad_id,registration_shoot_id,status")
          .eq("organization_id", event.organization_id)
          .in("registration_shoot_id", enrollmentIds)
          .neq("status", "withdrawn")
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [stationsResult, squadsResult, membersResult]) {
    throwIfError(result.error)
  }

  const stations = stationsResult.data ?? []
  const squads = squadsResult.data ?? []
  const members = membersResult.data ?? []
  const memberIds = new Set(members.map((member) => member.id))
  const currentScorecards = scorecards.filter((row) =>
    memberIds.has(row.squad_member_id),
  )
  const scorecardByMember = new Map(
    currentScorecards.map((row) => [row.squad_member_id, row]),
  )
  const assignedEnrollmentIds = new Set(
    members.map((member) => member.registration_shoot_id),
  )
  const paidStatuses = new Set(["paid", "waived", "not_required"])
  const activeRegistrations = registrations.filter(
    (row) => row.status !== "cancelled" && row.status !== "withdrawn",
  )
  const eligibleRegistrations = activeRegistrations.filter((row) =>
    paidStatuses.has(row.payment_status),
  )
  const checkedIn = activeRegistrations.filter(
    (row) => row.attendance_status === "checked_in" || row.checked_in,
  ).length
  const finalized = currentScorecards.filter(
    (row) => row.status === "finalized",
  ).length
  const drafts = currentScorecards.filter((row) => row.status === "draft").length
  const scoringCompletionPercent = percent(finalized, members.length)

  let squadsNotStarted = 0
  let squadsInProgress = 0
  let squadsComplete = 0

  for (const squad of squads) {
    const squadMembers = members.filter((member) => member.squad_id === squad.id)
    if (squadMembers.length === 0) {
      squadsNotStarted += 1
      continue
    }

    const started = squadMembers.filter((member) =>
      scorecardByMember.has(member.id),
    ).length
    const squadFinalized = squadMembers.filter(
      (member) => scorecardByMember.get(member.id)?.status === "finalized",
    ).length

    if (squadFinalized === squadMembers.length) {
      squadsComplete += 1
    } else if (started > 0) {
      squadsInProgress += 1
    } else {
      squadsNotStarted += 1
    }
  }

  const awardsStatus =
    ((awardsResult.data ?? [])[0]?.status as OperationsSnapshot["awardsStatus"]) ??
    null
  const awardsReady = members.length > 0 && scoringCompletionPercent === 100
  const awardsProgressPercent =
    awardsStatus === "published"
      ? 100
      : awardsStatus === "approved"
        ? 80
        : awardsStatus === "provisional"
          ? 60
          : awardsReady
            ? 40
            : 0

  return {
    event,
    shoots: shoots.length,
    scoringEnabledShoots: shoots.filter((row) => row.allow_score_entry).length,
    registrations: activeRegistrations.length,
    eligibleRegistrations: eligibleRegistrations.length,
    unpaidRegistrations: activeRegistrations.length - eligibleRegistrations.length,
    registrationReadyPercent: percent(
      eligibleRegistrations.length,
      activeRegistrations.length,
    ),
    checkedIn,
    checkInPercent: percent(checkedIn, eligibleRegistrations.length),
    lateArrivals: activeRegistrations.filter(
      (row) => row.attendance_status === "late_arrival",
    ).length,
    noShows: activeRegistrations.filter(
      (row) => row.attendance_status === "no_show",
    ).length,
    refundsPending: activeRegistrations.filter(
      (row) =>
        row.refund_status === "pending_review" ||
        row.refund_status === "full_refund_due",
    ).length,
    courses: courses.length,
    enabledStations: stations.filter((row) => numeric(row.bird_count) > 0).length,
    enrollments: enrollments.length,
    squads: squads.length,
    assignedMembers: members.length,
    unassignedEnrollments: enrollments.filter(
      (row) => !assignedEnrollmentIds.has(row.id),
    ).length,
    squadsNotStarted,
    squadsInProgress,
    squadsComplete,
    scorecardsStarted: currentScorecards.length,
    scorecardsDraft: drafts,
    scorecardsFinalized: finalized,
    scorecardsMissing: Math.max(0, members.length - currentScorecards.length),
    athletesCurrentlyShooting: drafts,
    athletesFinished: finalized,
    scoringCompletionPercent,
    lastScoreAt:
      currentScorecards
        .map((row) => row.updated_at as string | null)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
    awardsStatus,
    awardsReady,
    awardsProgressPercent,
    publicPortalOpen: Boolean(publicSettingsResult.data?.is_public),
    publicLiveScores: Boolean(publicSettingsResult.data?.show_live_scores),
    collected: activeRegistrations.reduce(
      (total, row) => total + numeric(row.amount_paid),
      0,
    ),
  }
}
