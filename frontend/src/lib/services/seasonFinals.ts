import { supabase } from "@/lib/supabase"
import { loadSeasonQualification, type SeasonQualificationData } from "@/lib/services/seasonQualification"
import { loadSeasonStandings, type SeasonStandingRow, type SeasonStandingsData } from "@/lib/services/seasonStandings"
import { loadSeasonTeamRankings, type SeasonTeamRankingRow, type SeasonTeamRankingsData } from "@/lib/services/seasonTeamRankings"
import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"

export type FrozenSeasonStandingRow = SeasonStandingRow & { rank: number }

export type SeasonFinalRecord = {
  id: string
  organization_id: string
  season_id: string
  season_name: string
  season_start_date: string
  season_end_date: string
  scoring_rule: string
  individual_standings: FrozenSeasonStandingRow[]
  team_standings: SeasonTeamRankingRow[]
  qualification_snapshot: {
    enabled: boolean
    minimumEvents: number
    notes: string | null
    totals: SeasonQualificationData["totals"]
    rows: SeasonQualificationData["rows"]
  }
  event_snapshot: SeasonStandingsData["eventSummaries"]
  summary: {
    events: number
    athletes: number
    teams: number
    completedResults: number
    incompleteResults: number
    unavailableEvents: number
    individualChampions: string[]
    teamChampions: string[]
  }
  finalized_at: string
  finalized_by: string | null
  created_at: string
}

export type SeasonFinalsDraft = {
  mode: "draft"
  standings: SeasonStandingsData
  teams: SeasonTeamRankingsData
  qualification: SeasonQualificationData
  individualRows: FrozenSeasonStandingRow[]
  individualChampions: FrozenSeasonStandingRow[]
  teamChampions: SeasonTeamRankingRow[]
  unavailableEvents: number
  readyToFinalize: boolean
  blockers: string[]
}

export type SeasonFinalsFrozen = {
  mode: "finalized"
  record: SeasonFinalRecord
}

export type SeasonFinalsData = SeasonFinalsDraft | SeasonFinalsFrozen

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 0.0001
}

function withRanks(rows: SeasonStandingRow[]): FrozenSeasonStandingRow[] {
  let lastRank = 0
  let lastPoints: number | null = null

  return rows.map((row, index) => {
    if (lastPoints === null || !sameNumber(lastPoints, row.seasonPoints)) {
      lastRank = index + 1
    }
    lastPoints = row.seasonPoints
    return { ...row, rank: lastRank }
  })
}

async function findFinalRecord(seasonId: string): Promise<SeasonFinalRecord | null> {
  const { organizationId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("season_final_records")
    .select("id,organization_id,season_id,season_name,season_start_date,season_end_date,scoring_rule,individual_standings,team_standings,qualification_snapshot,event_snapshot,summary,finalized_at,finalized_by,created_at")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? (data as SeasonFinalRecord) : null
}

export async function loadSeasonFinals(seasonId: string): Promise<SeasonFinalsData> {
  const existing = await findFinalRecord(seasonId)
  if (existing) return { mode: "finalized", record: existing }

  const [standings, teams, qualification] = await Promise.all([
    loadSeasonStandings(seasonId),
    loadSeasonTeamRankings(seasonId),
    loadSeasonQualification(seasonId),
  ])

  const individualRows = withRanks(standings.rows)
  const individualChampions = individualRows.filter((row) => row.rank === 1 && row.eventsCounted > 0)
  const teamChampions = teams.rows.filter((row) => row.rank === 1 && row.athletesCounted > 0)
  const unavailableEvents = standings.eventSummaries.filter((row) => !row.available).length
  const blockers: string[] = []

  if (standings.events.length === 0) blockers.push("No tournaments are assigned to this season.")
  if (standings.totals.incompleteResults > 0) {
    blockers.push(`${standings.totals.incompleteResults} athlete-event result${standings.totals.incompleteResults === 1 ? " is" : "s are"} incomplete.`)
  }
  if (unavailableEvents > 0) {
    blockers.push(`${unavailableEvents} event${unavailableEvents === 1 ? " has" : "s have"} unavailable scoring data.`)
  }
  if (individualRows.length === 0) blockers.push("No athlete season results are available.")

  return {
    mode: "draft",
    standings,
    teams,
    qualification,
    individualRows,
    individualChampions,
    teamChampions,
    unavailableEvents,
    readyToFinalize: blockers.length === 0,
    blockers,
  }
}

export async function finalizeSeason(input: { seasonId: string; draft: SeasonFinalsDraft }) {
  const { role } = await getCurrentOrganizationContext()
  if (role !== "owner" && role !== "admin") {
    throw new Error(`Your organization role is '${role}'. Only an owner or administrator can finalize a season.`)
  }
  if (!input.draft.readyToFinalize) {
    throw new Error("The season is not ready to finalize. Resolve the listed blockers first.")
  }

  const summary: SeasonFinalRecord["summary"] = {
    events: input.draft.standings.totals.events,
    athletes: input.draft.standings.totals.athletes,
    teams: input.draft.teams.totals.teams,
    completedResults: input.draft.standings.totals.completedResults,
    incompleteResults: input.draft.standings.totals.incompleteResults,
    unavailableEvents: input.draft.unavailableEvents,
    individualChampions: input.draft.individualChampions.map((row) => row.athleteName),
    teamChampions: input.draft.teamChampions.map((row) => row.teamName),
  }

  const qualificationEnabled = input.draft.qualification.season.qualification_enabled
  const minimumEvents = input.draft.qualification.season.qualification_min_events
  const finalQualificationRows = input.draft.qualification.rows.map((row) => ({
    ...row,
    status: qualificationEnabled
      ? row.completedEvents >= minimumEvents
        ? ("qualified" as const)
        : ("not_qualified" as const)
      : ("tracking_disabled" as const),
    eventsNeeded: Math.max(0, minimumEvents - row.completedEvents),
    availableEvents: 0,
  }))

  const qualificationSnapshot: SeasonFinalRecord["qualification_snapshot"] = {
    enabled: qualificationEnabled,
    minimumEvents,
    notes: input.draft.qualification.season.qualification_notes,
    totals: {
      athletes: finalQualificationRows.length,
      qualified: finalQualificationRows.filter((row) => row.status === "qualified").length,
      onTrack: 0,
      atRisk: 0,
      notQualified: finalQualificationRows.filter((row) => row.status === "not_qualified").length,
    },
    rows: finalQualificationRows,
  }

  const { data, error } = await supabase.rpc("finalize_season_records", {
    p_season_id: input.seasonId,
    p_scoring_rule: input.draft.teams.scoringRule,
    p_individual_standings: input.draft.individualRows,
    p_team_standings: input.draft.teams.rows,
    p_qualification_snapshot: qualificationSnapshot,
    p_event_snapshot: input.draft.standings.eventSummaries,
    p_summary: summary,
  })

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Season finalization completed without returning a record ID.")
  return String(data)
}

function csvCell(value: unknown) {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

export function buildSeasonFinalCsv(record: SeasonFinalRecord) {
  const lines: string[] = []
  lines.push(["ClayKeeper Season Final Report"].map(csvCell).join(","))
  lines.push(["Season", record.season_name].map(csvCell).join(","))
  lines.push(["Dates", `${record.season_start_date} through ${record.season_end_date}`].map(csvCell).join(","))
  lines.push(["Finalized", record.finalized_at].map(csvCell).join(","))
  lines.push("")
  lines.push(["Individual Standings"].map(csvCell).join(","))
  lines.push(["Rank", "Athlete", "CYSSA", "Team", "Class", "Events Counted", "Season Points", "Average %"].map(csvCell).join(","))
  for (const row of record.individual_standings) {
    lines.push([
      row.rank,
      row.athleteName,
      row.cyssaNumber ?? "",
      row.teamName,
      row.classCode,
      row.eventsCounted,
      row.seasonPoints.toFixed(2),
      row.averagePercentage.toFixed(2),
    ].map(csvCell).join(","))
  }
  lines.push("")
  lines.push(["Team Standings"].map(csvCell).join(","))
  lines.push(["Rank", "Team", "Athletes Counted", "Events Represented", "Season Points", "Aggregate %"].map(csvCell).join(","))
  for (const row of record.team_standings) {
    lines.push([
      row.rank,
      row.teamName,
      row.athletesCounted,
      row.eventsRepresented,
      row.seasonPoints.toFixed(2),
      row.aggregatePercentage.toFixed(2),
    ].map(csvCell).join(","))
  }
  return lines.join("\n")
}
