import { loadSeasonStandings, type SeasonEventContribution } from "@/lib/services/seasonStandings"
import { updateSeasonQualificationSettings } from "@/lib/services/seasons"

export type QualificationStatus =
  | "qualified"
  | "on_track"
  | "at_risk"
  | "not_qualified"
  | "tracking_disabled"

export type QualificationEventAudit = {
  eventId: string
  eventName: string
  startDate: string | null
  state: "complete" | "incomplete" | "not_entered"
  countsTowardQualification: boolean
  score: number
  targets: number
  percentage: number
}

export type SeasonQualificationRow = {
  athleteId: string
  athleteName: string
  cyssaNumber: string | null
  teamName: string
  classCode: string
  status: QualificationStatus
  completedEvents: number
  minimumEvents: number
  eventsNeeded: number
  availableEvents: number
  progressPercent: number
  incompleteEnteredEvents: number
  audits: QualificationEventAudit[]
}

export type SeasonQualificationData = {
  season: Awaited<ReturnType<typeof loadSeasonStandings>>["season"]
  events: Awaited<ReturnType<typeof loadSeasonStandings>>["events"]
  rows: SeasonQualificationRow[]
  totals: {
    athletes: number
    qualified: number
    onTrack: number
    atRisk: number
    notQualified: number
  }
}

function todayDateOnly() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function contributionMap(contributions: SeasonEventContribution[]) {
  return new Map(contributions.map((row) => [row.eventId, row]))
}

function isStillAvailable(startDate: string | null, completionPercent: number, today: string) {
  if (completionPercent < 100) return true
  if (!startDate) return true
  return startDate >= today
}

export async function loadSeasonQualification(seasonId: string): Promise<SeasonQualificationData> {
  const standings = await loadSeasonStandings(seasonId)
  const minimumEvents = Math.max(1, Number(standings.season.qualification_min_events || 1))
  const today = todayDateOnly()
  const summaryByEvent = new Map(standings.eventSummaries.map((row) => [row.eventId, row]))

  const rows: SeasonQualificationRow[] = standings.rows.map((standing) => {
    const byEvent = contributionMap(standing.contributions)
    const audits: QualificationEventAudit[] = standings.events.map((event) => {
      const contribution = byEvent.get(event.id)
      if (!contribution) {
        return {
          eventId: event.id,
          eventName: event.name,
          startDate: event.start_date,
          state: "not_entered",
          countsTowardQualification: false,
          score: 0,
          targets: 0,
          percentage: 0,
        }
      }
      return {
        eventId: event.id,
        eventName: event.name,
        startDate: event.start_date,
        state: contribution.complete ? "complete" : "incomplete",
        countsTowardQualification: contribution.complete,
        score: contribution.score,
        targets: contribution.targets,
        percentage: contribution.percentage,
      }
    })

    const completedEvents = audits.filter((audit) => audit.countsTowardQualification).length
    const incompleteEnteredEvents = audits.filter((audit) => audit.state === "incomplete").length
    const availableEvents = audits.filter((audit) => {
      if (audit.countsTowardQualification) return false
      const summary = summaryByEvent.get(audit.eventId)
      return isStillAvailable(audit.startDate, summary?.completionPercent ?? 0, today)
    }).length
    const eventsNeeded = Math.max(0, minimumEvents - completedEvents)

    let status: QualificationStatus
    if (!standings.season.qualification_enabled) {
      status = "tracking_disabled"
    } else if (completedEvents >= minimumEvents) {
      status = "qualified"
    } else if (
      standings.season.status === "closed" ||
      standings.season.status === "archived" ||
      completedEvents + availableEvents < minimumEvents
    ) {
      status = "not_qualified"
    } else if (
      eventsNeeded >= availableEvents ||
      (incompleteEnteredEvents > 0 && eventsNeeded >= Math.max(1, Math.ceil(availableEvents / 2)))
    ) {
      status = "at_risk"
    } else {
      status = "on_track"
    }

    return {
      athleteId: standing.athleteId,
      athleteName: standing.athleteName,
      cyssaNumber: standing.cyssaNumber,
      teamName: standing.teamName,
      classCode: standing.classCode,
      status,
      completedEvents,
      minimumEvents,
      eventsNeeded,
      availableEvents,
      progressPercent: Math.min(100, Math.round((completedEvents / minimumEvents) * 100)),
      incompleteEnteredEvents,
      audits,
    }
  })

  const priority: Record<QualificationStatus, number> = {
    not_qualified: 0,
    at_risk: 1,
    on_track: 2,
    qualified: 3,
    tracking_disabled: 4,
  }
  rows.sort((left, right) =>
    priority[left.status] - priority[right.status] ||
    right.completedEvents - left.completedEvents ||
    left.athleteName.localeCompare(right.athleteName),
  )

  return {
    season: standings.season,
    events: standings.events,
    rows,
    totals: {
      athletes: rows.length,
      qualified: rows.filter((row) => row.status === "qualified").length,
      onTrack: rows.filter((row) => row.status === "on_track").length,
      atRisk: rows.filter((row) => row.status === "at_risk").length,
      notQualified: rows.filter((row) => row.status === "not_qualified").length,
    },
  }
}

export async function saveSeasonQualificationSettings(input: {
  seasonId: string
  enabled: boolean
  minEvents: number
  notes: string
}) {
  return updateSeasonQualificationSettings(input)
}
