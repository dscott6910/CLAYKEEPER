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
  checkedIn: number
  courses: number
  enabledStations: number
  enrollments: number
  squads: number
  assignedMembers: number
  unassignedEnrollments: number
  collected: number
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
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

  const [shootsResult, registrationsResult, coursesResult, enrollmentsResult] =
    await Promise.all([
      supabase
        .from("shoots")
        .select("id,allow_score_entry")
        .eq("organization_id", event.organization_id)
        .eq("event_id", eventId)
        .eq("active", true),
      supabase
        .from("registrations")
        .select("id,status,payment_status,checked_in,amount_paid")
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
    ])

  for (const result of [
    shootsResult,
    registrationsResult,
    coursesResult,
    enrollmentsResult,
  ]) {
    throwIfError(result.error)
  }

  const shoots = shootsResult.data ?? []
  const registrations = registrationsResult.data ?? []
  const courses = coursesResult.data ?? []
  const enrollments = enrollmentsResult.data ?? []
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
          .select("id")
          .eq("organization_id", event.organization_id)
          .in("shoot_id", shootIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? supabase
          .from("squad_members")
          .select("id,registration_shoot_id,status")
          .eq("organization_id", event.organization_id)
          .in("registration_shoot_id", enrollmentIds)
          .neq("status", "withdrawn")
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [stationsResult, squadsResult, membersResult]) {
    throwIfError(result.error)
  }

  const stations = stationsResult.data ?? []
  const members = membersResult.data ?? []
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

  return {
    event,
    shoots: shoots.length,
    scoringEnabledShoots: shoots.filter((row) => row.allow_score_entry)
      .length,
    registrations: activeRegistrations.length,
    eligibleRegistrations: eligibleRegistrations.length,
    unpaidRegistrations:
      activeRegistrations.length - eligibleRegistrations.length,
    checkedIn: activeRegistrations.filter((row) => row.checked_in).length,
    courses: courses.length,
    enabledStations: stations.filter((row) => numeric(row.bird_count) > 0)
      .length,
    enrollments: enrollments.length,
    squads: (squadsResult.data ?? []).length,
    assignedMembers: members.length,
    unassignedEnrollments: enrollments.filter(
      (row) => !assignedEnrollmentIds.has(row.id),
    ).length,
    collected: activeRegistrations.reduce(
      (total, row) => total + numeric(row.amount_paid),
      0,
    ),
  }
}