import { loadSeasonStandings, type SeasonEventContribution, type SeasonStandingRow } from "@/lib/services/seasonStandings"

export type SeasonTeamEventResult = {
  eventId: string
  eventName: string
  startDate: string | null
  athletesEntered: number
  athletesCounted: number
  teamPoints: number
  averagePercentage: number
  complete: boolean
}

export type SeasonTeamRankingRow = {
  teamName: string
  rank: number
  tied: boolean
  athletes: number
  athletesCounted: number
  eventsRepresented: number
  seasonPoints: number
  averageAthletePoints: number
  totalScore: number
  totalTargets: number
  aggregatePercentage: number
  leaders: Array<{
    athleteId: string
    athleteName: string
    seasonPoints: number
    eventsCounted: number
  }>
  eventResults: SeasonTeamEventResult[]
}

export type SeasonTeamRankingsData = {
  season: Awaited<ReturnType<typeof loadSeasonStandings>>["season"]
  events: Awaited<ReturnType<typeof loadSeasonStandings>>["events"]
  rows: SeasonTeamRankingRow[]
  totals: {
    teams: number
    athletesOnTeams: number
    events: number
    leader: string | null
  }
  scoringRule: string
}

const COUNTING_ATHLETES = 5

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 0.0001
}

function completedContributions(row: SeasonStandingRow) {
  return row.contributions.filter((contribution) => contribution.complete)
}

function topRows(rows: SeasonStandingRow[]) {
  return [...rows]
    .sort((left, right) =>
      right.seasonPoints - left.seasonPoints ||
      right.eventsCounted - left.eventsCounted ||
      right.averagePercentage - left.averagePercentage ||
      left.athleteName.localeCompare(right.athleteName),
    )
    .slice(0, COUNTING_ATHLETES)
}

function teamEventResult(
  event: Awaited<ReturnType<typeof loadSeasonStandings>>["events"][number],
  teamRows: SeasonStandingRow[],
): SeasonTeamEventResult {
  const contributions = teamRows
    .map((row) => row.contributions.find((item) => item.eventId === event.id))
    .filter((item): item is SeasonEventContribution => Boolean(item))

  const complete = contributions.filter((item) => item.complete)
  const counting = [...complete]
    .sort((left, right) => right.points - left.points || right.score - left.score)
    .slice(0, COUNTING_ATHLETES)
  const teamPoints = counting.reduce((sum, item) => sum + item.points, 0)

  return {
    eventId: event.id,
    eventName: event.name,
    startDate: event.start_date,
    athletesEntered: contributions.length,
    athletesCounted: counting.length,
    teamPoints,
    averagePercentage: counting.length > 0 ? teamPoints / counting.length : 0,
    complete: contributions.length > 0 && complete.length === contributions.length,
  }
}

export async function loadSeasonTeamRankings(seasonId: string): Promise<SeasonTeamRankingsData> {
  const standings = await loadSeasonStandings(seasonId)
  const teamMap = new Map<string, SeasonStandingRow[]>()

  for (const row of standings.rows) {
    const teamName = row.teamName.trim()
    if (!teamName || teamName === "No Team") continue
    const current = teamMap.get(teamName) ?? []
    current.push(row)
    teamMap.set(teamName, current)
  }

  let rows: SeasonTeamRankingRow[] = Array.from(teamMap.entries()).map(([teamName, athletes]) => {
    const counting = topRows(athletes)
    const seasonPoints = counting.reduce((sum, row) => sum + row.seasonPoints, 0)
    const totalScore = counting.reduce((sum, row) => sum + row.totalScore, 0)
    const totalTargets = counting.reduce((sum, row) => sum + row.totalTargets, 0)
    const represented = new Set<string>()
    for (const athlete of athletes) {
      for (const contribution of completedContributions(athlete)) represented.add(contribution.eventId)
    }

    return {
      teamName,
      rank: 0,
      tied: false,
      athletes: athletes.length,
      athletesCounted: counting.filter((row) => row.eventsCounted > 0).length,
      eventsRepresented: represented.size,
      seasonPoints,
      averageAthletePoints: counting.length > 0 ? seasonPoints / counting.length : 0,
      totalScore,
      totalTargets,
      aggregatePercentage: totalTargets > 0 ? (totalScore / totalTargets) * 100 : 0,
      leaders: counting.map((row) => ({
        athleteId: row.athleteId,
        athleteName: row.athleteName,
        seasonPoints: row.seasonPoints,
        eventsCounted: row.eventsCounted,
      })),
      eventResults: standings.events.map((event) => teamEventResult(event, athletes)),
    }
  })

  rows.sort((left, right) =>
    right.seasonPoints - left.seasonPoints ||
    right.eventsRepresented - left.eventsRepresented ||
    right.aggregatePercentage - left.aggregatePercentage ||
    left.teamName.localeCompare(right.teamName),
  )

  let lastRank = 0
  let lastPoints: number | null = null
  rows = rows.map((row, index) => {
    if (lastPoints === null || !sameNumber(lastPoints, row.seasonPoints)) lastRank = index + 1
    const tied =
      (index > 0 && sameNumber(rows[index - 1].seasonPoints, row.seasonPoints)) ||
      (index < rows.length - 1 && sameNumber(rows[index + 1].seasonPoints, row.seasonPoints))
    lastPoints = row.seasonPoints
    return { ...row, rank: lastRank, tied }
  })

  return {
    season: standings.season,
    events: standings.events,
    rows,
    totals: {
      teams: rows.length,
      athletesOnTeams: standings.rows.filter((row) => row.teamName !== "No Team").length,
      events: standings.events.length,
      leader: rows[0]?.teamName ?? null,
    },
    scoringRule: `The top ${COUNTING_ATHLETES} athletes on each team count toward the team season total. Each athlete contributes the same normalized season points used in individual standings.`,
  }
}
