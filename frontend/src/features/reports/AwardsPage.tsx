import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { AlertTriangle, CheckCircle2, ChevronRight, Download, FileCheck2, Medal, Printer, RefreshCw, Save, Trophy, Tv, Users, XCircle } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { CLAYKEEPER_LOGO, useBrandSettings } from "@/lib/branding"
import { loadAwardAdministration, saveAwardPublication, type AwardPublication } from "@/lib/services/awards"
import {
  calculateSeriesTeamPoints,
  calculateSquads,
  calculateStateTeams,
  CYSSA_CLASSES,
  classAwardGroups,
  normalizeDiscipline,
  rankIndividuals,
  type AwardParticipant,
  type DisciplineKey,
  type MeetType,
  type SeriesShootTeam,
} from "@/lib/services/awardsEngine"
import { loadReportBaseData, loadShootReportData, type ReportAthlete, type ReportEvent, type ReportShoot } from "@/lib/services/reports"

type ReportPayload = Awaited<ReturnType<typeof loadShootReportData>>
type TabKey = "overall" | "individual" | "squad" | "stateTeam" | "seriesTeam"

function participantName(athlete?: ReportAthlete) {
  if (!athlete) return "Unknown participant"
  return `${athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""} ${athlete.last_name?.trim() || ""}`.trim() || "Unnamed participant"
}

function csvValue(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function buildRows(report: ReportPayload, shoot?: ReportShoot): AwardParticipant[] {
  const registrationById = new Map(report.registrations.map((row) => [row.id, row]))
  const athleteById = new Map(report.athletes.map((row) => [row.id, row]))
  const teamById = new Map(report.teams.map((row) => [row.id, row]))
  const classById = new Map(report.classes.map((row) => [row.id, row]))
  const memberByEnrollment = new Map(report.members.map((row) => [row.registration_shoot_id, row]))
  const squadById = new Map(report.squads.map((row) => [row.id, row]))
  const scoresByMember = new Map<string, typeof report.scores>()
  report.scores.forEach((score) => scoresByMember.set(score.squad_member_id, [...(scoresByMember.get(score.squad_member_id) || []), score]))
  const shootOffByKey = new Map(report.shootOffScores.map((score) => [`${score.squad_member_id}:${score.shoot_off_round_id}`, score.score]))

  return report.enrollments
    .filter((enrollment) => !["withdrawn", "cancelled"].includes(enrollment.status))
    .map((enrollment) => {
      const registration = registrationById.get(enrollment.registration_id)
      const athlete = athleteById.get(registration?.athlete_id || "")
      const member = memberByEnrollment.get(enrollment.id)
      const squad = member ? squadById.get(member.squad_id) : undefined
      const scores = member ? scoresByMember.get(member.id) || [] : []
      const entered = scores.filter((score) => score.score !== null).length
      return {
        enrollmentId: enrollment.id,
        memberId: member?.id,
        squadId: squad?.id,
        name: participantName(athlete),
        team: teamById.get(registration?.team_id || "")?.name || "No team",
        classCode: (classById.get(registration?.class_id || "")?.code || "Unclassified").toUpperCase(),
        squad: squad ? `Squad ${squad.squad_number}` : "Unassigned",
        total: enrollment.historical_total_score ?? scores.reduce((sum, score) => sum + (score.score ?? 0), 0),
        complete: enrollment.historical_total_score !== null || entered >= (shoot?.number_of_rounds || 0),
        shootOffs: member ? report.shootOffRounds.map((round) => shootOffByKey.get(`${member.id}:${round.id}`) ?? -1) : [],
      }
    })
}

function disciplineLabel(value: DisciplineKey) {
  if (value === "sporting_clays") return "Sporting Clays"
  return value === "skeet" ? "Skeet" : "Trap"
}

export function AwardsPage() {
  const navigate = useNavigate()
  const { eventId: routeEventId } = useParams()
  const brand = useBrandSettings()
  const [organizationId, setOrganizationId] = useState("")
  const [events, setEvents] = useState<ReportEvent[]>([])
  const [shoots, setShoots] = useState<ReportShoot[]>([])
  const [eventId, setEventId] = useState("")
  const [shootId, setShootId] = useState("")
  const [report, setReport] = useState<ReportPayload | null>(null)
  const [eventReports, setEventReports] = useState<SeriesShootTeam[]>([])
  const [publication, setPublication] = useState<AwardPublication | null>(null)
  const [meetType, setMeetType] = useState<MeetType>("series")
  const [overallPlaces, setOverallPlaces] = useState(2)
  const [classPlaces, setClassPlaces] = useState(3)
  const [tab, setTab] = useState<TabKey>("overall")
  const [tvMode, setTvMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const eventShoots = useMemo(() => shoots.filter((shoot) => shoot.event_id === eventId), [shoots, eventId])
  const selectedEvent = events.find((event) => event.id === eventId)
  const selectedShoot = shoots.find((shoot) => shoot.id === shootId)
  const discipline = normalizeDiscipline(selectedShoot?.discipline)
  const locked = publication?.status === "published"

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const base = await loadReportBaseData()
        setOrganizationId(base.organizationId)
        setEvents(base.events)
        setShoots(base.shoots)
        const firstEvent =
          (routeEventId && base.events.some((event) => event.id === routeEventId)
            ? routeEventId
            : base.events[0]?.id) || ""
        setEventId(firstEvent)
        setShootId(base.shoots.find((shoot) => shoot.event_id === firstEvent)?.id || "")
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load awards.")
      } finally {
        setLoading(false)
      }
    })()
  }, [routeEventId])

  async function refresh() {
    if (!organizationId || !eventId || !shootId) return
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const [nextReport, admin] = await Promise.all([
        loadShootReportData(organizationId, eventId, shootId),
        loadAwardAdministration(shootId),
      ])
      setReport(nextReport)
      setPublication(admin.publication)
      const settings = admin.publication?.settings as {
        meetType?: MeetType
        overallPlaces?: number
        classPlaces?: number
      } | undefined
      if (settings?.meetType) setMeetType(settings.meetType)
      if (settings?.overallPlaces) setOverallPlaces(settings.overallPlaces)
      if (settings?.classPlaces) setClassPlaces(settings.classPlaces)

      const allReports = await Promise.all(eventShoots.map(async (shoot) => ({
        shootId: shoot.id,
        shootName: shoot.name,
        rows: buildRows(await loadShootReportData(organizationId, eventId, shoot.id), shoot),
      })))
      setEventReports(allReports)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to calculate awards.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [organizationId, eventId, shootId])

  const rows = useMemo(() => report ? buildRows(report, selectedShoot) : [], [report, selectedShoot])
  const overallRows = useMemo(
    () => rankIndividuals(rows, overallPlaces),
    [rows, overallPlaces],
  )
  const individualGroups = useMemo(
    () => CYSSA_CLASSES.map((classCode) => ({
      classCode,
      rows: rankIndividuals(
        rows.filter((row) => row.classCode.toUpperCase() === classCode),
        classPlaces,
      ),
    })),
    [rows, classPlaces],
  )
  const squadResults = useMemo(() => calculateSquads(rows, discipline), [rows, discipline])
  const stateTeams = useMemo(() => calculateStateTeams(rows, discipline), [rows, discipline])
  const seriesTeams = useMemo(() => calculateSeriesTeamPoints(eventReports, discipline), [eventReports, discipline])
  const incompleteCount = rows.filter((row) => !row.complete).length
  const unresolvedTieCount = useMemo(() => {
    const individual = individualGroups.reduce((sum, group) => sum + group.rows.filter((row) => row.unresolvedTie).length, 0)
    const squads = squadResults.filter((row) => row.eligible && row.place !== null && row.unresolvedTie).length
    const teams = stateTeams.filter((row) => row.eligible && row.place !== null && row.unresolvedTie).length
    const series = seriesTeams.filter((row) => row.unresolvedTie).length
    return individual + squads + teams + series
  }, [individualGroups, squadResults, stateTeams, seriesTeams])
  const readinessIssues = useMemo(() => {
    const issues: Array<{ id: string; title: string; detail: string; action: string; tab?: TabKey; correctionUrl?: string }> = []

    rows.filter((row) => !row.complete).forEach((row) => issues.push({
      id: `incomplete-${row.enrollmentId}`,
      title: `Incomplete score: ${row.name}`,
      detail: `${row.classCode} · ${row.team} · ${row.squad}. Complete the remaining scoring before publishing awards.`,
      action: "Open this participant in Digital Scoring",
      correctionUrl: `/scoring?eventId=${encodeURIComponent(eventId)}&shootId=${encodeURIComponent(shootId)}&squadId=${encodeURIComponent(row.squadId || "")}&memberId=${encodeURIComponent(row.memberId || "")}&focus=round`,
    }))

    individualGroups.forEach((group) => group.rows.filter((row) => row.unresolvedTie).forEach((row) => issues.push({
      id: `individual-${group.classCode}-${row.enrollmentId}`,
      title: `Individual tie: ${group.classCode} place ${row.place}`,
      detail: `${row.name} is tied at ${row.total}. Enter or verify the shoot-off score, then refresh this page.`,
      action: "Enter this participant's shoot-off score",
      correctionUrl: `/scoring?eventId=${encodeURIComponent(eventId)}&shootId=${encodeURIComponent(shootId)}&squadId=${encodeURIComponent(row.squadId || "")}&memberId=${encodeURIComponent(row.memberId || "")}&focus=shootOff`,
    })))

    squadResults.filter((row) => row.eligible && row.place !== null && row.unresolvedTie).forEach((row) => issues.push({
      id: `squad-${row.category}-${row.label}`,
      title: `Squad tie: ${row.category} place ${row.place}`,
      detail: `${row.label} is tied at ${row.total}. The current rules do not define an automatic squad tie-breaker; review the tied squads and record the official decision.`,
      action: "View Squad Awards",
      tab: "squad",
    }))

    stateTeams.filter((row) => row.eligible && row.place !== null && row.unresolvedTie).forEach((row) => issues.push({
      id: `team-${row.category}-${row.label}`,
      title: `State team tie: ${row.category} place ${row.place}`,
      detail: `${row.label} is tied at ${row.total}. Review the contributing shooters and tie-break score before publishing.`,
      action: "View State Team Awards",
      tab: "stateTeam",
    }))

    seriesTeams.filter((row) => row.unresolvedTie).forEach((row) => issues.push({
      id: `series-${row.category}-${row.team}`,
      title: `Series standings tie: ${row.category}`,
      detail: `${row.team} is tied with ${row.points} points. A final series tie-break rule has not been configured, so an official decision is required.`,
      action: "View Series Standings",
      tab: "seriesTeam",
    }))

    if (publication?.status !== "published") issues.push({
      id: "publication",
      title: "Awards have not been published",
      detail: "After all score and tie issues are resolved, approve the awards. Publish only after the official results have been verified.",
      action: "Use Publish above",
    })

    return issues
  }, [rows, individualGroups, squadResults, stateTeams, seriesTeams, publication?.status, eventId, shootId])
  const readinessChecks = [
    { label: "A shoot is selected", ready: Boolean(selectedShoot) },
    { label: "Participant results are available", ready: rows.length > 0 },
    { label: "All participant scoring is complete", ready: rows.length > 0 && incompleteCount === 0 },
    { label: "No unresolved award ties remain", ready: unresolvedTieCount === 0 },
    { label: "Awards are published", ready: publication?.status === "published" },
  ]
  const readyToPublish = readinessChecks.slice(0, 4).every((check) => check.ready)
  const fullyReady = readinessChecks.every((check) => check.ready)

  function openReadinessIssue(issue: { tab?: TabKey; correctionUrl?: string }) {
    if (issue.correctionUrl) {
      navigate(issue.correctionUrl)
      return
    }
    if (issue.tab) {
      setTab(issue.tab)
      window.setTimeout(() => document.getElementById("awards-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0)
      return
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function saveStatus(status: "provisional" | "approved" | "published") {
    if (!organizationId || !eventId || !shootId) return
    if (status !== "provisional" && (incompleteCount > 0 || unresolvedTieCount > 0)) {
      setError("Complete all scores and resolve ties before approving or publishing awards.")
      return
    }
    try {
      const saved = await saveAwardPublication({
        organizationId,
        eventId,
        shootId,
        status,
        settings: { meetType, discipline, overallPlaces, classPlaces },
      })
      setPublication(saved)
      setMessage(
        status === "published"
          ? "Awards published."
          : status === "approved"
            ? "Awards approved."
            : "Provisional awards saved.",
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save awards.")
    }
  }

  function exportCsv() {
    const lines: string[] = []
    if (tab === "overall") {
      lines.push(["Place", "Participant", "Score", "Shoot Off", "Team", "Class", "Squad", "Tie Status"].map(csvValue).join(","))
      overallRows.forEach((row) => lines.push([row.place, row.name, row.total, row.shootOffs.filter((score) => score >= 0).join("/"), row.team, row.classCode, row.squad, row.unresolvedTie ? "Unresolved" : "Resolved"].map(csvValue).join(",")))
    } else if (tab === "individual") {
      lines.push(["Category", "Place", "Participant", "Score", "Shoot Off", "Team", "Squad", "Tie Status"].map(csvValue).join(","))
      individualGroups.forEach((group) => group.rows.forEach((row) => lines.push([
        group.classCode, row.place, row.name, row.total, row.shootOffs.filter((score) => score >= 0).join("/"), row.team, row.squad, row.unresolvedTie ? "Unresolved" : "Resolved",
      ].map(csvValue).join(","))))
    } else if (tab === "seriesTeam") {
      lines.push(["Category", "Team", "Points", "Shoot Breakdown", "Tie Status"].map(csvValue).join(","))
      seriesTeams.forEach((row) => lines.push([row.category, row.team, row.points, row.shootPoints.map((shoot) => `${shoot.shootName}: ${shoot.points}`).join("; "), row.unresolvedTie ? "Manual decision required" : "Resolved"].map(csvValue).join(",")))
    } else {
      const groups = tab === "squad" ? squadResults : stateTeams
      lines.push(["Category", "Place", "Name", "Score", "Members", "Tie Breaker", "Tie Status"].map(csvValue).join(","))
      groups.forEach((row) => lines.push([row.category, row.place, row.label, row.total, row.members.map((member) => member.name).join("; "), row.tieBreakerScore, row.unresolvedTie ? "Unresolved" : "Resolved"].map(csvValue).join(",")))
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${selectedShoot?.name || "awards"}-${tab}.csv`.replaceAll(" ", "-").toLowerCase()
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={tvMode ? "min-h-screen bg-slate-950 text-white" : "min-h-screen"}>
      {!tvMode && <AppHeader title="CYSSA Awards & Results" description="Official individual, squad, state-team, and series-team calculations." />}
      <PageContainer className={tvMode ? "max-w-none px-8 py-8" : ""}>
        <div className="space-y-6 awards-page">
          <section className={`awards-controls rounded-2xl border p-5 shadow-sm ${tvMode ? "border-slate-800 bg-slate-900" : "bg-white"}`}>
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_180px_150px_150px_auto]">
              <label className="text-sm font-medium">Event<select disabled={Boolean(routeEventId)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" value={eventId} onChange={(event) => { const next = event.target.value; setEventId(next); setShootId(shoots.find((shoot) => shoot.event_id === next)?.id || "") }}>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
              <label className="text-sm font-medium">Shoot<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" value={shootId} onChange={(event) => setShootId(event.target.value)}>{eventShoots.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name}</option>)}</select></label>
              <label className="text-sm font-medium">Meet type<select disabled={locked} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" value={meetType} onChange={(event) => setMeetType(event.target.value as MeetType)}><option value="series">Series Shoot</option><option value="state">State Shoot</option></select></label><label className="text-sm font-medium">Overall places<input disabled={locked} type="number" min={1} max={10} value={overallPlaces} onChange={(event) => setOverallPlaces(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" /></label><label className="text-sm font-medium">Class places<input disabled={locked} type="number" min={1} max={10} value={classPlaces} onChange={(event) => setClassPlaces(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" /></label>
              <div className="flex flex-wrap items-end gap-2"><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button onClick={() => setTvMode((value) => !value)}><Tv className="mr-2 h-4 w-4" />{tvMode ? "Exit TV" : "TV"}</Button></div>
            </div>
          </section>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{message}</div>}
          {incompleteCount > 0 && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5" /><div><p className="font-semibold">{incompleteCount} participant{incompleteCount === 1 ? " has" : "s have"} incomplete scoring.</p><p className="text-sm">Incomplete participants are excluded from awards.</p></div></div>}

          {!tvMode && <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Award workflow</p><p className="text-sm text-slate-500">Save provisional results, approve them after all ties are resolved, then publish the official award sheet.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={locked} onClick={() => void saveStatus("provisional")}><Save className="mr-2 h-4 w-4" />Save Provisional</Button><Button variant="outline" disabled={locked || incompleteCount > 0 || unresolvedTieCount > 0} onClick={() => void saveStatus("approved")}><FileCheck2 className="mr-2 h-4 w-4" />Approve</Button><Button disabled={locked || publication?.status !== "approved"} onClick={() => void saveStatus("published")}><Trophy className="mr-2 h-4 w-4" />Publish</Button></div></div><p className="mt-3 text-xs text-slate-500">Status: <strong className="capitalize">{publication?.status || "unsaved provisional"}</strong></p></section>}

          {!tvMode && <section className="awards-controls rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck2 className={`h-6 w-6 ${fullyReady ? "text-emerald-600" : readyToPublish ? "text-blue-600" : "text-amber-600"}`} />
                  <h2 className="text-lg font-bold">Event readiness</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">ClayKeeper checks the selected shoot before awards are announced or printed.</p>
              </div>
              <div className={`rounded-full px-4 py-2 text-sm font-bold ${fullyReady ? "bg-emerald-100 text-emerald-800" : readyToPublish ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-900"}`}>
                {fullyReady ? "READY TO ANNOUNCE" : readyToPublish ? "READY TO PUBLISH" : "ACTION REQUIRED"}
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {readinessChecks.map((check) => <div key={check.label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${check.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                {check.ready ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span>{check.label}</span>
              </div>)}
            </div>
            {readinessIssues.length > 0 && <div className="mt-5 overflow-hidden rounded-xl border border-amber-200">
              <div className="bg-amber-50 px-4 py-3">
                <p className="font-semibold text-amber-950">What needs attention</p>
                <p className="text-sm text-amber-800">Each item below explains the problem and where to review it.</p>
              </div>
              <div className="divide-y divide-amber-100 bg-white">
                {readinessIssues.map((issue) => <button key={issue.id} type="button" onClick={() => openReadinessIssue(issue)} className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-amber-50/60">
                  <div>
                    <p className="font-medium text-slate-900">{issue.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{issue.detail}</p>
                    <p className="mt-1 text-xs font-semibold text-amber-800">{issue.action}</p>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
                </button>)}
              </div>
            </div>}
            <footer className="award-brand-footer mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
              <p>{brand.reportFooter}</p>
              {brand.supportEmail ? <p className="mt-1">{brand.supportEmail}</p> : null}
            </footer>
          </section>}

          <section id="awards-report" className={`awards-print-area scroll-mt-6 rounded-3xl border p-6 shadow-sm ${tvMode ? "border-slate-800 bg-slate-900" : "bg-white"}`}>
            <div className="award-brand-header mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex min-w-0 items-center gap-4">
                <img src={CLAYKEEPER_LOGO} alt="ClayKeeper TMK" className="h-20 w-28 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{brand.organizationName}</p>
                  <p className="mt-1 text-xs text-slate-500">{brand.reportSubtitle}</p>
                </div>
              </div>
              <div className="flex gap-3"><Stat icon={<Users className="h-5 w-5" />} value={rows.length} label="Participants" /><Stat icon={<Medal className="h-5 w-5" />} value={rows.filter((row) => row.complete).length} label="Complete" /></div>
            </div>
            <div className="mb-6"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">{selectedEvent?.name}</p><h1 className={tvMode ? "text-5xl font-black" : "text-3xl font-bold"}>{selectedShoot?.name || "Select a shoot"}</h1><p className="mt-1 text-sm text-slate-500">{disciplineLabel(discipline)} · {meetType === "state" ? "State Shoot" : "Series Shoot"}</p></div>

            {!tvMode && <div className="mb-5 flex flex-wrap gap-2">{([['overall','Overall Awards'],['individual','Class Awards'],['squad','Squad Awards'],['stateTeam', discipline === 'trap' ? 'State Team High 5' : 'State Team High 3'],['seriesTeam','Series Team Points']] as const).map(([key, label]) => <Button key={key} variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{label}</Button>)}</div>}

            {loading ? <div className="py-20 text-center text-slate-500">Calculating official awards…</div> : rows.length === 0 ? <div className="py-20 text-center"><Medal className="mx-auto h-12 w-12 text-slate-400" /><p className="mt-3 text-lg font-semibold">No results available</p></div> : <div className="space-y-5">
              {(tvMode || tab === "overall") && <div className="grid gap-5"><IndividualCard classCode="Overall" rows={overallRows} /></div>}
              {(tvMode || tab === "individual") && <div className="grid gap-5 xl:grid-cols-2">{individualGroups.map((group) => <IndividualCard key={group.classCode} classCode={group.classCode} rows={group.rows} />)}</div>}
              {!tvMode && tab === "squad" && <GroupTable rows={squadResults} label="Squad" note="JV/VR/YA require 3 participants. IA/IE/R allow 2 or 3 participants. Results are ranked within each class." />}
              {!tvMode && tab === "stateTeam" && <GroupTable rows={stateTeams} label="Team" note={`${discipline === "trap" ? "Highest 5" : "Highest 3"} complete scores per team and category. The next shooter is displayed as the team tie-break score when available.`} />}
              {!tvMode && tab === "seriesTeam" && <SeriesTable rows={seriesTeams} />}
            </div>}
          </section>
        </div>
      </PageContainer>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="rounded-2xl bg-slate-100 p-4 text-slate-900">{icon}<p className="text-2xl font-bold">{value}</p><p className="text-xs">{label}</p></div>
}

function IndividualCard({ classCode, rows }: { classCode: string; rows: ReturnType<typeof classAwardGroups>[number]["rows"] }) {
  return <div className="overflow-hidden rounded-2xl border"><div className="border-b bg-slate-50 px-5 py-4"><h2 className="font-bold">{classCode === "Overall" ? "Overall Champion and Placements" : `Class ${classCode}`}</h2></div>{rows.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No complete scores.</p> : <div className="divide-y">{rows.map((row) => <div key={row.enrollmentId} className="grid grid-cols-[54px_1fr_auto] items-center gap-4 px-5 py-4"><PlaceBadge place={row.place} /><div><p className="font-bold">{row.name}{row.unresolvedTie && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Tie unresolved</span>}</p><p className="text-xs text-slate-500">{row.team} · {row.squad}{row.shootOffs.some((score) => score >= 0) ? ` · Shoot-off ${row.shootOffs.filter((score) => score >= 0).join("/")}` : ""}</p></div><p className="text-2xl font-black">{row.total}</p></div>)}</div>}</div>
}

function PlaceBadge({ place }: { place: number }) {
  return <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${place === 1 ? "bg-amber-400 text-slate-950" : place === 2 ? "bg-slate-300 text-slate-950" : place === 3 ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-900"}`}>{place}</div>
}

function GroupTable({ rows, label, note }: { rows: ReturnType<typeof calculateSquads>; label: string; note: string }) {
  const categories = Array.from(new Set(rows.map((row) => row.category)))
  return <div className="space-y-5"><p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{note}</p>{categories.map((category) => <div key={category} className="overflow-hidden rounded-2xl border"><div className="border-b bg-slate-50 px-5 py-3 font-bold">{category}</div><div className="grid grid-cols-[70px_1fr_110px_110px] bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500"><span>Place</span><span>{label}</span><span>Members</span><span>Total</span></div>{rows.filter((row) => row.category === category).map((row) => <div key={`${category}-${row.label}`} className={`grid grid-cols-[70px_1fr_110px_110px] items-center border-t px-5 py-4 ${!row.eligible ? "bg-slate-50 text-slate-400" : ""}`}><span className="font-bold">{row.place ?? "—"}</span><div><p className="font-semibold">{row.label}{row.unresolvedTie && <span className="ml-2 text-xs text-red-600">Tie unresolved</span>}</p><p className="text-xs">{row.members.map((member) => `${member.name} (${member.total})`).join(", ")}</p>{row.tieBreakerScore !== null && <p className="text-xs text-slate-500">Tie-break score: {row.tieBreakerScore}</p>}</div><span>{row.members.length}</span><span className="text-xl font-black">{row.total}</span></div>)}</div>)}</div>
}

function SeriesTable({ rows }: { rows: ReturnType<typeof calculateSeriesTeamPoints> }) {
  const categories = Array.from(new Set(rows.map((row) => row.category)))
  return <div className="space-y-5"><p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Each series shoot awards 3 points for first, 2 for second, and 1 for third. Teams tied for third both receive 1 point. A season points tie is marked for manual resolution because the supplied rules do not yet define the final tie-breaker.</p>{categories.map((category) => <div key={category} className="overflow-hidden rounded-2xl border"><div className="border-b bg-slate-50 px-5 py-3 font-bold">{category}</div><div className="grid grid-cols-[70px_1fr_100px] bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500"><span>Rank</span><span>Team</span><span>Points</span></div>{rows.filter((row) => row.category === category).map((row, index) => <div key={`${category}-${row.team}`} className="grid grid-cols-[70px_1fr_100px] items-start border-t px-5 py-4"><span className="font-bold">{index + 1}</span><div><p className="font-semibold">{row.team}{row.unresolvedTie && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Tie needs rule</span>}</p><p className="text-xs text-slate-500">{row.shootPoints.map((shoot) => `${shoot.shootName}: ${shoot.points} pt${shoot.points === 1 ? "" : "s"} (${shoot.score})`).join(" · ")}</p></div><span className="text-2xl font-black">{row.points}</span></div>)}</div>)}</div>
}
