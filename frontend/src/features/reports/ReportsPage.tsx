import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AlertCircle, ArrowLeft, BarChart3, CheckCircle2, DollarSign, Download, Medal, Printer, RefreshCw, Trophy, Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadReportBaseData,
  loadShootReportData,
  type ReportAthlete,
  type ReportClass,
  type ReportEnrollment,
  type ReportEvent,
  type ReportMember,
  type ReportNamedRecord,
  type ReportRegistration,
  type ReportScore,
  type ReportShoot,
  type ReportShootOffRound,
  type ReportShootOffScore,
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
  registrations: [], enrollments: [], athletes: [], teams: [], classes: [], squads: [], members: [], scores: [], shootOffRounds: [], shootOffScores: [],
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
  const [data, setData] = useState<ReportData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const eventShoots = useMemo(() => shoots.filter((shoot) => shoot.event_id === eventId), [shoots, eventId])
  const selectedShoot = shoots.find((shoot) => shoot.id === shootId)

  async function loadBase() {
    setLoading(true)
    setError("")
    try {
      const base = await loadReportBaseData()
      setOrganizationId(base.organizationId)
      setEvents(base.events)
      setShoots(base.shoots)
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
          total: enrollment.historical_total_score ?? roundScores.reduce<number>((sum, score) => sum + (score ?? 0), 0),
          enteredRounds,
          complete: enrollment.historical_total_score !== null || (rounds > 0 && enteredRounds === rounds),
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
              <Button variant="outline" onClick={() => window.print()}><Printer />Print</Button>
              <Button onClick={exportCsv} disabled={!filteredStandings.length}><Download />CSV</Button>
            </div>
          </section>

          {error ? <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Reports could not load.</strong><p>{error}</p></div></div> : null}

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

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div><h2 className="text-lg font-semibold">Individual Standings</h2><p className="text-sm text-slate-500">{selectedShoot ? `${selectedShoot.name} · ${selectedShoot.targets_per_round} targets per round · ${selectedShoot.number_of_rounds} rounds` : "Select a shoot"}</p></div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <input className="w-56 rounded-lg border px-3 py-2 text-sm" placeholder="Search participant, team…" value={search} onChange={(event) => setSearch(event.target.value)} />
                <select className="rounded-lg border bg-white px-3 py-2 text-sm" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="all">All classes</option>{data.classes.map((cls) => <option key={cls.id} value={cls.code}>{cls.display_name}</option>)}</select>
                <select className="rounded-lg border bg-white px-3 py-2 text-sm" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">All teams</option>{Array.from(new Set(standings.map((row) => row.teamName).filter((name) => name !== "No team"))).sort().map((name) => <option key={name} value={name}>{name}</option>)}</select><select className="rounded-lg border bg-white px-3 py-2 text-sm" value={completionFilter} onChange={(event) => setCompletionFilter(event.target.value)}><option value="all">All scorecards</option><option value="complete">Complete only</option><option value="incomplete">Incomplete only</option></select>
              </div>
            </header>
            {loading ? <div className="p-12 text-center text-slate-500">Loading report data…</div> : filteredStandings.length === 0 ? <div className="p-12 text-center"><Trophy className="mx-auto mb-3 h-10 w-10 text-slate-300" /><h3 className="font-semibold">No standings are available yet</h3><p className="mt-1 text-sm text-slate-500">Register participants, assign squads, and enter scores to populate this report.</p></div> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-center">Place</th><th className="px-4 py-3">Participant</th><th className="px-3 py-3">Team</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Squad / Post</th>{Array.from({ length: selectedShoot?.number_of_rounds ?? 0 }, (_, index) => <th key={index} className="px-2 py-3 text-center">R{index + 1}</th>)}<th className="px-3 py-3 text-center">Total</th>{data.shootOffRounds.map((round) => <th key={round.id} className="px-2 py-3 text-center">{round.label || `SO${round.round_number}`}</th>)}<th className="px-3 py-3 text-center">Status</th></tr></thead><tbody>{filteredStandings.map((row, index) => <tr key={row.enrollmentId} className="border-t"><td className="px-4 py-3 text-center font-semibold">{index + 1}</td><td className="px-4 py-3"><div className="font-semibold">{row.athleteName}</div><div className="text-xs text-slate-500">{row.cyssaNumber ? `CYSSA ${row.cyssaNumber}` : "No CYSSA number"}</div></td><td className="px-3 py-3">{row.teamName}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{row.classCode}</span></td><td className="px-3 py-3"><div>{row.squadLabel}</div><div className="text-xs text-slate-500">{row.positionLabel}</div></td>{row.rounds.map((score, roundIndex) => <td key={roundIndex} className="px-2 py-3 text-center font-medium">{score ?? "—"}</td>)}<td className="px-3 py-3 text-center text-lg font-bold">{row.total}</td>{row.shootOffs.map((score, scoreIndex) => <td key={scoreIndex} className="px-2 py-3 text-center font-semibold text-amber-700">{score ?? "—"}</td>)}<td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.complete ? "Complete" : `${row.enteredRounds}/${selectedShoot?.number_of_rounds ?? 0}`}</span></td></tr>)}</tbody></table></div>
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

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string | number }) {
  return <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"><div className="rounded-lg bg-slate-100 p-2"><Icon className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="text-xl font-bold">{value}</p></div></div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
}

function OperationalDetail({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 flex items-end justify-between gap-2"><p className="text-xl font-bold">{value}</p><p className="text-xs text-slate-500">{detail}</p></div></div>
}
