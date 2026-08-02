import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type ParticipantProfile = {
  athlete: {
    id: string
    first_name: string
    last_name: string
    preferred_name: string | null
    class_id: string | null
    graduation_year: number | null
    cyssa_number: string | null
    ata_number: string | null
    nssa_number: string | null
    email: string | null
    phone: string | null
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
    notes: string | null
    active: boolean
  }
  classRecord: {
    id: string
    code: string
    display_name: string
  } | null
  teamHistory: Array<{
    id: string
    team_id: string
    team_name: string
    is_primary: boolean
    start_date: string | null
    end_date: string | null
  }>
  registrations: Array<{
    id: string
    event_id: string
    event_name: string
    event_date: string | null
    checked_in: boolean
    payment_status: string
    status: string
  }>
  shootResults: Array<{
    registration_id: string
    event_id: string
    event_name: string
    event_date: string | null
    shoot_id: string
    shoot_name: string
    discipline: string
    number_of_rounds: number
    round_scores: number[]
    historical_total_score: number | null
    total_score: number
  }>
  statistics: {
    eventCount: number
    shootCount: number
    roundsShot: number
    targetsHit: number
    averageRound: number
    highestRound: number
    highestShootTotal: number
    disciplineAverages: Array<{
      discipline: string
      averageRound: number
      roundsShot: number
      targetsHit: number
    }>
  }
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadParticipantProfile(
  athleteId: string,
): Promise<ParticipantProfile> {
  const organizationId = await getCurrentOrganizationId()

  const [athleteResult, assignmentsResult, registrationsResult] =
    await Promise.all([
      supabase
        .from("athletes")
        .select(
          "id, first_name, last_name, preferred_name, class_id, graduation_year, cyssa_number, ata_number, nssa_number, email, phone, emergency_contact_name, emergency_contact_phone, notes, active",
        )
        .eq("organization_id", organizationId)
        .eq("id", athleteId)
        .maybeSingle(),

      supabase
        .from("athlete_teams")
        .select("id, team_id, is_primary, start_date, end_date")
        .eq("organization_id", organizationId)
        .eq("athlete_id", athleteId)
        .order("start_date", { ascending: false }),

      supabase
        .from("registrations")
        .select("id, event_id, checked_in, payment_status, status")
        .eq("organization_id", organizationId)
        .eq("athlete_id", athleteId),
    ])

  throwIfError(athleteResult.error)
  throwIfError(assignmentsResult.error)
  throwIfError(registrationsResult.error)

  if (!athleteResult.data) throw new Error("Participant not found.")

  const athlete = athleteResult.data
  const assignments = assignmentsResult.data ?? []
  const registrationRows = registrationsResult.data ?? []

  const teamIds = Array.from(new Set(assignments.map((row) => row.team_id)))
  const eventIds = Array.from(
    new Set(registrationRows.map((row) => row.event_id)),
  )
  const registrationIds = registrationRows.map((row) => row.id)

  const [classResult, teamsResult, eventsResult, enrollmentsResult] =
    await Promise.all([
      athlete.class_id
        ? supabase
            .from("classes")
            .select("id, code, display_name")
            .eq("organization_id", organizationId)
            .eq("id", athlete.class_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),

      teamIds.length
        ? supabase
            .from("teams")
            .select("id, name")
            .eq("organization_id", organizationId)
            .in("id", teamIds)
        : Promise.resolve({ data: [], error: null }),

      eventIds.length
        ? supabase
            .from("events")
            .select("id, name, start_date")
            .eq("organization_id", organizationId)
            .in("id", eventIds)
        : Promise.resolve({ data: [], error: null }),

      registrationIds.length
        ? supabase
            .from("registration_shoots")
            .select(
              "id, registration_id, shoot_id, historical_total_score, status",
            )
            .eq("organization_id", organizationId)
            .in("registration_id", registrationIds)
        : Promise.resolve({ data: [], error: null }),
    ])

  throwIfError(classResult.error)
  throwIfError(teamsResult.error)
  throwIfError(eventsResult.error)
  throwIfError(enrollmentsResult.error)

  const teamById = new Map(
    (teamsResult.data ?? []).map((team) => [team.id, team]),
  )
  const eventById = new Map(
    (eventsResult.data ?? []).map((event) => [event.id, event]),
  )

  const registrations = registrationRows
    .map((registration) => {
      const event = eventById.get(registration.event_id)
      return {
        id: registration.id,
        event_id: registration.event_id,
        event_name: event?.name ?? "Unknown event",
        event_date: event?.start_date ?? null,
        checked_in: registration.checked_in,
        payment_status: registration.payment_status,
        status: registration.status,
      }
    })
    .sort((left, right) =>
      (right.event_date ?? "").localeCompare(left.event_date ?? ""),
    )

  const registrationById = new Map(
    registrations.map((registration) => [registration.id, registration]),
  )

  const enrollments = enrollmentsResult.data ?? []
  const enrollmentIds = enrollments.map((row) => row.id)
  const shootIds = Array.from(new Set(enrollments.map((row) => row.shoot_id)))

  const [shootsResult, membersResult] = await Promise.all([
    shootIds.length
      ? supabase
          .from("shoots")
          .select(
            "id, event_id, name, discipline, number_of_rounds, targets_per_round",
          )
          .eq("organization_id", organizationId)
          .in("id", shootIds)
      : Promise.resolve({ data: [], error: null }),

    enrollmentIds.length
      ? supabase
          .from("squad_members")
          .select("id, registration_shoot_id, shoot_id")
          .eq("organization_id", organizationId)
          .in("registration_shoot_id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  throwIfError(shootsResult.error)
  throwIfError(membersResult.error)

  const shoots = shootsResult.data ?? []
  const members = membersResult.data ?? []
  const shootById = new Map(shoots.map((shoot) => [shoot.id, shoot]))
  const memberByEnrollmentId = new Map(
    members.map((member) => [member.registration_shoot_id, member]),
  )
  const memberIds = members.map((member) => member.id)

  const scoresResult = memberIds.length
    ? await supabase
        .from("score_entries")
        .select("squad_member_id, round_number, score, status")
        .eq("organization_id", organizationId)
        .in("squad_member_id", memberIds)
        .not("score", "is", null)
        .order("round_number")
    : { data: [], error: null }

  throwIfError(scoresResult.error)

  const scoresByMemberId = new Map<
    string,
    Array<{ round_number: number; score: number }>
  >()

  for (const score of scoresResult.data ?? []) {
    const current = scoresByMemberId.get(score.squad_member_id) ?? []
    current.push({
      round_number: score.round_number,
      score: score.score ?? 0,
    })
    scoresByMemberId.set(score.squad_member_id, current)
  }

  const shootResults = enrollments
    .map((enrollment) => {
      const registration = registrationById.get(enrollment.registration_id)
      const shoot = shootById.get(enrollment.shoot_id)
      const member = memberByEnrollmentId.get(enrollment.id)
      const memberScores = member
        ? [...(scoresByMemberId.get(member.id) ?? [])].sort(
            (left, right) => left.round_number - right.round_number,
          )
        : []

      const roundScores = memberScores.map((row) => row.score)
      const scoreTotal = roundScores.reduce((sum, score) => sum + score, 0)
      const historicalTotal = enrollment.historical_total_score ?? null

      return {
        registration_id: enrollment.registration_id,
        event_id: registration?.event_id ?? shoot?.event_id ?? "",
        event_name: registration?.event_name ?? "Unknown event",
        event_date: registration?.event_date ?? null,
        shoot_id: enrollment.shoot_id,
        shoot_name: shoot?.name ?? "Unknown shoot",
        discipline: shoot?.discipline ?? "unknown",
        number_of_rounds: shoot?.number_of_rounds ?? 0,
        round_scores: roundScores,
        historical_total_score: historicalTotal,
        total_score: historicalTotal ?? scoreTotal,
      }
    })
    .sort((left, right) =>
      (right.event_date ?? "").localeCompare(left.event_date ?? ""),
    )

  const allRoundScores = shootResults.flatMap((result) => result.round_scores)
  const targetsHit = allRoundScores.reduce((sum, score) => sum + score, 0)

  const disciplineMap = new Map<
    string,
    { roundsShot: number; targetsHit: number }
  >()

  for (const result of shootResults) {
    if (!result.round_scores.length) continue

    const current = disciplineMap.get(result.discipline) ?? {
      roundsShot: 0,
      targetsHit: 0,
    }

    current.roundsShot += result.round_scores.length
    current.targetsHit += result.round_scores.reduce(
      (sum, score) => sum + score,
      0,
    )
    disciplineMap.set(result.discipline, current)
  }

  return {
    athlete,
    classRecord: classResult.data,
    teamHistory: assignments.map((assignment) => ({
      id: assignment.id,
      team_id: assignment.team_id,
      team_name: teamById.get(assignment.team_id)?.name ?? "Unknown team",
      is_primary: assignment.is_primary,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
    })),
    registrations,
    shootResults,
    statistics: {
      eventCount: registrations.length,
      shootCount: shootResults.length,
      roundsShot: allRoundScores.length,
      targetsHit,
      averageRound: allRoundScores.length
        ? targetsHit / allRoundScores.length
        : 0,
      highestRound: allRoundScores.length
        ? Math.max(...allRoundScores)
        : 0,
      highestShootTotal: shootResults.length
        ? Math.max(...shootResults.map((result) => result.total_score))
        : 0,
      disciplineAverages: Array.from(disciplineMap.entries())
        .map(([discipline, values]) => ({
          discipline,
          averageRound: values.roundsShot
            ? values.targetsHit / values.roundsShot
            : 0,
          roundsShot: values.roundsShot,
          targetsHit: values.targetsHit,
        }))
        .sort((left, right) => right.averageRound - left.averageRound),
    },
  }
}
