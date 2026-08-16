import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, BarChart3, CheckCircle2, DollarSign, Download, Medal, Printer, RefreshCw, Trophy, Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadHistoricalReportData,
  loadReportBaseData,
  loadShootReportData,
  type ReportAthlete,
  type ReportClass,
  type HistoricalEnrollment,
  type HistoricalRegistration,
  type ReportEnrollment,
  type ReportEvent,
  type ReportMember,
  type ReportNamedRecord,
  type ReportRegistration,
  type ReportScore,
  type ReportShoot,
  type ReportShootOffRound,
  type ReportShootOffScore,
  type ReportDigitalScorecard,
  type ReportSquad,
} from "@/lib/services/reports"

type ReportData = {
  registrations: ReportRegistration[]
  enrollments: ReportEnrollment[]
  athletes: ReportAthlete[]
  teams: ReportNamedRecord[]
  classes: ReportClass[]
  squads: ReportSquad[]
  members: ReportMember[]
  scores: ReportScore[]
  shootOffRounds: ReportShootOffRound[]
  shootOffScores: ReportShootOffScore[]
  digitalScorecards: ReportDigitalScorecard[]
}


type HistoricalData = {
  registrations: HistoricalRegistration[]
  enrollments: HistoricalEnrollment[]
}

const emptyHistoricalData: HistoricalData = { registrations: [], enrollments: [] }

type StandingSortKey =
  | "place"
  | "participant"
  | "team"
  | "class"
  | "squad"
  | "total"
  | "status"
  | `round:${number}`
  | `shootOff:${number}`

type StandingColumnFilters = {
  participant: string
  team: string
  class: string
  squad: string
  total: string
  status: string
  rounds: Record<number, string>
  shootOffs: Record<number, string>
}

const EMPTY_STANDING_FILTERS: StandingColumnFilters = {
  participant: "",
  team: "",
  class: "",
  squad: "",
  total: "",
  status: "",
  rounds: {},
  shootOffs: {},
}

type StandingRow = {
  memberId: string | null
  enrollmentId: string
  athleteName: string
  cyssaNumber: string | null
  teamName: string
  classCode: string
  className: string
  squadLabel: string
  positionLabel: string
  rounds: Array<number | null>
  total: number
  enteredRounds: number
  complete: boolean
  shootOffs: Array<number | null>
}

const emptyData: ReportData = {
  registrations: [], enrollments: [], athletes: [], teams: [], classes: [], squads: [], members: [], scores: [], shootOffRounds: [], shootOffScores: [], digitalScorecards: [],
}

function athleteName(athlete: ReportAthlete | undefined) {
  if (!athlete) return "Unknown participant"
  const first = athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim() || "Unnamed participant"
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0)
}

function csvValue(value: string | number | null) {
  const text = value === null ? "" : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function ReportsPage() {
  const { eventId: routeEventId } = useParams()
  const [organizationId, setOrganizationId] = useState("")
  const [events, setEvents] = useState<ReportEvent[]>([])
  const [shoots, setShoots] = useState<ReportShoot[]>([])
  const [eventId, setEventId] = useState(routeEventId ?? "")
  const [shootId, setShootId] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")
  const [completionFilter, setCompletionFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [standingSortKey, setStandingSortKey] = useState<StandingSortKey>("place")
  const [standingSortDirection, setStandingSortDirection] = useState<"asc" | "desc">("asc")
  const [standingColumnFilters, setStandingColumnFilters] =
    useState<StandingColumnFilters>(EMPTY_STANDING_FILTERS)
  const [data, setData] = useState<ReportData>(emptyData)
  const [historicalData, setHistoricalData] = useState<HistoricalData>(emptyHistoricalData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const eventShoots = useMemo(() => shoots.filter((shoot) => shoot.event_id === eventId), [shoots, eventId])
  const selectedShoot = shoots.find((shoot) => shoot.id === shootId)
  const selectedEvent = events.find((event) => event.id === eventId)

  async function loadBase() {
    setLoading(true)
    setError("")
    try {
      const base = await loadReportBaseData()
      setOrganizationId(base.organizationId)
      setEvents(base.events)
      setShoots(base.shoots)
      setHistoricalData(await loadHistoricalReportData(base.organizationId))
      const nextEvent = routeEventId || eventId || base.events[0]?.id || ""
      const nextShoot = shootId || base.shoots.find((shoot) => shoot.event_id === nextEvent)?.id || ""
      setEventId(nextEvent)
      setShootId(nextShoot)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports.")
    } finally {
      setLoading(false)
    }
  }

  async function loadReport() {
    if (!organizationId || !eventId || !shootId) {
      setData(emptyData)
      return
    }
    setLoading(true)
    setError("")
    try {
      setData(await loadShootReportData(organizationId, eventId, shootId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load report data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadBase() }, [])
  useEffect(() => { void loadReport() }, [organizationId, eventId, shootId])

  const standings = useMemo<StandingRow[]>(() => {
    const registrationById = new Map(data.registrations.map((row) => [row.id, row]))
    const athleteById = new Map(data.athletes.map((row) => [row.id, row]))
    const teamById = new Map(data.teams.map((row) => [row.id, row]))
    const classById = new Map(data.classes.map((row) => [row.id, row]))
    const memberByEnrollmentId = new Map(data.members.map((row) => [row.registration_shoot_id, row]))
    const squadById = new Map(data.squads.map((row) => [row.id, row]))
    const scoreByKey = new Map(data.scores.map((row) => [`${row.squad_member_id}:${row.round_number}`, row]))
    const finalizedDigitalByMember = new Map(
      data.digitalScorecards
        .filter((scorecard) => scorecard.status === "finalized")
        .map((scorecard) => [scorecard.squad_member_id, scorecard]),
    )
    const shootOffByKey = new Map(data.shootOffScores.map((row) => [`${row.squad_member_id}:${row.shoot_off_round_id}`, row.score]))
    const rounds = selectedShoot?.number_of_rounds ?? 0

    return data.enrollments
      .filter((enrollment) => !["withdrawn", "cancelled"].includes(enrollment.status))
      .map((enrollment) => {
        const registration = registrationById.get(enrollment.registration_id)
        const athlete = athleteById.get(registration?.athlete_id || "")
        const team = teamById.get(registration?.team_id || "")
        const cls = classById.get(registration?.class_id || "")
        const member = memberByEnrollmentId.get(enrollment.id)
        const squad = member ? squadById.get(member.squad_id) : undefined
        const roundScores = Array.from({ length: rounds }, (_, index) => {
          if (!member) return null
          return scoreByKey.get(`${member.id}:${index + 1}`)?.score ?? null
        })
        const enteredRounds = roundScores.filter((score) => score !== null).length
        const digitalScorecard = member
          ? finalizedDigitalByMember.get(member.id)
          : undefined
        const historical = enrollment.historical_total_score !== null
        const digitalComplete = Boolean(
          digitalScorecard &&
          digitalScorecard.total_targets > 0,
        )
        const shootOffs = data.shootOffRounds.map((round) => member ? shootOffByKey.get(`${member.id}:${round.id}`) ?? null : null)
        return {
          memberId: member?.id || null,
          enrollmentId: enrollment.id,
          athleteName: athleteName(athlete),
          cyssaNumber: athlete?.cyssa_number || null,
          teamName: team?.name || "No team",
          classCode: cls?.code || "—",
          className: cls?.display_name || cls?.code || "No class",
          squadLabel: squad ? `Squad ${squad.squad_number}${squad.house_number ? ` · House ${squad.house_number}` : ""}${squad.course_name ? ` · ${squad.course_name}` : ""}` : "Unassigned",
          positionLabel: member?.position_label || (member ? `Post ${member.position}` : "—"),
          rounds: roundScores,
          total: historical
            ? enrollment.historical_total_score!
            : digitalComplete
              ? digitalScorecard!.total_score
              : roundScores.reduce<number>((sum, score) => sum + (score ?? 0), 0),
          enteredRounds,
          complete:
            historical ||
            digitalComplete ||
            (rounds > 0 && enteredRounds === rounds),
          shootOffs,
        }
      })
      .sort((a, b) => b.total - a.total || b.shootOffs.reduce<number>((sum, score) => sum + (score ?? 0), 0) - a.shootOffs.reduce<number>((sum, score) => sum + (score ?? 0), 0) || a.athleteName.localeCompare(b.athleteName))
  }, [data, selectedShoot])

  const filteredStandings = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return standings.filter((row) => {
      if (classFilter !== "all" && row.classCode !== classFilter) return false
      if (teamFilter !== "all" && row.teamName !== teamFilter) return false
      if (completionFilter === "complete" && !row.complete) return false
      if (completionFilter === "incomplete" && row.complete) return false
      if (!needle) return true
      return [row.athleteName, row.cyssaNumber || "", row.teamName, row.classCode, row.className, row.squadLabel].some((value) => value.toLowerCase().includes(needle))
    })
  }, [standings, classFilter, teamFilter, completionFilter, search])

  const standingPlaceByEnrollment = useMemo(
    () =>
      new Map(
        standings.map((row, index) => [
          row.enrollmentId,
          index + 1,
        ]),
      ),
    [standings],
  )

  const visibleStandings = useMemo(() => {
    const matches = (value: unknown, filter: string) =>
      !filter.trim() ||
      String(value ?? "")
        .toLowerCase()
        .includes(filter.trim().toLowerCase())

    const rows = filteredStandings.filter((row) => {
      const squadPost = `${row.squadLabel} ${row.positionLabel}`
      const status = row.complete
        ? "Complete"
        : `${row.enteredRounds}/${selectedShoot?.number_of_rounds ?? 0}`

      if (!matches(row.athleteName, standingColumnFilters.participant)) return false
      if (!matches(row.teamName, standingColumnFilters.team)) return false
      if (!matches(`${row.classCode} ${row.className}`, standingColumnFilters.class)) return false
      if (!matches(squadPost, standingColumnFilters.squad)) return false
      if (!matches(row.total, standingColumnFilters.total)) return false
      if (!matches(status, standingColumnFilters.status)) return false

      for (const [indexText, filter] of Object.entries(standingColumnFilters.rounds)) {
        const index = Number(indexText)
        if (!matches(row.rounds[index] ?? "", filter)) return false
      }

      for (const [indexText, filter] of Object.entries(standingColumnFilters.shootOffs)) {
        const index = Number(indexText)
        if (!matches(row.shootOffs[index] ?? "", filter)) return false
      }

      return true
    })

    const valueFor = (row: StandingRow): string | number => {
      if (standingSortKey === "place") {
        return standingPlaceByEnrollment.get(row.enrollmentId) ?? Number.MAX_SAFE_INTEGER
      }
      if (standingSortKey === "participant") return row.athleteName
      if (standingSortKey === "team") return row.teamName
      if (standingSortKey === "class") return row.classCode
      if (standingSortKey === "squad") return `${row.squadLabel} ${row.positionLabel}`
      if (standingSortKey === "total") return row.total
      if (standingSortKey === "status") return row.complete ? 1 : 0

      if (standingSortKey.startsWith("round:")) {
        const index = Number(standingSortKey.split(":")[1])
        return row.rounds[index] ?? -1
      }

      const index = Number(standingSortKey.split(":")[1])
      return row.shootOffs[index] ?? -1
    }

    return [...rows].sort((left, right) => {
      const leftValue = valueFor(left)
      const rightValue = valueFor(right)

      let result: number
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        result = leftValue - rightValue
      } else {
        result = String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      }

      if (result === 0) {
        result = (
          standingPlaceByEnrollment.get(left.enrollmentId) ?? 0
        ) - (
          standingPlaceByEnrollment.get(right.enrollmentId) ?? 0
        )
      }

      return standingSortDirection === "asc" ? result : -result
    })
  }, [
    filteredStandings,
    selectedShoot,
    standingColumnFilters,
    standingPlaceByEnrollment,
    standingSortDirection,
    standingSortKey,
  ])

  function toggleStandingSort(key: StandingSortKey) {
    if (standingSortKey === key) {
      setStandingSortDirection((current) =>
        current === "asc" ? "desc" : "asc",
      )
      return
    }

    setStandingSortKey(key)
    setStandingSortDirection("asc")
  }

  function updateStandingFilter(
    key: "participant" | "team" | "class" | "squad" | "total" | "status",
    value: string,
  ) {
    setStandingColumnFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function updateStandingRoundFilter(index: number, value: string) {
    setStandingColumnFilters((current) => ({
      ...current,
      rounds: {
        ...current.rounds,
        [index]: value,
      },
    }))
  }

  function updateStandingShootOffFilter(index: number, value: string) {
    setStandingColumnFilters((current) => ({
      ...current,
      shootOffs: {
        ...current.shootOffs,
        [index]: value,
      },
    }))
  }

  const standingFiltersActive =
    standingColumnFilters.participant ||
    standingColumnFilters.team ||
    standingColumnFilters.class ||
    standingColumnFilters.squad ||
    standingColumnFilters.total ||
    standingColumnFilters.status ||
    Object.values(standingColumnFilters.rounds).some(Boolean) ||
    Object.values(standingColumnFilters.shootOffs).some(Boolean)

  const completeCount = standings.filter((row) => row.complete).length
  const enteredScoreCount = standings.reduce((sum, row) => sum + row.enteredRounds, 0)
  const expectedScoreCount = standings.length * (selectedShoot?.number_of_rounds ?? 0)
  const totalFees = data.enrollments.reduce((sum, enrollment) => sum + Number(enrollment.total_fee || 0), 0)
  const totalPaid = data.registrations.reduce((sum, registration) => sum + Number(registration.amount_paid || 0), 0)

  const performanceSummary = useMemo(() => {
    const completed = standings.filter((row) => row.complete)
    const scored = standings.filter((row) => row.enteredRounds > 0)
    const totals = completed.map((row) => row.total)
    const average = totals.length ? totals.reduce((sum, total) => sum + total, 0) / totals.length : 0
    const high = totals.length ? Math.max(...totals) : 0
    const low = totals.length ? Math.min(...totals) : 0
    const completionRate = standings.length ? (completed.length / standings.length) * 100 : 0
    const scoreEntryRate = expectedScoreCount ? (enteredScoreCount / expectedScoreCount) * 100 : 0
    return { completed: completed.length, scored: scored.length, average, high, low, completionRate, scoreEntryRate }
  }, [standings, enteredScoreCount, expectedScoreCount])

  const classPerformance = useMemo(() => {
    return data.classes.map((cls) => {
      const rows = standings.filter((row) => row.classCode === cls.code)
      const completed = rows.filter((row) => row.complete)
      const average = completed.length ? completed.reduce((sum, row) => sum + row.total, 0) / completed.length : 0
      return {
        id: cls.id,
        code: cls.code,
        name: cls.display_name,
        participants: rows.length,
        completed: completed.length,
        completionRate: rows.length ? (completed.length / rows.length) * 100 : 0,
        average,
        high: completed.length ? Math.max(...completed.map((row) => row.total)) : null,
      }
    }).filter((row) => row.participants > 0)
  }, [data.classes, standings])

  const squadPerformance = useMemo(() => {
    const grouped = new Map<string, StandingRow[]>()
    for (const row of standings) {
      grouped.set(row.squadLabel, [...(grouped.get(row.squadLabel) || []), row])
    }
    return Array.from(grouped.entries()).map(([squadLabel, rows]) => {
      const completed = rows.filter((row) => row.complete)
      const average = completed.length ? completed.reduce((sum, row) => sum + row.total, 0) / completed.length : 0
      return { squadLabel, participants: rows.length, completed: completed.length, average, high: completed.length ? Math.max(...completed.map((row) => row.total)) : null }
    }).sort((a, b) => b.average - a.average || a.squadLabel.localeCompare(b.squadLabel))
  }, [standings])

  const operationalSummary = useMemo(() => {
    const activeRegistrations = data.registrations.filter((row) => !["cancelled", "withdrawn"].includes(row.status))
    const checkedIn = activeRegistrations.filter((row) => row.checked_in).length
    const paid = activeRegistrations.filter((row) => row.payment_status === "paid").length
    const paymentReview = activeRegistrations.filter((row) => !["paid", "waived"].includes(row.payment_status || "")).length
    const assigned = standings.filter((row) => row.memberId !== null).length
    const unassigned = standings.length - assigned
    const started = standings.filter((row) => row.enteredRounds > 0).length
    const notStarted = standings.length - started
    const incomplete = standings.length - completeCount
    const draftEntries = data.scores.filter((row) => row.status !== "finalized").length
    const finalizedEntries = data.scores.filter((row) => row.status === "finalized").length
    const checkInRate = activeRegistrations.length ? (checkedIn / activeRegistrations.length) * 100 : 0
    const assignmentRate = standings.length ? (assigned / standings.length) * 100 : 0
    const completionRate = standings.length ? (completeCount / standings.length) * 100 : 0
    return { activeRegistrations: activeRegistrations.length, checkedIn, paid, paymentReview, assigned, unassigned, started, notStarted, incomplete, draftEntries, finalizedEntries, checkInRate, assignmentRate, completionRate }
  }, [data.registrations, data.scores, standings, completeCount])

  const operationalAlerts = useMemo(() => {
    const alerts: Array<{ label: string; detail: string; tone: "amber" | "red" }> = []
    if (operationalSummary.unassigned > 0) alerts.push({ label: "Squad assignments", detail: `${operationalSummary.unassigned} participant${operationalSummary.unassigned === 1 ? " is" : "s are"} not assigned to a squad.`, tone: "amber" })
    if (operationalSummary.paymentReview > 0) alerts.push({ label: "Payment review", detail: `${operationalSummary.paymentReview} registration${operationalSummary.paymentReview === 1 ? " needs" : "s need"} payment review.`, tone: "amber" })
    if (operationalSummary.incomplete > 0 && operationalSummary.started > 0) alerts.push({ label: "Scoring incomplete", detail: `${operationalSummary.incomplete} scorecard${operationalSummary.incomplete === 1 ? " remains" : "s remain"} incomplete.`, tone: "amber" })
    if (operationalSummary.draftEntries > 0) alerts.push({ label: "Draft scoring data", detail: `${operationalSummary.draftEntries} score entr${operationalSummary.draftEntries === 1 ? "y is" : "ies are"} still in draft status.`, tone: "amber" })
    if (operationalSummary.activeRegistrations > 0 && operationalSummary.checkedIn === 0) alerts.push({ label: "Check-in", detail: "No active registrations are checked in yet.", tone: "red" })
    return alerts
  }, [operationalSummary])

  const historicalAnalytics = useMemo(() => {
    const shootById = new Map(shoots.map((row) => [row.id, row]))
    const eventRows = events.map((event) => {
      const registrations = historicalData.registrations.filter((row) => row.event_id === event.id && !["cancelled", "withdrawn"].includes(row.status))
      const registrationIds = new Set(registrations.map((row) => row.id))
      const enrollments = historicalData.enrollments.filter((row) => registrationIds.has(row.registration_id) && !["cancelled", "withdrawn"].includes(row.status))
      const completedTotals = enrollments
        .filter((enrollment) => shootById.has(enrollment.shoot_id) && enrollment.historical_total_score !== null)
        .map((enrollment) => Number(enrollment.historical_total_score))
      const average = completedTotals.length ? completedTotals.reduce((sum, total) => sum + total, 0) / completedTotals.length : null
      const checkedIn = registrations.filter((row) => row.checked_in).length
      const paid = registrations.filter((row) => ["paid", "waived"].includes(row.payment_status || "")).length
      return {
        event,
        participants: registrations.length,
        enrollments: enrollments.length,
        completed: completedTotals.length,
        checkInRate: registrations.length ? (checkedIn / registrations.length) * 100 : 0,
        paymentRate: registrations.length ? (paid / registrations.length) * 100 : 0,
        average,
      }
    }).filter((row) => row.participants > 0 || row.enrollments > 0)
      .sort((a, b) => (b.event.start_date || "").localeCompare(a.event.start_date || ""))

    const selectedIndex = eventRows.findIndex((row) => row.event.id === eventId)
    const selected = selectedIndex >= 0 ? eventRows[selectedIndex] : null
    const previous = selectedIndex >= 0 ? eventRows[selectedIndex + 1] || null : null
    return { eventRows, selected, previous }
  }, [historicalData, events, shoots, eventId])

  const classTrends = useMemo(() => {
    const classById = new Map(data.classes.map((row) => [row.id, row]))
    const counts = new Map<string, number>()
    for (const registration of historicalData.registrations) {
      if (["cancelled", "withdrawn"].includes(registration.status)) continue
      const cls = classById.get(registration.class_id || "")
      if (!cls) continue
      counts.set(cls.display_name, (counts.get(cls.display_name) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, participants]) => ({ name, participants })).sort((a, b) => b.participants - a.participants).slice(0, 8)
  }, [historicalData.registrations, data.classes])

  const teamStandings = useMemo(() => {
    const grouped = new Map<string, StandingRow[]>()
    for (const row of standings) {
      if (row.teamName === "No team") continue
      grouped.set(row.teamName, [...(grouped.get(row.teamName) || []), row])
    }
    return Array.from(grouped.entries()).map(([teamName, rows]) => {
      const sorted = [...rows].sort((a, b) => b.total - a.total)
      const discipline = selectedShoot?.discipline?.toLowerCase() || ""
      const count = discipline.includes("trap") ? 5 : 3
      const scoringRows = sorted.slice(0, count)
      return { teamName, participants: rows.length, scoringCount: scoringRows.length, total: scoringRows.reduce((sum, row) => sum + row.total, 0) }
    }).sort((a, b) => b.total - a.total || a.teamName.localeCompare(b.teamName))
  }, [standings, selectedShoot])

  function downloadCsv(filename: string, rows: Array<Array<string | number | null>>) {
    const blob = new Blob([rows.map((row) => row.map(csvValue).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function exportDirectorSummary() {
    if (!selectedShoot) return
    const eventName = selectedEvent?.name || "Event"
    const eventDates = [selectedEvent?.start_date, selectedEvent?.end_date].filter(Boolean).join(" to ") || "Date not set"
    const status = performanceSummary.completed < standings.length ? "PROVISIONAL" : "FINAL"
    const rows: Array<Array<string | number | null>> = [
      ["ClayKeeper Director Report"],
      ["Event", eventName],
      ["Event dates", eventDates],
      ["Shoot", selectedShoot.name],
      ["Report status", status],
      [],
      ["Operational Summary"],
      ["Active registrations", operationalSummary.activeRegistrations],
      ["Checked in", operationalSummary.checkedIn],
      ["Check-in rate", `${operationalSummary.checkInRate.toFixed(0)}%`],
      ["Squad assigned", operationalSummary.assigned],
      ["Unassigned", operationalSummary.unassigned],
      ["Payment review", operationalSummary.paymentReview],
      ["Scorecards complete", completeCount],
      ["Scorecards incomplete", operationalSummary.incomplete],
      ["Draft score entries", operationalSummary.draftEntries],
      ["Finalized score entries", operationalSummary.finalizedEntries],
      [],
      ["Performance Summary"],
      ["Completion rate", `${performanceSummary.completionRate.toFixed(0)}%`],
      ["Score-entry rate", `${performanceSummary.scoreEntryRate.toFixed(0)}%`],
      ["Average completed total", performanceSummary.completed ? performanceSummary.average.toFixed(1) : null],
      ["High completed total", performanceSummary.completed ? performanceSummary.high : null],
      ["Low completed total", performanceSummary.completed ? performanceSummary.low : null],
      [],
      ["Financial Summary"],
      ["Shoot fees", money(totalFees)],
      ["Amount paid", money(totalPaid)],
      [],
      ["Current Alerts"],
      ...(operationalAlerts.length ? operationalAlerts.map((alert) => [alert.label, alert.detail]) : [["Status", "No current operational warnings detected."]]),
    ]
    downloadCsv(`${eventName}-${selectedShoot.name}-director-report`.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".csv", rows)
  }

  function exportCsv() {
    if (!selectedShoot) return
    const headers = ["Place", "Participant", "CYSSA #", "Team", "Class", "Squad", "Position", ...Array.from({ length: selectedShoot.number_of_rounds }, (_, i) => `R${i + 1}`), "Total", ...data.shootOffRounds.map((round) => round.label || `SO${round.round_number}`), "Complete"]
    const lines = [headers.map(csvValue).join(",")]
    filteredStandings.forEach((row, index) => {
      lines.push([index + 1, row.athleteName, row.cyssaNumber, row.teamName, row.classCode, row.squadLabel, row.positionLabel, ...row.rounds, row.total, ...row.shootOffs, row.complete ? "Yes" : "No"].map(csvValue).join(","))
    })
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${selectedShoot.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-standings.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      <AppHeader title="Reports" description="View competition results, standings, and financial summaries" />
      <PageContainer>
        <div className="space-y-5">
          {routeEventId ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm print:hidden">
              <Link to={`/events/${routeEventId}/operations`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />Operations Center</Link>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Event-scoped reporting</span>
            </div>
          ) : null}
          <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_auto] print:hidden">
            <label className="space-y-1 text-sm font-medium">Event
              <select className="w-full rounded-lg border bg-white px-3 py-2" value={eventId} onChange={(event) => { const id = event.target.value; setEventId(id); setShootId(shoots.find((shoot) => shoot.event_id === id)?.id || "") }}>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Shoot
              <select className="w-full rounded-lg border bg-white px-3 py-2" value={shootId} onChange={(event) => setShootId(event.target.value)}>
                {eventShoots.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => void loadReport()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer />Print / PDF</Button>
              <Button variant="outline" onClick={exportDirectorSummary} disabled={!selectedShoot}><Download />Director CSV</Button>
              <Button onClick={exportCsv} disabled={!filteredStandings.length}><Download />Standings CSV</Button>
            </div>
          </section>

          {error ? <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Reports could not load.</strong><p>{error}</p></div></div> : null}

          <section className="rounded-2xl border bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">ClayKeeper Director Report</p>
                <h1 className="mt-1 text-2xl font-bold">{selectedEvent?.name || "Event Report"}</h1>
                <p className="mt-1 text-sm text-slate-600">{selectedShoot?.name || "Select a shoot"}{selectedEvent?.start_date ? ` · ${selectedEvent.start_date}${selectedEvent.end_date && selectedEvent.end_date !== selectedEvent.start_date ? ` to ${selectedEvent.end_date}` : ""}` : ""}</p>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${performanceSummary.completed < standings.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                {performanceSummary.completed < standings.length ? "PROVISIONAL" : "FINAL / COMPLETE"}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DirectorMetric label="Check-in" value={`${operationalSummary.checkInRate.toFixed(0)}%`} detail={`${operationalSummary.checkedIn}/${operationalSummary.activeRegistrations} active`} />
              <DirectorMetric label="Scoring" value={`${performanceSummary.completionRate.toFixed(0)}%`} detail={`${completeCount}/${standings.length} complete`} />
              <DirectorMetric label="Payment review" value={String(operationalSummary.paymentReview)} detail={`${operationalSummary.paid} paid/waived`} />
              <DirectorMetric label="Completed avg" value={performanceSummary.completed ? performanceSummary.average.toFixed(1) : "—"} detail={performanceSummary.completed < standings.length ? "Complete cards only" : "All completed cards"} />
            </div>
            {performanceSummary.completed < standings.length ? <p className="mt-3 text-xs text-amber-800"><strong>Provisional:</strong> incomplete scorecards are excluded from averages and high/low performance values.</p> : <p className="mt-3 text-xs text-emerald-800"><strong>Complete:</strong> all scorecards for the selected shoot are complete.</p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat icon={Users} label="Registered" value={standings.length} />
            <Stat icon={CheckCircle2} label="Completed" value={`${completeCount} / ${standings.length}`} />
            <Stat icon={BarChart3} label="Scores entered" value={`${enteredScoreCount} / ${expectedScoreCount}`} />
            <Stat icon={DollarSign} label="Shoot fees" value={money(totalFees)} />
            <Stat icon={DollarSign} label="Amount paid" value={money(totalPaid)} />
          </section>

          <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-5 w-5" />Operational Analytics</h2>
              <p className="text-sm text-slate-500">Registration, check-in, squad readiness, scoring workflow, and payment health for the selected shoot.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Check-in" value={`${operationalSummary.checkInRate.toFixed(0)}%`} detail={`${operationalSummary.checkedIn} of ${operationalSummary.activeRegistrations} active registrations`} />
              <Metric label="Squad ready" value={`${operationalSummary.assignmentRate.toFixed(0)}%`} detail={`${operationalSummary.assigned} assigned · ${operationalSummary.unassigned} unassigned`} />
              <Metric label="Scoring complete" value={`${operationalSummary.completionRate.toFixed(0)}%`} detail={`${completeCount} complete · ${operationalSummary.notStarted} not started`} />
              <Metric label="Payment ready" value={`${operationalSummary.paid} / ${operationalSummary.activeRegistrations}`} detail={`${operationalSummary.paymentReview} registration${operationalSummary.paymentReview === 1 ? "" : "s"} need review`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <OperationalDetail label="Checked in" value={operationalSummary.checkedIn} detail={`${operationalSummary.activeRegistrations - operationalSummary.checkedIn} outstanding`} />
              <OperationalDetail label="Scoring started" value={operationalSummary.started} detail={`${operationalSummary.notStarted} not started`} />
              <OperationalDetail label="Finalized entries" value={operationalSummary.finalizedEntries} detail={`${operationalSummary.draftEntries} draft entries`} />
              <OperationalDetail label="Incomplete cards" value={operationalSummary.incomplete} detail={`${completeCount} complete`} />
            </div>
            {operationalAlerts.length ? <div className="space-y-2">{operationalAlerts.map((alert) => <div key={alert.label} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${alert.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>{alert.label}:</strong> {alert.detail}</span></div>)}</div> : <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Operationally ready:</strong> no current registration, assignment, payment, or scoring workflow warnings were detected for this shoot.</span></div>}
          </section>

          <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 className="h-5 w-5" />Tournament Performance</h2>
              <p className="text-sm text-slate-500">Live performance metrics use completed scorecards for score averages and include incomplete data separately.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Completion" value={`${performanceSummary.completionRate.toFixed(0)}%`} detail={`${performanceSummary.completed} of ${standings.length} scorecards`} />
              <Metric label="Score entry" value={`${performanceSummary.scoreEntryRate.toFixed(0)}%`} detail={`${enteredScoreCount} of ${expectedScoreCount} rounds`} />
              <Metric label="Average total" value={performanceSummary.completed ? performanceSummary.average.toFixed(1) : "—"} detail="Completed scorecards only" />
              <Metric label="High / Low" value={performanceSummary.completed ? `${performanceSummary.high} / ${performanceSummary.low}` : "—"} detail={`${performanceSummary.scored} participants with scoring activity`} />
            </div>
            {performanceSummary.completed < standings.length ? <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Provisional analytics:</strong> {standings.length - performanceSummary.completed} scorecard{standings.length - performanceSummary.completed === 1 ? " is" : "s are"} incomplete. Averages and high/low totals exclude incomplete scorecards.</span></div> : null}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <header className="border-b px-5 py-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><Medal className="h-5 w-5" />Class Performance</h2><p className="text-sm text-slate-500">Participation, completion, and completed-score averages by class.</p></header>
              {classPerformance.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">Class</th><th className="px-3 py-3 text-center">Athletes</th><th className="px-3 py-3 text-center">Complete</th><th className="px-3 py-3 text-center">Avg</th><th className="px-3 py-3 text-center">High</th></tr></thead><tbody>{classPerformance.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-3"><div className="font-semibold">{row.name}</div><div className="text-xs text-slate-500">{row.code}</div></td><td className="px-3 py-3 text-center">{row.participants}</td><td className="px-3 py-3 text-center"><span className="font-semibold">{row.completed}/{row.participants}</span><div className="text-xs text-slate-500">{row.completionRate.toFixed(0)}%</div></td><td className="px-3 py-3 text-center font-semibold">{row.completed ? row.average.toFixed(1) : "—"}</td><td className="px-3 py-3 text-center font-semibold">{row.high ?? "—"}</td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-slate-500">No class participation is available for this shoot.</div>}
            </div>
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <header className="border-b px-5 py-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5" />Squad Performance</h2><p className="text-sm text-slate-500">Current squad completion and completed-score performance.</p></header>
              {squadPerformance.length ? <div className="divide-y">{squadPerformance.slice(0, 12).map((row) => <div key={row.squadLabel} className="flex items-center justify-between gap-4 px-5 py-3"><div><p className="font-semibold">{row.squadLabel}</p><p className="text-sm text-slate-500">{row.completed}/{row.participants} complete</p></div><div className="text-right"><p className="font-bold">{row.completed ? row.average.toFixed(1) : "—"} avg</p><p className="text-xs text-slate-500">High {row.high ?? "—"}</p></div></div>)}</div> : <div className="p-8 text-center text-sm text-slate-500">Assign participants to squads to calculate squad performance.</div>}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 className="h-5 w-5" />Historical & Comparative Analytics</h2>
              <p className="text-sm text-slate-500">Compare participation, operational readiness, and finalized historical performance across events.</p>
            </div>
            {historicalAnalytics.selected ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Event participation" value={String(historicalAnalytics.selected.participants)} detail={historicalAnalytics.previous ? `${historicalAnalytics.selected.participants - historicalAnalytics.previous.participants >= 0 ? "+" : ""}${historicalAnalytics.selected.participants - historicalAnalytics.previous.participants} vs previous event` : "No previous event to compare"} />
              <Metric label="Check-in rate" value={`${historicalAnalytics.selected.checkInRate.toFixed(0)}%`} detail={historicalAnalytics.previous ? `${(historicalAnalytics.selected.checkInRate - historicalAnalytics.previous.checkInRate).toFixed(0)} pts vs previous` : "Current event"} />
              <Metric label="Payment ready" value={`${historicalAnalytics.selected.paymentRate.toFixed(0)}%`} detail={historicalAnalytics.previous ? `${(historicalAnalytics.selected.paymentRate - historicalAnalytics.previous.paymentRate).toFixed(0)} pts vs previous` : "Paid or waived registrations"} />
              <Metric label="Historical avg" value={historicalAnalytics.selected.average !== null ? historicalAnalytics.selected.average.toFixed(1) : "—"} detail="Finalized/imported totals only" />
            </div> : null}
            <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
              <div className="overflow-hidden rounded-xl border">
                <div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-semibold">Event Comparison</h3><p className="text-xs text-slate-500">Most recent events with registration or shoot enrollment activity.</p></div>
                {historicalAnalytics.eventRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">Event</th><th className="px-3 py-3 text-center">Participants</th><th className="px-3 py-3 text-center">Check-in</th><th className="px-3 py-3 text-center">Payment</th><th className="px-3 py-3 text-center">Final totals</th><th className="px-3 py-3 text-center">Avg</th></tr></thead><tbody>{historicalAnalytics.eventRows.slice(0, 8).map((row) => <tr key={row.event.id} className={`border-t ${row.event.id === eventId ? "bg-emerald-50/60" : ""}`}><td className="px-4 py-3"><p className="font-semibold">{row.event.name}</p><p className="text-xs text-slate-500">{row.event.start_date || "Date not set"}</p></td><td className="px-3 py-3 text-center font-semibold">{row.participants}</td><td className="px-3 py-3 text-center">{row.checkInRate.toFixed(0)}%</td><td className="px-3 py-3 text-center">{row.paymentRate.toFixed(0)}%</td><td className="px-3 py-3 text-center">{row.completed}/{row.enrollments}</td><td className="px-3 py-3 text-center font-semibold">{row.average !== null ? row.average.toFixed(1) : "—"}</td></tr>)}</tbody></table></div> : <div className="p-6 text-center text-sm text-slate-500">Historical event data will appear as tournaments are recorded in ClayKeeper.</div>}
              </div>
              <div className="overflow-hidden rounded-xl border">
                <div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-semibold">Class Participation Trend</h3><p className="text-xs text-slate-500">Organization-wide active registrations by class.</p></div>
                {classTrends.length ? <div className="divide-y">{classTrends.map((row) => <div key={row.name} className="flex items-center justify-between gap-3 px-4 py-3"><span className="font-medium">{row.name}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{row.participants}</span></div>)}</div> : <div className="p-6 text-center text-sm text-slate-500">No class history is available yet.</div>}
              </div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800"><strong>Historical scoring note:</strong> score averages use finalized historical/imported totals when they are available. ClayKeeper does not infer a completed historical score from partial live score entries.</div>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div><h2 className="text-lg font-semibold">Individual Standings</h2><p className="text-sm text-slate-500">{selectedShoot ? `${selectedShoot.name} · ${selectedShoot.targets_per_round} targets per round · ${selectedShoot.number_of_rounds} rounds` : "Select a shoot"}</p></div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <input className="w-56 rounded-lg border px-3 py-2 text-sm" placeholder="Search participant, team…" value={search} onChange={(event) => setSearch(event.target.value)} />
                <select className="rounded-lg border bg-white px-3 py-2 text-sm" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="all">All classes</option>{data.classes.map((cls) => <option key={cls.id} value={cls.code}>{cls.display_name}</option>)}</select>
                <select className="rounded-lg border bg-white px-3 py-2 text-sm" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">All teams</option>{Array.from(new Set(standings.map((row) => row.teamName).filter((name) => name !== "No team"))).sort().map((name) => <option key={name} value={name}>{name}</option>)}</select><select className="rounded-lg border bg-white px-3 py-2 text-sm" value={completionFilter} onChange={(event) => setCompletionFilter(event.target.value)}><option value="all">All scorecards</option><option value="complete">Complete only</option><option value="incomplete">Incomplete only</option></select>
              </div>
            </header>
            {loading ? <div className="p-12 text-center text-slate-500">Loading report data…</div> : visibleStandings.length === 0 ? <div className="p-12 text-center"><Trophy className="mx-auto mb-3 h-10 w-10 text-slate-300" /><h3 className="font-semibold">No standings are available yet</h3><p className="mt-1 text-sm text-slate-500">Register participants, assign squads, and enter scores to populate this report.</p></div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <StandingSortableHeader label="Place" column="place" sortKey={standingSortKey} direction={standingSortDirection} onSort={toggleStandingSort} className="px-4 pt-3 text-center" />
                      <StandingSortableHeader label="Participant" column="participant" sortKey={standingSortKey} direction={standingSortDirection} onSort={toggleStandingSort} className="px-4 pt-3" />
                      <StandingSortableHeader label="Team" column="team" sortKey={standingSortKey} direction={standingSortDirection} onSort={toggleStandingSort} className="px-3 pt-3" />
                      <StandingSortableHeader label="Class" column="class" sortKey={standingSortKey} direction={standingSortDirection} onSort={toggleStandingSort} className="px-3 pt-3" />
                      <StandingSortableHeader label="Squad / Post" column="squad" sortKey={standingSortKey} direction={standingSortDirection} onSort={toggleStandingSort} className="px-3 pt-3" />

                      {Array.from(
                        { length: selectedShoot?.number_of_rounds ?? 0 },
                        (_, index) => (
                          <StandingSortableHeader
                            key={index}
                            label={`R${index + 1}`}
                            column={`round:${index}`}
                            sortKey={standingSortKey}
                            direction={standingSortDirection}
                            onSort={toggleStandingSort}
                            className="px-2 pt-3 text-center"
                          />
                        ),
                      )}

                      <StandingSortableHeader label="Total" column="total" sortKey={standingSortKey} direction={standingSortDirection} onSort={toggleStandingSort} className="px-3 pt-3 text-center" />

                      {data.shootOffRounds.map((round, index) => (
                        <StandingSortableHeader
                          key={round.id}
                          label={round.label || `SO${round.round_number}`}
                          column={`shootOff:${index}`}
                          sortKey={standingSortKey}
                          direction={standingSortDirection}
                          onSort={toggleStandingSort}
                          className="px-2 pt-3 text-center"
                        />
                      ))}

                      <StandingSortableHeader label="Status" column="status" sortKey={standingSortKey} direction={standingSortDirection} onSort={toggleStandingSort} className="px-3 pt-3 text-center" />
                    </tr>

                    <tr className="border-t border-slate-200 bg-white normal-case tracking-normal print:hidden">
                      <th className="px-4 py-2 text-center">
                        {standingFiltersActive ? (
                          <button
                            type="button"
                            onClick={() => setStandingColumnFilters(EMPTY_STANDING_FILTERS)}
                            className="whitespace-nowrap text-xs font-semibold text-slate-500 hover:text-slate-900"
                          >
                            Clear
                          </button>
                        ) : null}
                      </th>

                      <StandingFilterCell
                        value={standingColumnFilters.participant}
                        onChange={(value) => updateStandingFilter("participant", value)}
                        placeholder="Filter participant…"
                        className="px-4 py-2"
                      />
                      <StandingFilterCell value={standingColumnFilters.team} onChange={(value) => updateStandingFilter("team", value)} placeholder="Filter team…" />
                      <StandingFilterCell value={standingColumnFilters.class} onChange={(value) => updateStandingFilter("class", value)} placeholder="Filter class…" />
                      <StandingFilterCell value={standingColumnFilters.squad} onChange={(value) => updateStandingFilter("squad", value)} placeholder="Filter squad/post…" />

                      {Array.from(
                        { length: selectedShoot?.number_of_rounds ?? 0 },
                        (_, index) => (
                          <StandingFilterCell
                            key={index}
                            value={standingColumnFilters.rounds[index] ?? ""}
                            onChange={(value) => updateStandingRoundFilter(index, value)}
                            placeholder={`R${index + 1}`}
                            className="px-2 py-2"
                          />
                        ),
                      )}

                      <StandingFilterCell
                        value={standingColumnFilters.total}
                        onChange={(value) => updateStandingFilter("total", value)}
                        placeholder="Total"
                        className="px-2 py-2"
                      />

                      {data.shootOffRounds.map((round, index) => (
                        <StandingFilterCell
                          key={round.id}
                          value={standingColumnFilters.shootOffs[index] ?? ""}
                          onChange={(value) => updateStandingShootOffFilter(index, value)}
                          placeholder="SO"
                          className="px-2 py-2"
                        />
                      ))}

                      <StandingFilterCell
                        value={standingColumnFilters.status}
                        onChange={(value) => updateStandingFilter("status", value)}
                        placeholder="Status"
                        className="px-2 py-2"
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {visibleStandings.map((row) => (
                      <tr key={row.enrollmentId} className="border-t">
                        <td className="px-4 py-3 text-center font-semibold">
                          {standingPlaceByEnrollment.get(row.enrollmentId) ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{row.athleteName}</div>
                          <div className="text-xs text-slate-500">
                            {row.cyssaNumber ? `CYSSA ${row.cyssaNumber}` : "No CYSSA number"}
                          </div>
                        </td>
                        <td className="px-3 py-3">{row.teamName}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                            {row.classCode}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div>{row.squadLabel}</div>
                          <div className="text-xs text-slate-500">{row.positionLabel}</div>
                        </td>

                        {row.rounds.map((score, roundIndex) => (
                          <td key={roundIndex} className="px-2 py-3 text-center font-medium">
                            {score ?? "—"}
                          </td>
                        ))}

                        <td className="px-3 py-3 text-center text-lg font-bold">
                          {row.total}
                        </td>

                        {row.shootOffs.map((score, scoreIndex) => (
                          <td key={scoreIndex} className="px-2 py-3 text-center font-semibold text-amber-700">
                            {score ?? "—"}
                          </td>
                        ))}

                        <td className="px-3 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              row.complete
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {row.complete
                              ? "Complete"
                              : `${row.enteredRounds}/${selectedShoot?.number_of_rounds ?? 0}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><header className="border-b px-5 py-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><Medal className="h-5 w-5" />Class Leaders</h2><p className="text-sm text-slate-500">Highest current total in each competition class.</p></header><div className="divide-y">{data.classes.map((cls) => { const leaders = standings.filter((row) => row.classCode === cls.code); const leader = leaders[0]; return <div key={cls.id} className="flex items-center justify-between px-5 py-3"><div><p className="font-semibold">{cls.display_name}</p><p className="text-sm text-slate-500">{leader?.athleteName || "No participants"}</p></div><div className="text-right"><p className="text-xl font-bold">{leader?.total ?? "—"}</p><p className="text-xs text-slate-500">{leaders.length} participant{leaders.length === 1 ? "" : "s"}</p></div></div> })}</div></div>
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><header className="border-b px-5 py-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><Trophy className="h-5 w-5" />Team Standings</h2><p className="text-sm text-slate-500">Top {selectedShoot?.discipline?.toLowerCase().includes("trap") ? 5 : 3} participant totals per team.</p></header>{teamStandings.length ? <div className="divide-y">{teamStandings.slice(0, 10).map((team, index) => <div key={team.teamName} className="flex items-center justify-between px-5 py-3"><div className="flex items-center gap-3"><span className="w-7 text-center font-bold text-slate-400">{index + 1}</span><div><p className="font-semibold">{team.teamName}</p><p className="text-sm text-slate-500">{team.scoringCount} scoring · {team.participants} registered</p></div></div><p className="text-xl font-bold">{team.total}</p></div>)}</div> : <div className="p-10 text-center text-sm text-slate-500">Assign participants to teams to calculate team standings.</div>}</div>
          </section>
        </div>
      </PageContainer>
    </div>
  )
}

function StandingSortableHeader({
  label,
  column,
  sortKey,
  direction,
  onSort,
  className,
}: {
  label: string
  column: StandingSortKey
  sortKey: StandingSortKey
  direction: "asc" | "desc"
  onSort: (column: StandingSortKey) => void
  className: string
}) {
  const Icon =
    sortKey !== column
      ? ArrowUpDown
      : direction === "asc"
        ? ArrowUp
        : ArrowDown

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 whitespace-nowrap font-semibold hover:text-slate-900 print:pointer-events-none"
        title={`Sort by ${label}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5 print:hidden" />
      </button>
    </th>
  )
}

function StandingFilterCell({
  value,
  onChange,
  placeholder,
  className = "px-3 py-2",
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <th className={className}>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full min-w-16 rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
      />
    </th>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string | number }) {
  return <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"><div className="rounded-lg bg-slate-100 p-2"><Icon className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="text-xl font-bold">{value}</p></div></div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
}

function OperationalDetail({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 flex items-end justify-between gap-2"><p className="text-xl font-bold">{value}</p><p className="text-xs text-slate-500">{detail}</p></div></div>
}

function DirectorMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border bg-slate-50 p-3 print:bg-white"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="text-xs text-slate-500">{detail}</p></div>
}
