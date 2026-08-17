import { supabase } from "@/lib/supabase"
import {
  loadDigitalScoring,
  type DigitalScoringData,
  type DigitalScorecard,
} from "@/lib/services/digitalScoring"

export type LeaderboardEventOption = {
  id: string
  name: string
  start_date: string | null
  status: string | null
  discipline: string | null
}

export type DigitalLeaderboardRow = {
  memberId: string
  registrationId: string
  athleteName: string
  teamId: string | null
  teamName: string
  classCode: string
  squadId: string
  squadNumber: string
  postLabel: string
  score: number
  targets: number
  percentage: number
  status: "missing" | "draft" | "finalized"
  updatedAt: string | null
  tied: boolean
}

export type DigitalTeamStanding = {
  teamId: string
  teamName: string
  athleteCount: number
  countedAthletes: number
  score: number
  targets: number
  tied: boolean
}

export type DigitalSquadProgress = {
  squadId: string
  squadNumber: string
  members: number
  started: number
  finalized: number
  missing: number
  completionPercent: number
}

export type DigitalLeaderboardData = {
  source: DigitalScoringData
  selectedShootId: string
  rows: DigitalLeaderboardRow[]
  teamStandings: DigitalTeamStanding[]
  squadProgress: DigitalSquadProgress[]
  totals: {
    expected: number
    missing: number
    drafts: number
    finalized: number
    completionPercent: number
    lastScoreAt: string | null
  }
}

function check(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Database request failed.")
}

function athleteName(
  athlete: DigitalScoringData["athletes"][number] | undefined,
) {
  if (!athlete) return "Unknown participant"
  const first =
    athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim() || "Unnamed participant"
}

function scorecardStatus(scorecard: DigitalScorecard | undefined) {
  if (!scorecard) return "missing" as const
  return scorecard.status
}

function applyTieFlags<T extends { score: number; status?: string; tied: boolean }>(
  rows: T[],
) {
  const counts = new Map<number, number>()
  for (const row of rows) {
    if (row.status && row.status !== "finalized") continue
    counts.set(row.score, (counts.get(row.score) ?? 0) + 1)
  }
  return rows.map((row) => ({
    ...row,
    tied:
      (!row.status || row.status === "finalized") &&
      (counts.get(row.score) ?? 0) > 1,
  }))
}

export async function listDigitalLeaderboardEvents(): Promise<LeaderboardEventOption[]> {
  const result = await supabase
    .from("events")
    .select("id,name,start_date,status,discipline")
    .order("start_date", { ascending: false })
  check(result.error)
  return (result.data ?? []) as LeaderboardEventOption[]
}

export async function loadDigitalLeaderboard(
  eventId: string,
  shootId?: string,
): Promise<DigitalLeaderboardData> {
  const source = await loadDigitalScoring(eventId)
  const selectedShootId =
    shootId && source.shoots.some((row) => row.id === shootId)
      ? shootId
      : source.shoots[0]?.id ?? ""

  const enrollmentById = new Map(source.enrollments.map((row) => [row.id, row]))
  const registrationById = new Map(source.registrations.map((row) => [row.id, row]))
  const athleteById = new Map(source.athletes.map((row) => [row.id, row]))
  const teamById = new Map(source.teams.map((row) => [row.id, row]))
  const classById = new Map(source.classes.map((row) => [row.id, row]))
  const squadById = new Map(source.squads.map((row) => [row.id, row]))
  const scorecardByMember = new Map(
    source.scorecards
      .filter((row) => row.shoot_id === selectedShootId)
      .map((row) => [row.squad_member_id, row]),
  )

  let rows: DigitalLeaderboardRow[] = source.members
    .filter((member) => {
      const enrollment = enrollmentById.get(member.registration_shoot_id)
      return enrollment?.shoot_id === selectedShootId
    })
    .map((member) => {
      const enrollment = enrollmentById.get(member.registration_shoot_id)
      const registration = enrollment
        ? registrationById.get(enrollment.registration_id)
        : undefined
      const athlete = registration
        ? athleteById.get(registration.athlete_id)
        : undefined
      const team = registration?.team_id
        ? teamById.get(registration.team_id)
        : undefined
      const cls = registration?.class_id
        ? classById.get(registration.class_id)
        : undefined
      const squad = squadById.get(member.squad_id)
      const scorecard = scorecardByMember.get(member.id)
      const score = Number(scorecard?.total_score ?? 0)
      const targets = Number(scorecard?.total_targets ?? 0)
      return {
        memberId: member.id,
        registrationId: registration?.id ?? "",
        athleteName: athleteName(athlete),
        teamId: registration?.team_id ?? null,
        teamName: team?.name ?? "No Team",
        classCode: cls?.code ?? "—",
        squadId: member.squad_id,
        squadNumber: squad?.squad_number ?? "—",
        postLabel: member.position_label ?? `Post ${member.position}`,
        score,
        targets,
        percentage: targets > 0 ? (score / targets) * 100 : 0,
        status: scorecardStatus(scorecard),
        updatedAt: scorecard?.updated_at ?? null,
        tied: false,
      }
    })
    .sort((left, right) => {
      const statusRank = { finalized: 0, draft: 1, missing: 2 }
      const rankDifference = statusRank[left.status] - statusRank[right.status]
      if (rankDifference !== 0) return rankDifference
      if (right.score !== left.score) return right.score - left.score
      return left.athleteName.localeCompare(right.athleteName)
    })

  rows = applyTieFlags(rows)

  const teamGroups = new Map<string, DigitalLeaderboardRow[]>()
  for (const row of rows.filter((item) => item.status === "finalized" && item.teamId)) {
    const current = teamGroups.get(row.teamId as string) ?? []
    current.push(row)
    teamGroups.set(row.teamId as string, current)
  }

  let teamStandings: DigitalTeamStanding[] = Array.from(teamGroups.entries())
    .map(([teamId, members]) => {
      const sorted = [...members].sort((a, b) => b.score - a.score)
      const counted = sorted.slice(0, 5)
      return {
        teamId,
        teamName: counted[0]?.teamName ?? "Unknown Team",
        athleteCount: members.length,
        countedAthletes: counted.length,
        score: counted.reduce((sum, row) => sum + row.score, 0),
        targets: counted.reduce((sum, row) => sum + row.targets, 0),
        tied: false,
      }
    })
    .sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName))

  teamStandings = applyTieFlags(teamStandings)

  const squadProgress: DigitalSquadProgress[] = source.squads
    .filter((squad) => squad.shoot_id === selectedShootId)
    .map((squad) => {
      const squadRows = rows.filter((row) => row.squadId === squad.id)
      const started = squadRows.filter((row) => row.status !== "missing").length
      const finalized = squadRows.filter((row) => row.status === "finalized").length
      return {
        squadId: squad.id,
        squadNumber: squad.squad_number,
        members: squadRows.length,
        started,
        finalized,
        missing: Math.max(0, squadRows.length - started),
        completionPercent:
          squadRows.length > 0 ? Math.round((finalized / squadRows.length) * 100) : 0,
      }
    })
    .sort((a, b) =>
      a.squadNumber.localeCompare(b.squadNumber, undefined, { numeric: true }),
    )

  const drafts = rows.filter((row) => row.status === "draft").length
  const finalized = rows.filter((row) => row.status === "finalized").length
  const expected = rows.length
  const lastScoreAt = rows
    .map((row) => row.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null

  return {
    source,
    selectedShootId,
    rows,
    teamStandings,
    squadProgress,
    totals: {
      expected,
      missing: rows.filter((row) => row.status === "missing").length,
      drafts,
      finalized,
      completionPercent: expected > 0 ? Math.round((finalized / expected) * 100) : 0,
      lastScoreAt,
    },
  }
}
