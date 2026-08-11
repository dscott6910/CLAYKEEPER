import { supabase } from "@/lib/supabase"

export type DigitalScoringEvent = {
  id: string
  organization_id: string
  name: string
  start_date: string | null
}

export type DigitalScoringShoot = {
  id: string
  event_id: string
  name: string
  discipline: string
  allow_score_entry: boolean
}

export type DigitalScoringCourse = {
  id: string
  name: string
  course_side: string
}

export type DigitalScoringStation = {
  id: string
  course_id: string
  station_number: number
  bird_count: number
  notes: string | null
  display_order: number
}

export type DigitalScoringSquad = {
  id: string
  shoot_id: string
  squad_number: string
  name: string | null
  course_name: string | null
  status: string
}

export type DigitalScoringMember = {
  id: string
  squad_id: string
  registration_shoot_id: string
  position: number
  position_label: string | null
}

export type DigitalScoringEnrollment = {
  id: string
  registration_id: string
  shoot_id: string
}

export type DigitalScoringRegistration = {
  id: string
  athlete_id: string
  team_id: string | null
  class_id: string | null
  registration_number: string | null
}

export type DigitalScoringAthlete = {
  id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  cyssa_number: string | null
}

export type DigitalScoringNamed = { id: string; name: string }
export type DigitalScoringClass = { id: string; code: string; display_name: string }

export type DigitalScorecard = {
  id: string
  organization_id: string
  event_id: string
  shoot_id: string
  squad_member_id: string
  course_id: string
  status: "draft" | "finalized"
  malfunction_count: number
  verified_by_1: string | null
  verified_by_2: string | null
  entered_by_name: string | null
  notes: string | null
  total_score: number
  total_targets: number
  finalized_at: string | null
  updated_at: string
}

export type DigitalStationScore = {
  id: string
  scorecard_id: string
  station_id: string
  hits: number
}

export type DigitalScoringData = {
  event: DigitalScoringEvent
  shoots: DigitalScoringShoot[]
  courses: DigitalScoringCourse[]
  stations: DigitalScoringStation[]
  squads: DigitalScoringSquad[]
  members: DigitalScoringMember[]
  enrollments: DigitalScoringEnrollment[]
  registrations: DigitalScoringRegistration[]
  athletes: DigitalScoringAthlete[]
  teams: DigitalScoringNamed[]
  classes: DigitalScoringClass[]
  scorecards: DigitalScorecard[]
  stationScores: DigitalStationScore[]
}

function check(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Database request failed.")
}

export class DigitalScorecardConflictError extends Error {
  constructor(message = "This scorecard changed on the server after your device loaded it.") {
    super(message)
    this.name = "DigitalScorecardConflictError"
  }
}

export function isDigitalScorecardConflictError(error: unknown) {
  return error instanceof DigitalScorecardConflictError
}

export async function loadDigitalScoring(eventId: string): Promise<DigitalScoringData> {
  const eventResult = await supabase
    .from("events")
    .select("id,organization_id,name,start_date")
    .eq("id", eventId)
    .single()
  check(eventResult.error)
  const event = eventResult.data as DigitalScoringEvent

  const [shoots, courses, squads, registrations, athletes, teams, classes, enrollments, scorecards] = await Promise.all([
    supabase.from("shoots").select("id,event_id,name,discipline,allow_score_entry").eq("organization_id", event.organization_id).eq("event_id", eventId).eq("active", true).order("shoot_date"),
    supabase.from("event_courses").select("id,name,course_side").eq("organization_id", event.organization_id).eq("event_id", eventId).eq("active", true).order("created_at"),
    supabase.from("squads").select("id,shoot_id,squad_number,name,course_name,status").eq("organization_id", event.organization_id),
    supabase.rpc("get_operational_registrations", {
      p_organization_id: event.organization_id,
      p_event_id: eventId,
    }),
    supabase.rpc("get_operational_athletes", {
      p_organization_id: event.organization_id,
    }),
    supabase.from("teams").select("id,name").eq("organization_id", event.organization_id),
    supabase.from("classes").select("id,code,display_name").eq("organization_id", event.organization_id),
    supabase.rpc("get_operational_registration_shoots", {
      p_organization_id: event.organization_id,
      p_event_id: eventId,
    }),
    supabase.from("digital_scorecards").select("id,organization_id,event_id,shoot_id,squad_member_id,course_id,status,malfunction_count,verified_by_1,verified_by_2,entered_by_name,notes,total_score,total_targets,finalized_at,updated_at").eq("organization_id", event.organization_id).eq("event_id", eventId),
  ])
  for (const result of [shoots, courses, squads, registrations, athletes, teams, classes, enrollments, scorecards]) check(result.error)

  const courseRows = (courses.data ?? []) as DigitalScoringCourse[]
  const enrollmentRows = (enrollments.data ?? []).filter(
    (row: { status: string }) => row.status === "registered",
  ) as DigitalScoringEnrollment[]
  const courseIds = courseRows.map((row) => row.id)
  const enrollmentIds = enrollmentRows.map((row) => row.id)
  const scorecardRows = (scorecards.data ?? []) as DigitalScorecard[]
  const scorecardIds = scorecardRows.map((row) => row.id)

  const [stations, members, stationScores] = await Promise.all([
    courseIds.length ? supabase.from("course_stations").select("id,course_id,station_number,bird_count,notes,display_order").in("course_id", courseIds).order("display_order") : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length ? supabase.from("squad_members").select("id,squad_id,registration_shoot_id,position,position_label").in("registration_shoot_id", enrollmentIds).neq("status", "withdrawn").order("position") : Promise.resolve({ data: [], error: null }),
    scorecardIds.length ? supabase.from("digital_scorecard_station_scores").select("id,scorecard_id,station_id,hits").in("scorecard_id", scorecardIds) : Promise.resolve({ data: [], error: null }),
  ])
  for (const result of [stations, members, stationScores]) check(result.error)

  return {
    event,
    shoots: (shoots.data ?? []) as DigitalScoringShoot[],
    courses: courseRows,
    stations: (stations.data ?? []) as DigitalScoringStation[],
    squads: (squads.data ?? []) as DigitalScoringSquad[],
    members: (members.data ?? []) as DigitalScoringMember[],
    enrollments: enrollmentRows,
    registrations: (registrations.data ?? []).filter(
      (row: { status: string }) => row.status === "registered",
    ) as DigitalScoringRegistration[],
    athletes: (athletes.data ?? []) as DigitalScoringAthlete[],
    teams: (teams.data ?? []) as DigitalScoringNamed[],
    classes: (classes.data ?? []) as DigitalScoringClass[],
    scorecards: scorecardRows,
    stationScores: (stationScores.data ?? []) as DigitalStationScore[],
  }
}

export async function saveDigitalScorecard(input: {
  organizationId: string
  eventId: string
  shootId: string
  squadMemberId: string
  courseId: string
  scorecardId?: string | null
  malfunctionCount: number
  verifiedBy1: string
  verifiedBy2: string
  enteredByName: string
  notes: string
  status: "draft" | "finalized"
  expectedUpdatedAt?: string | null
  stationScores: Array<{ stationId: string; hits: number; targets: number }>
}) {
  const { data, error } = await supabase.rpc("save_digital_scorecard_atomic", {
    p_organization_id: input.organizationId,
    p_event_id: input.eventId,
    p_shoot_id: input.shootId,
    p_squad_member_id: input.squadMemberId,
    p_course_id: input.courseId,
    p_scorecard_id: input.scorecardId ?? null,
    p_status: input.status,
    p_malfunction_count: input.malfunctionCount,
    p_verified_by_1: input.verifiedBy1,
    p_verified_by_2: input.verifiedBy2,
    p_entered_by_name: input.enteredByName,
    p_notes: input.notes,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_station_scores: input.stationScores,
  })

  if (error) {
    if (error.message?.includes("CK_SCORECARD_CONFLICT")) {
      throw new DigitalScorecardConflictError(
        input.scorecardId
          ? "A newer server scorecard was found."
          : "Another device created this scorecard while your device was offline.",
      )
    }
    check(error)
  }

  const row = Array.isArray(data) ? data[0] : data
  const scorecardId = row?.scorecard_id as string | undefined
  if (!scorecardId) throw new Error("No scorecard ID was returned.")
  return scorecardId
}
