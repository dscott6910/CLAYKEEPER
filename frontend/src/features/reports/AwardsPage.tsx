import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Download, Lock, Medal, Printer, RefreshCw, Save, Trophy, Tv, Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { loadAwardAdministration, saveAwardPublication, type AwardPublication } from "@/lib/services/awards"
import {
  calculateSeriesTeamPoints,
  calculateSquads,
  calculateStateTeams,
  classAwardGroups,
  normalizeDiscipline,
  type AwardParticipant,
  type DisciplineKey,
  type MeetType,
  type SeriesShootTeam,
} from "@/lib/services/awardsEngine"
import { loadReportBaseData, loadShootReportData, type ReportAthlete, type ReportEvent, type ReportShoot } from "@/lib/services/reports"

type ReportPayload = Awaited<ReturnType<typeof loadShootReportData>>
type TabKey = "individual" | "squad" | "stateTeam" | "seriesTeam"

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
  const [organizationId, setOrganizationId] = useState("")
  const [events, setEvents] = useState<ReportEvent[]>([])
  const [shoots, setShoots] = useState<ReportShoot[]>([])
  const [eventId, setEventId] = useState("")
  const [shootId, setShootId] = useState("")
  const [report, setReport] = useState<ReportPayload | null>(null)
  const [eventReports, setEventReports] = useState<SeriesShootTeam[]>([])
  const [publication, setPublication] = useState<AwardPublication | null>(null)
  const [meetType, setMeetType] = useState<MeetType>("series")
  const [tab, setTab] = useState<TabKey>("individual")
  const [tvMode, setTvMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const eventShoots = useMemo(() => shoots.filter((shoot) => shoot.event_id === eventId), [shoots, eventId])
  const selectedEvent = events.find((event) => event.id === eventId)
  const selectedShoot = shoots.find((shoot) => shoot.id === shootId)
  const discipline = normalizeDiscipline(selectedShoot?.discipline)
  const locked = publication?.status === "locked"

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const base = await loadReportBaseData()
        setOrganizationId(base.organizationId)
        setEvents(base.events)
        setShoots(base.shoots)
        const firstEvent = base.events[0]?.id || ""
        setEventId(firstEvent)
        setShootId(base.shoots.find((shoot) => shoot.event_id === firstEvent)?.id || "")
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load awards.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
      const settings = admin.publication?.settings as { meetType?: MeetType } | undefined
      if (settings?.meetType) setMeetType(settings.meetType)

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
  const individualGroups = useMemo(() => classAwardGroups(rows, meetType), [rows, meetType])
  const squadResults = useMemo(() => calculateSquads(rows, discipline), [rows, discipline])
  const stateTeams = useMemo(() => calculateStateTeams(rows, discipline), [rows, discipline])
  const seriesTeams = useMemo(() => calculateSeriesTeamPoints(eventReports, discipline), [eventReports, discipline])
  const incompleteCount = rows.filter((row) => !row.complete).length

  async function saveStatus(status: "draft" | "published" | "locked") {
    if (!organizationId || !eventId || !shootId) return
    try {
      const saved = await saveAwardPublication({ organizationId, eventId, shootId, status, settings: { meetType, discipline } })
      setPublication(saved)
      setMessage(status === "locked" ? "Awards locked." : status === "published" ? "Awards published." : "Draft saved.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save awards.")
    }
  }

  function exportCsv() {
    const lines: string[] = []
    if (tab === "individual") {
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
        <div className="space-y-6">
          <section className={`rounded-2xl border p-5 shadow-sm ${tvMode ? "border-slate-800 bg-slate-900" : "bg-white"}`}>
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_220px_auto]">
              <label className="text-sm font-medium">Event<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" value={eventId} onChange={(event) => { const next = event.target.value; setEventId(next); setShootId(shoots.find((shoot) => shoot.event_id === next)?.id || "") }}>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
              <label className="text-sm font-medium">Shoot<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" value={shootId} onChange={(event) => setShootId(event.target.value)}>{eventShoots.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name}</option>)}</select></label>
              <label className="text-sm font-medium">Meet type<select disabled={locked} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" value={meetType} onChange={(event) => setMeetType(event.target.value as MeetType)}><option value="series">Series Shoot</option><option value="state">State Shoot</option></select></label>
              <div className="flex flex-wrap items-end gap-2"><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button onClick={() => setTvMode((value) => !value)}><Tv className="mr-2 h-4 w-4" />{tvMode ? "Exit TV" : "TV"}</Button></div>
            </div>
          </section>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{message}</div>}
          {incompleteCount > 0 && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5" /><div><p className="font-semibold">{incompleteCount} participant{incompleteCount === 1 ? " has" : "s have"} incomplete scoring.</p><p className="text-sm">Incomplete participants are excluded from awards.</p></div></div>}

          {!tvMode && <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Rule preset: {disciplineLabel(discipline)} · {meetType === "state" ? "State" : "Series"}</p><p className="text-sm text-slate-500">Series individual awards are top 3. State individual awards are top 5 for IA/IE/R and top 3 for JV/VR/YA. Shoot-off rounds break individual ties.</p></div><div className="flex gap-2"><Button variant="outline" disabled={locked} onClick={() => void saveStatus("draft")}><Save className="mr-2 h-4 w-4" />Save</Button><Button disabled={locked} onClick={() => void saveStatus("published")}><Trophy className="mr-2 h-4 w-4" />Publish</Button><Button variant="outline" disabled={locked} onClick={() => void saveStatus("locked")}><Lock className="mr-2 h-4 w-4" />Lock</Button></div></div><p className="mt-3 text-xs text-slate-500">Status: <strong className="capitalize">{publication?.status || "unsaved draft"}</strong></p></section>}

          <section className={`rounded-3xl border p-6 shadow-sm ${tvMode ? "border-slate-800 bg-slate-900" : "bg-white"}`}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">{selectedEvent?.name}</p><h1 className={tvMode ? "text-5xl font-black" : "text-3xl font-bold"}>{selectedShoot?.name || "Select a shoot"}</h1><p className="mt-1 text-sm text-slate-500">{disciplineLabel(discipline)} · {meetType === "state" ? "State Shoot" : "Series Shoot"}</p></div><div className="flex gap-3"><Stat icon={<Users className="h-5 w-5" />} value={rows.length} label="Participants" /><Stat icon={<Medal className="h-5 w-5" />} value={rows.filter((row) => row.complete).length} label="Complete" /></div></div>

            {!tvMode && <div className="mb-5 flex flex-wrap gap-2">{([['individual','Individual Awards'],['squad','Squad Awards'],['stateTeam', discipline === 'trap' ? 'State Team High 5' : 'State Team High 3'],['seriesTeam','Series Team Points']] as const).map(([key, label]) => <Button key={key} variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{label}</Button>)}</div>}

            {loading ? <div className="py-20 text-center text-slate-500">Calculating official awards…</div> : rows.length === 0 ? <div className="py-20 text-center"><Medal className="mx-auto h-12 w-12 text-slate-400" /><p className="mt-3 text-lg font-semibold">No results available</p></div> : <div className="space-y-5">
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
  return <div className="overflow-hidden rounded-2xl border"><div className="border-b bg-slate-50 px-5 py-4"><h2 className="font-bold">Class {classCode}</h2></div>{rows.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No complete scores.</p> : <div className="divide-y">{rows.map((row) => <div key={row.enrollmentId} className="grid grid-cols-[54px_1fr_auto] items-center gap-4 px-5 py-4"><PlaceBadge place={row.place} /><div><p className="font-bold">{row.name}{row.unresolvedTie && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Tie unresolved</span>}</p><p className="text-xs text-slate-500">{row.team} · {row.squad}{row.shootOffs.some((score) => score >= 0) ? ` · Shoot-off ${row.shootOffs.filter((score) => score >= 0).join("/")}` : ""}</p></div><p className="text-2xl font-black">{row.total}</p></div>)}</div>}</div>
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
