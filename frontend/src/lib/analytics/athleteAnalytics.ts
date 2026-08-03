import type { ParticipantProfile } from "@/lib/services/participantProfile"

export type TrendDirection = "improving" | "steady" | "declining"

export type AthleteAnalyticsScope = {
  season: string | null
  label: string
}

export type AthleteTrendPoint = {
  eventId: string
  eventName: string
  eventDate: string | null
  shootId: string
  shootName: string
  discipline: string
  score: number
  possible: number
  percentage: number
}

export type AthleteDisciplineAnalytics = {
  discipline: string
  shootCount: number
  roundsShot: number
  targetsHit: number
  targetsPossible: number
  averageRound: number
  percentage: number
  highestRound: number
  personalBestScore: number
  personalBestPossible: number
  personalBestPercentage: number
}

export type AthleteAnalytics = {
  scope: AthleteAnalyticsScope
  eventCount: number
  shootCount: number
  roundsShot: number
  targetsHit: number
  targetsPossible: number
  averageRound: number
  percentage: number
  highestRound: number
  lowestRound: number
  recentAverage: number
  movingAverage5: number
  movingAverage10: number
  consistencyScore: number
  trend: TrendDirection
  trendChange: number
  personalBest: AthleteTrendPoint | null
  disciplines: AthleteDisciplineAnalytics[]
  trendPoints: AthleteTrendPoint[]
}

type ShootResult = ParticipantProfile["shootResults"][number]

function safeAverage(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0

  const average = safeAverage(values)
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length

  return Math.sqrt(variance)
}

function percentage(score: number, possible: number) {
  return possible > 0 ? (score / possible) * 100 : 0
}

function seasonFromDate(value: string | null) {
  if (!value) return null
  const year = Number(value.slice(0, 4))
  return Number.isFinite(year) ? String(year) : null
}

function filterResults(
  profile: ParticipantProfile,
  season: string | null,
): ShootResult[] {
  if (!season) return profile.shootResults

  return profile.shootResults.filter((result) => {
    const resultSeason =
      "season" in result && typeof result.season === "string"
        ? result.season
        : seasonFromDate(result.event_date)

    return resultSeason === season
  })
}

function toTrendPoint(result: ShootResult): AthleteTrendPoint {
  const possible =
    "total_possible" in result && typeof result.total_possible === "number"
      ? result.total_possible
      : result.round_scores.length *
        ("targets_per_round" in result &&
        typeof result.targets_per_round === "number"
          ? result.targets_per_round
          : 25)

  const resultPercentage =
    "score_percentage" in result &&
    typeof result.score_percentage === "number"
      ? result.score_percentage
      : percentage(result.total_score, possible)

  return {
    eventId: result.event_id,
    eventName: result.event_name,
    eventDate: result.event_date,
    shootId: result.shoot_id,
    shootName: result.shoot_name,
    discipline: result.discipline,
    score: result.total_score,
    possible,
    percentage: resultPercentage,
  }
}

function calculateTrend(points: AthleteTrendPoint[]) {
  const recent = points.slice(-6)

  if (recent.length < 2) {
    return {
      trend: "steady" as const,
      trendChange: 0,
    }
  }

  const split = Math.ceil(recent.length / 2)
  const older = recent.slice(0, split)
  const newer = recent.slice(split)

  const olderAverage = safeAverage(
    older.map((point) => point.percentage),
  )
  const newerAverage = safeAverage(
    newer.map((point) => point.percentage),
  )
  const trendChange = newerAverage - olderAverage

  if (trendChange > 0.5) {
    return {
      trend: "improving" as const,
      trendChange,
    }
  }

  if (trendChange < -0.5) {
    return {
      trend: "declining" as const,
      trendChange,
    }
  }

  return {
    trend: "steady" as const,
    trendChange,
  }
}

function buildDisciplineAnalytics(
  results: ShootResult[],
): AthleteDisciplineAnalytics[] {
  const groups = new Map<string, ShootResult[]>()

  for (const result of results) {
    const existing = groups.get(result.discipline) ?? []
    existing.push(result)
    groups.set(result.discipline, existing)
  }

  return Array.from(groups.entries())
    .map(([discipline, disciplineResults]) => {
      const rounds = disciplineResults.flatMap(
        (result) => result.round_scores,
      )
      const targetsHit = rounds.reduce(
        (sum, score) => sum + score,
        0,
      )
      const targetsPossible = disciplineResults.reduce(
        (sum, result) => {
          const targetsPerRound =
            "targets_per_round" in result &&
            typeof result.targets_per_round === "number"
              ? result.targets_per_round
              : 25

          return sum + result.round_scores.length * targetsPerRound
        },
        0,
      )

      const best =
        disciplineResults
          .map(toTrendPoint)
          .sort(
            (left, right) =>
              right.percentage - left.percentage,
          )[0] ?? null

      return {
        discipline,
        shootCount: disciplineResults.length,
        roundsShot: rounds.length,
        targetsHit,
        targetsPossible,
        averageRound: safeAverage(rounds),
        percentage: percentage(targetsHit, targetsPossible),
        highestRound:
          rounds.length > 0 ? Math.max(...rounds) : 0,
        personalBestScore: best?.score ?? 0,
        personalBestPossible: best?.possible ?? 0,
        personalBestPercentage: best?.percentage ?? 0,
      }
    })
    .sort(
      (left, right) => right.percentage - left.percentage,
    )
}

export function calculateAthleteAnalytics(
  profile: ParticipantProfile,
  season: string | null = null,
): AthleteAnalytics {
  const results = filterResults(profile, season)
  const rounds = results.flatMap((result) => result.round_scores)
  const targetsHit = rounds.reduce((sum, score) => sum + score, 0)

  const targetsPossible = results.reduce((sum, result) => {
    const targetsPerRound =
      "targets_per_round" in result &&
      typeof result.targets_per_round === "number"
        ? result.targets_per_round
        : 25

    return sum + result.round_scores.length * targetsPerRound
  }, 0)

  const trendPoints = results
    .map(toTrendPoint)
    .sort((left, right) =>
      (left.eventDate ?? "").localeCompare(right.eventDate ?? ""),
    )

  const recentPercentages = trendPoints
    .slice(-5)
    .map((point) => point.percentage)

  const moving5 = trendPoints
    .slice(-5)
    .map((point) => point.percentage)

  const moving10 = trendPoints
    .slice(-10)
    .map((point) => point.percentage)

  const consistencyDeviation = standardDeviation(rounds)
  const consistencyScore = Math.max(
    0,
    Math.min(100, 100 - consistencyDeviation * 10),
  )

  const personalBest =
    [...trendPoints].sort(
      (left, right) => right.percentage - left.percentage,
    )[0] ?? null

  const eventCount = new Set(
    results.map((result) => result.event_id),
  ).size

  const trendResult = calculateTrend(trendPoints)

  return {
    scope: {
      season,
      label: season ? `${season} Season` : "All-Time",
    },
    eventCount,
    shootCount: results.length,
    roundsShot: rounds.length,
    targetsHit,
    targetsPossible,
    averageRound: safeAverage(rounds),
    percentage: percentage(targetsHit, targetsPossible),
    highestRound: rounds.length > 0 ? Math.max(...rounds) : 0,
    lowestRound: rounds.length > 0 ? Math.min(...rounds) : 0,
    recentAverage: safeAverage(recentPercentages),
    movingAverage5: safeAverage(moving5),
    movingAverage10: safeAverage(moving10),
    consistencyScore,
    trend: trendResult.trend,
    trendChange: trendResult.trendChange,
    personalBest,
    disciplines: buildDisciplineAnalytics(results),
    trendPoints,
  }
}

export function availableAthleteSeasons(
  profile: ParticipantProfile,
): string[] {
  return Array.from(
    new Set(
      profile.shootResults
        .map((result) => {
          if (
            "season" in result &&
            typeof result.season === "string"
          ) {
            return result.season
          }

          return seasonFromDate(result.event_date)
        })
        .filter((season): season is string => Boolean(season)),
    ),
  ).sort((left, right) => right.localeCompare(left))
}
