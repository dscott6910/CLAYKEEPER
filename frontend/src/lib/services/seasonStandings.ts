import { loadDigitalScoring, type DigitalScoringData } from "@/lib/services/digitalScoring"
import { listSeasons, listSeasonEvents, type Season, type SeasonEvent } from "@/lib/services/seasons"

export type SeasonEventContribution = {
  eventId: string
  eventName: string
  startDate: string | null
  score: number
  targets: number
  percentage: number
  points: number
  place: number | null
  complete: boolean
  finalizedScorecards: number
  expectedScorecards: number
}

export type SeasonStandingRow = {
  athleteId: string
  athleteName: string
  cyssaNumber: string | null
  teamName: string
  classCode: string
  eventsEntered: number
  eventsCounted: number
  totalScore: number
  totalTargets: number
  averagePercentage: number
  seasonPoints: number
  tied: boolean
  contributions: SeasonEventContribution[]
}

export type SeasonEventStandingSummary = {
  eventId: string
  eventName: string
  startDate: string | null
  athletes: number
  completedAthletes: number
  completionPercent: number
  available: boolean
  error: string | null
}

export type SeasonStandingsData = {
  season: Season
  events: SeasonEvent[]
  rows: SeasonStandingRow[]
  eventSummaries: SeasonEventStandingSummary[]
  totals: {
    events: number
    athletes: number
    completedResults: number
    incompleteResults: number
  }
}

type AthleteAccumulator = {
  athleteId: string
  athleteName: string
  cyssaNumber: string | null
  teamName: string
  classCode: string
  eventsEntered: Set<string>
  contributions: SeasonEventContribution[]
}

function athleteName(athlete: DigitalScoringData["athletes"][number] | undefined) {
  if (!athlete) return "Unknown Athlete"
  const first = athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim() || "Unnamed Athlete"
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 0.0001
}

function buildEventResults(event: SeasonEvent, source: DigitalScoringData) {
  const enrollmentByRegistration = new Map<string, DigitalScoringData["enrollments"]>()
  for (const enrollment of source.enrollments) {
    const rows = enrollmentByRegistration.get(enrollment.registration_id) ?? []
    rows.push(enrollment)
    enrollmentByRegistration.set(enrollment.registration_id, rows)
  }

  const memberByEnrollment = new Map(source.members.map((member) => [member.registration_shoot_id, member]))
  const scorecardByMember = new Map(source.scorecards.map((scorecard) => [scorecard.squad_member_id, scorecard]))
  const athleteById = new Map(source.athletes.map((athlete) => [athlete.id, athlete]))
  const teamById = new Map(source.teams.map((team) => [team.id, team]))
  const classById = new Map(source.classes.map((row) => [row.id, row]))

  const results = source.registrations.map((registration) => {
    const athlete = athleteById.get(registration.athlete_id)
    const enrollments = enrollmentByRegistration.get(registration.id) ?? []
    const members = enrollments
      .map((enrollment) => memberByEnrollment.get(enrollment.id))
      .filter((member): member is DigitalScoringData["members"][number] => Boolean(member))
    const scorecards = members
      .map((member) => scorecardByMember.get(member.id))
      .filter((scorecard): scorecard is DigitalScoringData["scorecards"][number] => Boolean(scorecard))
    const finalized = scorecards.filter((scorecard) => scorecard.status === "finalized")
    const expectedScorecards = members.length
    const complete = expectedScorecards > 0 && finalized.length === expectedScorecards
    const score = finalized.reduce((sum, scorecard) => sum + Number(scorecard.total_score || 0), 0)
    const targets = finalized.reduce((sum, scorecard) => sum + Number(scorecard.total_targets || 0), 0)
    const percentage = complete && targets > 0 ? (score / targets) * 100 : 0

    return {
      athleteId: registration.athlete_id,
      athleteName: athleteName(athlete),
      cyssaNumber: athlete?.cyssa_number ?? null,
      teamName: registration.team_id ? teamById.get(registration.team_id)?.name ?? "No Team" : "No Team",
      classCode: registration.class_id ? classById.get(registration.class_id)?.code ?? "—" : "—",
      contribution: {
        eventId: event.id,
        eventName: event.name,
        startDate: event.start_date,
        score,
        targets,
        percentage,
        points: complete ? percentage : 0,
        place: null as number | null,
        complete,
        finalizedScorecards: finalized.length,
        expectedScorecards,
      } satisfies SeasonEventContribution,
    }
  })

  const completed = results
    .filter((row) => row.contribution.complete)
    .sort((left, right) =>
      right.contribution.percentage - left.contribution.percentage ||
      right.contribution.score - left.contribution.score ||
      left.athleteName.localeCompare(right.athleteName),
    )

  let lastPlace = 0
  let lastPercentage: number | null = null
  let lastScore: number | null = null
  completed.forEach((row, index) => {
    if (
      lastPercentage === null ||
      !sameNumber(lastPercentage, row.contribution.percentage) ||
      lastScore !== row.contribution.score
    ) {
      lastPlace = index + 1
    }
    row.contribution.place = lastPlace
    lastPercentage = row.contribution.percentage
    lastScore = row.contribution.score
  })

  return results
}

export async function loadSeasonStandings(seasonId: string): Promise<SeasonStandingsData> {
  const [seasons, allEvents] = await Promise.all([listSeasons(), listSeasonEvents()])
  const season = seasons.find((row) => row.id === seasonId)
  if (!season) throw new Error("The selected season could not be found.")

  const events = allEvents
    .filter((event) => event.season_id === seasonId)
    .sort((left, right) => (left.start_date ?? "").localeCompare(right.start_date ?? ""))

  const loaded = await Promise.all(
    events.map(async (event) => {
      try {
        const source = await loadDigitalScoring(event.id)
        const results = buildEventResults(event, source)
        const completedAthletes = results.filter((row) => row.contribution.complete).length
        return {
          event,
          results,
          summary: {
            eventId: event.id,
            eventName: event.name,
            startDate: event.start_date,
            athletes: results.length,
            completedAthletes,
            completionPercent: results.length > 0 ? Math.round((completedAthletes / results.length) * 100) : 0,
            available: true,
            error: null,
          } satisfies SeasonEventStandingSummary,
        }
      } catch (error) {
        return {
          event,
          results: [],
          summary: {
            eventId: event.id,
            eventName: event.name,
            startDate: event.start_date,
            athletes: 0,
            completedAthletes: 0,
            completionPercent: 0,
            available: false,
            error: error instanceof Error ? error.message : "Event scoring data could not be loaded.",
          } satisfies SeasonEventStandingSummary,
        }
      }
    }),
  )

  const athleteMap = new Map<string, AthleteAccumulator>()
  for (const eventResult of loaded) {
    for (const row of eventResult.results) {
      const current = athleteMap.get(row.athleteId) ?? {
        athleteId: row.athleteId,
        athleteName: row.athleteName,
        cyssaNumber: row.cyssaNumber,
        teamName: row.teamName,
        classCode: row.classCode,
        eventsEntered: new Set<string>(),
        contributions: [],
      }
      current.athleteName = row.athleteName
      current.cyssaNumber = row.cyssaNumber
      current.teamName = row.teamName
      current.classCode = row.classCode
      current.eventsEntered.add(eventResult.event.id)
      current.contributions.push(row.contribution)
      athleteMap.set(row.athleteId, current)
    }
  }

  let rows: SeasonStandingRow[] = Array.from(athleteMap.values()).map((athlete) => {
    const counted = athlete.contributions.filter((contribution) => contribution.complete)
    const seasonPoints = counted.reduce((sum, contribution) => sum + contribution.points, 0)
    const totalScore = counted.reduce((sum, contribution) => sum + contribution.score, 0)
    const totalTargets = counted.reduce((sum, contribution) => sum + contribution.targets, 0)
    return {
      athleteId: athlete.athleteId,
      athleteName: athlete.athleteName,
      cyssaNumber: athlete.cyssaNumber,
      teamName: athlete.teamName,
      classCode: athlete.classCode,
      eventsEntered: athlete.eventsEntered.size,
      eventsCounted: counted.length,
      totalScore,
      totalTargets,
      averagePercentage: counted.length > 0 ? seasonPoints / counted.length : 0,
      seasonPoints,
      tied: false,
      contributions: [...athlete.contributions].sort((left, right) => (left.startDate ?? "").localeCompare(right.startDate ?? "")),
    }
  })

  rows.sort((left, right) =>
    right.seasonPoints - left.seasonPoints ||
    right.eventsCounted - left.eventsCounted ||
    right.averagePercentage - left.averagePercentage ||
    left.athleteName.localeCompare(right.athleteName),
  )

  rows = rows.map((row, index) => ({
    ...row,
    tied:
      (index > 0 && sameNumber(rows[index - 1].seasonPoints, row.seasonPoints)) ||
      (index < rows.length - 1 && sameNumber(rows[index + 1].seasonPoints, row.seasonPoints)),
  }))

  const completedResults = rows.reduce((sum, row) => sum + row.eventsCounted, 0)
  const enteredResults = rows.reduce((sum, row) => sum + row.eventsEntered, 0)

  return {
    season,
    events,
    rows,
    eventSummaries: loaded.map((row) => row.summary),
    totals: {
      events: events.length,
      athletes: rows.length,
      completedResults,
      incompleteResults: Math.max(0, enteredResults - completedResults),
    },
  }
}
