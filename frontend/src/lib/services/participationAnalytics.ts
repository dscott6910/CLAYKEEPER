import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type AnalyticsFilter = {
  seasonId?: string
  eventId?: string
  discipline?: string
}

export type NamedMetric = { label: string; value: number }
export type SeasonOption = { id: string; name: string; status: string }
export type EventOption = { id: string; name: string; seasonId: string | null }

export type ParticipationCompetitionAnalytics = {
  seasons: SeasonOption[]
  events: EventOption[]
  totalParticipants: number
  uniqueTeams: number
  totalRegistrations: number
  scoredParticipants: number
  averageScore: number
  highScore: number
  completionRate: number
  participationBySeason: NamedMetric[]
  newVsReturning: Array<{ label: string; newParticipants: number; returningParticipants: number }>
  registrationsByDiscipline: NamedMetric[]
  participationByClass: NamedMetric[]
  teamParticipation: NamedMetric[]
  averageByDiscipline: NamedMetric[]
  scoreDistribution: NamedMetric[]
  topParticipants: Array<{ athleteId: string; name: string; team: string; total: number; average: number; rounds: number }>
  topTeams: Array<{ teamId: string; name: string; average: number; participants: number; rounds: number }>
}

type SeasonRow = { id: string; name: string; status: string; start_date: string }
type EventRow = { id: string; name: string; season_id: string | null }
type RegistrationRow = { id: string; event_id: string; athlete_id: string; team_id: string | null; class_id: string | null; status: string }
type RegistrationShootRow = { id: string; registration_id: string; shoot_id: string; status: string }
type ShootRow = { id: string; discipline: string; number_of_rounds: number; targets_per_round: number }
type SquadMemberRow = { id: string; registration_shoot_id: string; status: string }
type ScoreRow = { squad_member_id: string; shoot_id: string; round_number: number; score: number | null; status: string }
type AthleteRow = { id: string; first_name: string; last_name: string; preferred_name: string | null }
type TeamRow = { id: string; name: string }
type ClassRow = { id: string; code: string; display_name: string }

const excludedStatuses = new Set(["cancelled", "withdrawn", "disqualified"])

function round(value: number, places = 1) {
  const multiplier = 10 ** places
  return Math.round(value * multiplier) / multiplier
}

function disciplineLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export async function loadParticipationCompetitionAnalytics(
  filter: AnalyticsFilter = {},
): Promise<ParticipationCompetitionAnalytics> {
  const organizationId = await getCurrentOrganizationId()

  const [seasonsResult, eventsResult, registrationsResult, registrationShootsResult, shootsResult, squadMembersResult, scoresResult, athletesResult, teamsResult, classesResult] = await Promise.all([
    supabase.from("seasons").select("id, name, status, start_date").eq("organization_id", organizationId).order("start_date", { ascending: true }),
    supabase.from("events").select("id, name, season_id").eq("organization_id", organizationId),
    supabase.from("registrations").select("id, event_id, athlete_id, team_id, class_id, status").eq("organization_id", organizationId),
    supabase.from("registration_shoots").select("id, registration_id, shoot_id, status").eq("organization_id", organizationId),
    supabase.from("shoots").select("id, discipline, number_of_rounds, targets_per_round").eq("organization_id", organizationId),
    supabase.from("squad_members").select("id, registration_shoot_id, status").eq("organization_id", organizationId),
    supabase.from("score_entries").select("squad_member_id, shoot_id, round_number, score, status").eq("organization_id", organizationId),
    supabase.from("athletes").select("id, first_name, last_name, preferred_name").eq("organization_id", organizationId),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId),
    supabase.from("classes").select("id, code, display_name").eq("organization_id", organizationId),
  ])

  const results = [seasonsResult, eventsResult, registrationsResult, registrationShootsResult, shootsResult, squadMembersResult, scoresResult, athletesResult, teamsResult, classesResult]
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)

  const seasons = (seasonsResult.data ?? []) as SeasonRow[]
  const events = (eventsResult.data ?? []) as EventRow[]
  const registrations = ((registrationsResult.data ?? []) as RegistrationRow[]).filter((row) => !excludedStatuses.has(row.status))
  const registrationShoots = ((registrationShootsResult.data ?? []) as RegistrationShootRow[]).filter((row) => !excludedStatuses.has(row.status))
  const shoots = (shootsResult.data ?? []) as ShootRow[]
  const squadMembers = ((squadMembersResult.data ?? []) as SquadMemberRow[]).filter((row) => !excludedStatuses.has(row.status))
  const scores = ((scoresResult.data ?? []) as ScoreRow[]).filter((row) => row.score !== null && row.status !== "disqualified")
  const athletes = (athletesResult.data ?? []) as AthleteRow[]
  const teams = (teamsResult.data ?? []) as TeamRow[]
  const classes = (classesResult.data ?? []) as ClassRow[]

  const shootById = new Map(shoots.map((row) => [row.id, row]))
  const registrationById = new Map(registrations.map((row) => [row.id, row]))
  const registrationShootById = new Map(registrationShoots.map((row) => [row.id, row]))
  const squadMemberById = new Map(squadMembers.map((row) => [row.id, row]))
  const athleteById = new Map(athletes.map((row) => [row.id, row]))
  const teamById = new Map(teams.map((row) => [row.id, row]))
  const classById = new Map(classes.map((row) => [row.id, row]))

  const selectedEventIds = new Set(
    events
      .filter((event) => (!filter.seasonId || event.season_id === filter.seasonId) && (!filter.eventId || event.id === filter.eventId))
      .map((event) => event.id),
  )
  const selectedShootIds = new Set(
    shoots
      .filter((shoot) => !filter.discipline || shoot.discipline === filter.discipline)
      .map((shoot) => shoot.id),
  )

  const filteredRegistrations = registrations.filter((row) => selectedEventIds.has(row.event_id))
  const filteredRegistrationIds = new Set(filteredRegistrations.map((row) => row.id))
  const filteredRegistrationShoots = registrationShoots.filter((row) => filteredRegistrationIds.has(row.registration_id) && selectedShootIds.has(row.shoot_id))
  const filteredRegistrationShootIds = new Set(filteredRegistrationShoots.map((row) => row.id))
  const filteredSquadMembers = squadMembers.filter((row) => filteredRegistrationShootIds.has(row.registration_shoot_id))
  const filteredMemberIds = new Set(filteredSquadMembers.map((row) => row.id))
  const filteredScores = scores.filter((row) => filteredMemberIds.has(row.squad_member_id) && selectedShootIds.has(row.shoot_id))

  const participantIds = new Set(filteredRegistrations.map((row) => row.athlete_id))
  const teamIds = new Set(filteredRegistrations.flatMap((row) => row.team_id ? [row.team_id] : []))
  const scoredAthletes = new Set<string>()
  const athleteScores = new Map<string, number[]>()
  const teamScores = new Map<string, { scores: number[]; athletes: Set<string> }>()
  const disciplineScores = new Map<string, number[]>()

  for (const score of filteredScores) {
    const member = squadMemberById.get(score.squad_member_id)
    const registrationShoot = member ? registrationShootById.get(member.registration_shoot_id) : undefined
    const registration = registrationShoot ? registrationById.get(registrationShoot.registration_id) : undefined
    const shoot = shootById.get(score.shoot_id)
    if (!registration || !shoot || score.score === null) continue
    scoredAthletes.add(registration.athlete_id)
    const athleteList = athleteScores.get(registration.athlete_id) ?? []
    athleteList.push(score.score)
    athleteScores.set(registration.athlete_id, athleteList)
    const disciplineList = disciplineScores.get(shoot.discipline) ?? []
    disciplineList.push(score.score)
    disciplineScores.set(shoot.discipline, disciplineList)
    if (registration.team_id) {
      const current = teamScores.get(registration.team_id) ?? { scores: [], athletes: new Set<string>() }
      current.scores.push(score.score)
      current.athletes.add(registration.athlete_id)
      teamScores.set(registration.team_id, current)
    }
  }

  const allScoreValues = filteredScores.flatMap((row) => row.score === null ? [] : [row.score])
  const averageScore = allScoreValues.length ? round(allScoreValues.reduce((sum, value) => sum + value, 0) / allScoreValues.length) : 0
  const highScore = allScoreValues.length ? Math.max(...allScoreValues) : 0

  const participationBySeason = seasons.map((season) => {
    const seasonEventIds = new Set(events.filter((event) => event.season_id === season.id).map((event) => event.id))
    return { label: season.name, value: new Set(registrations.filter((row) => seasonEventIds.has(row.event_id)).map((row) => row.athlete_id)).size }
  })

  const firstSeasonByAthlete = new Map<string, string>()
  for (const season of seasons) {
    const seasonEventIds = new Set(events.filter((event) => event.season_id === season.id).map((event) => event.id))
    for (const row of registrations.filter((registration) => seasonEventIds.has(registration.event_id))) {
      if (!firstSeasonByAthlete.has(row.athlete_id)) firstSeasonByAthlete.set(row.athlete_id, season.id)
    }
  }
  const seenAthletes = new Set<string>()
  const newVsReturning = seasons.map((season) => {
    const seasonEventIds = new Set(events.filter((event) => event.season_id === season.id).map((event) => event.id))
    const seasonAthletes = new Set(registrations.filter((row) => seasonEventIds.has(row.event_id)).map((row) => row.athlete_id))
    let newParticipants = 0
    let returningParticipants = 0
    for (const athleteId of seasonAthletes) {
      if (firstSeasonByAthlete.get(athleteId) === season.id && !seenAthletes.has(athleteId)) newParticipants += 1
      else returningParticipants += 1
      seenAthletes.add(athleteId)
    }
    return { label: season.name, newParticipants, returningParticipants }
  })

  const disciplineCounts = new Map<string, Set<string>>()
  for (const row of filteredRegistrationShoots) {
    const registration = registrationById.get(row.registration_id)
    const shoot = shootById.get(row.shoot_id)
    if (!registration || !shoot) continue
    const set = disciplineCounts.get(shoot.discipline) ?? new Set<string>()
    set.add(registration.athlete_id)
    disciplineCounts.set(shoot.discipline, set)
  }

  const classCounts = new Map<string, Set<string>>()
  const teamCounts = new Map<string, Set<string>>()
  for (const row of filteredRegistrations) {
    if (row.class_id) {
      const set = classCounts.get(row.class_id) ?? new Set<string>()
      set.add(row.athlete_id)
      classCounts.set(row.class_id, set)
    }
    if (row.team_id) {
      const set = teamCounts.get(row.team_id) ?? new Set<string>()
      set.add(row.athlete_id)
      teamCounts.set(row.team_id, set)
    }
  }

  const scoreDistributionBuckets = [
    { label: "0–9", min: 0, max: 9 },
    { label: "10–14", min: 10, max: 14 },
    { label: "15–19", min: 15, max: 19 },
    { label: "20–22", min: 20, max: 22 },
    { label: "23–24", min: 23, max: 24 },
    { label: "25", min: 25, max: 25 },
    { label: "26+", min: 26, max: Number.POSITIVE_INFINITY },
  ]

  const completedRegistrations = new Set(
    filteredScores.flatMap((score) => {
      const member = squadMemberById.get(score.squad_member_id)
      const rs = member ? registrationShootById.get(member.registration_shoot_id) : undefined
      return rs ? [rs.registration_id] : []
    }),
  )

  return {
    seasons: seasons.map((row) => ({ id: row.id, name: row.name, status: row.status })),
    events: events.map((row) => ({ id: row.id, name: row.name, seasonId: row.season_id })),
    totalParticipants: participantIds.size,
    uniqueTeams: teamIds.size,
    totalRegistrations: filteredRegistrations.length,
    scoredParticipants: scoredAthletes.size,
    averageScore,
    highScore,
    completionRate: filteredRegistrations.length ? Math.round((completedRegistrations.size / filteredRegistrations.length) * 100) : 0,
    participationBySeason,
    newVsReturning,
    registrationsByDiscipline: Array.from(disciplineCounts.entries()).map(([key, value]) => ({ label: disciplineLabel(key), value: value.size })).sort((a, b) => b.value - a.value),
    participationByClass: Array.from(classCounts.entries()).map(([key, value]) => ({ label: classById.get(key)?.code ?? classById.get(key)?.display_name ?? "Unclassified", value: value.size })).sort((a, b) => b.value - a.value),
    teamParticipation: Array.from(teamCounts.entries()).map(([key, value]) => ({ label: teamById.get(key)?.name ?? "Unknown team", value: value.size })).sort((a, b) => b.value - a.value).slice(0, 10),
    averageByDiscipline: Array.from(disciplineScores.entries()).map(([key, values]) => ({ label: disciplineLabel(key), value: round(values.reduce((sum, value) => sum + value, 0) / values.length) })).sort((a, b) => b.value - a.value),
    scoreDistribution: scoreDistributionBuckets.map((bucket) => ({ label: bucket.label, value: allScoreValues.filter((value) => value >= bucket.min && value <= bucket.max).length })),
    topParticipants: Array.from(athleteScores.entries()).map(([athleteId, values]) => {
      const athlete = athleteById.get(athleteId)
      const registration = filteredRegistrations.find((row) => row.athlete_id === athleteId)
      const total = values.reduce((sum, value) => sum + value, 0)
      return {
        athleteId,
        name: athlete ? `${athlete.preferred_name || athlete.first_name} ${athlete.last_name}` : "Unknown participant",
        team: registration?.team_id ? teamById.get(registration.team_id)?.name ?? "Unassigned" : "Unassigned",
        total,
        average: round(total / values.length),
        rounds: values.length,
      }
    }).sort((a, b) => b.average - a.average || b.total - a.total).slice(0, 10),
    topTeams: Array.from(teamScores.entries()).map(([teamId, data]) => ({
      teamId,
      name: teamById.get(teamId)?.name ?? "Unknown team",
      average: round(data.scores.reduce((sum, value) => sum + value, 0) / data.scores.length),
      participants: data.athletes.size,
      rounds: data.scores.length,
    })).sort((a, b) => b.average - a.average).slice(0, 10),
  }
}
