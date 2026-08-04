import { supabase } from "@/lib/supabase"

export type ScorecardEvent = {
  id: string
  organization_id: string
  name: string
  start_date: string | null
  discipline: string | null
  event_type: string | null
  location_name: string | null
  host_sponsor: string | null
  sponsor_name: string | null
}

export type ScorecardCourse = {
  id: string
  name: string
  discipline: string
  course_side: "East" | "West" | "Custom"
}

export type ScorecardStation = {
  course_id: string
  station_number: number
  bird_count: number
  notes: string | null
}

export type ScorecardAthlete = {
  id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  cyssa_number: string | null
}

export type ScorecardTeam = {
  id: string
  name: string
}

export type ScorecardRegistration = {
  id: string
  athlete_id: string
  team_id: string | null
  registration_number: string | null
  status: string
  payment_status: string
}

export type ScorecardShoot = {
  id: string
  name: string
  discipline: string
}

export type ScorecardEnrollment = {
  id: string
  registration_id: string
  shoot_id: string
  status: string
}

export type ScorecardSquad = {
  id: string
  shoot_id: string
  squad_number: string
  name: string | null
  course_name: string | null
}

export type ScorecardMember = {
  id: string
  squad_id: string
  registration_shoot_id: string
  position: number
  position_label: string | null
}

export type ScorecardCenterData = {
  event: ScorecardEvent
  courses: ScorecardCourse[]
  stations: ScorecardStation[]
  athletes: ScorecardAthlete[]
  teams: ScorecardTeam[]
  registrations: ScorecardRegistration[]
  shoots: ScorecardShoot[]
  enrollments: ScorecardEnrollment[]
  squads: ScorecardSquad[]
  members: ScorecardMember[]
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadScorecardCenterData(
  eventId: string,
): Promise<ScorecardCenterData> {
  const eventResult = await supabase
    .from("events")
    .select(
      "id,organization_id,name,start_date,discipline,event_type,location_name,host_sponsor,sponsor_name",
    )
    .eq("id", eventId)
    .single()

  throwIfError(eventResult.error)
  const event = eventResult.data as ScorecardEvent

  const [
    courseResult,
    athleteResult,
    teamResult,
    registrationResult,
    shootResult,
    enrollmentResult,
    squadResult,
  ] = await Promise.all([
    supabase
      .from("event_courses")
      .select("id,name,discipline,course_side")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .eq("active", true)
      .order("created_at"),
    supabase
      .from("athletes")
      .select("id,first_name,last_name,preferred_name,cyssa_number")
      .eq("organization_id", event.organization_id),
    supabase
      .from("teams")
      .select("id,name")
      .eq("organization_id", event.organization_id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("registrations")
      .select(
        "id,athlete_id,team_id,registration_number,status,payment_status",
      )
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .eq("status", "registered")
      .in("payment_status", ["paid", "waived", "not_required"]),
    supabase
      .from("shoots")
      .select("id,name,discipline")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .eq("active", true),
    supabase
      .from("registration_shoots")
      .select("id,registration_id,shoot_id,status")
      .eq("organization_id", event.organization_id)
      .eq("event_id", eventId)
      .eq("status", "registered"),
    supabase
      .from("squads")
      .select("id,shoot_id,squad_number,name,course_name")
      .eq("organization_id", event.organization_id),
  ])

  for (const result of [
    courseResult,
    athleteResult,
    teamResult,
    registrationResult,
    shootResult,
    enrollmentResult,
    squadResult,
  ]) {
    throwIfError(result.error)
  }

  const courses = (courseResult.data ?? []) as ScorecardCourse[]
  const courseIds = courses.map((course) => course.id)
  const stationsResult =
    courseIds.length > 0
      ? await supabase
          .from("course_stations")
          .select("course_id,station_number,bird_count,notes")
          .in("course_id", courseIds)
          .order("display_order")
      : { data: [], error: null }

  throwIfError(stationsResult.error)

  const enrollments = (enrollmentResult.data ?? []) as ScorecardEnrollment[]
  const enrollmentIds = enrollments.map((row) => row.id)
  const membersResult =
    enrollmentIds.length > 0
      ? await supabase
          .from("squad_members")
          .select(
            "id,squad_id,registration_shoot_id,position,position_label",
          )
          .in("registration_shoot_id", enrollmentIds)
          .neq("status", "withdrawn")
      : { data: [], error: null }

  throwIfError(membersResult.error)

  return {
    event,
    courses,
    stations: (stationsResult.data ?? []) as ScorecardStation[],
    athletes: (athleteResult.data ?? []) as ScorecardAthlete[],
    teams: (teamResult.data ?? []) as ScorecardTeam[],
    registrations: (registrationResult.data ?? []) as ScorecardRegistration[],
    shoots: (shootResult.data ?? []) as ScorecardShoot[],
    enrollments,
    squads: (squadResult.data ?? []) as ScorecardSquad[],
    members: (membersResult.data ?? []) as ScorecardMember[],
  }
}