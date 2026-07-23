import { useEffect, useMemo, useState } from "react"
import { Download, Lock, Medal, Printer, RefreshCw, Save, Trophy, Tv, Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { loadAwardAdministration, saveAwardPublication, type AwardPublication } from "@/lib/services/awards"
import { loadReportBaseData, loadShootReportData, type ReportAthlete, type ReportEnrollment, type ReportEvent, type ReportShoot } from "@/lib/services/reports"

type AwardRow = {
  enrollmentId: string
  name: string
  team: string
  classCode: string
  squad: string
  total: number
  complete: boolean
  shootOffs: number[]
  tied: boolean
}

type TeamResult = { label: string; members: AwardRow[]; total: number; eligible: boolean }

function participantName(athlete?: ReportAthlete) {
  if (!athlete) return "Unknown participant"
  return `${athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""} ${athlete.last_name?.trim() || ""}`.trim() || "Unnamed participant"
}

function compareRows(a: AwardRow, b: AwardRow) {
  if (b.total !== a.total) return b.total - a.total
  const count = Math.max(a.shootOffs.length, b.shootOffs.length)
  for (let index = 0; index < count; index += 1) {
    const delta = (b.shootOffs[index] ?? -1) - (a.shootOffs[index] ?? -1)
    if (delta !== 0) return delta
  }
  return a.name.localeCompare(b.name)
}

function sameScore(a: AwardRow, b: AwardRow) {
  if (a.total !== b.total) return false
  const count = Math.max(a.shootOffs.length, b.shootOffs.length)
  for (let index = 0; index < count; index += 1) {
    if ((a.shootOffs[index] ?? null) !== (b.shootOffs[index] ?? null)) return false
  }
  return true
}

function csvValue(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export function AwardsPage() {
  const [organizationId, setOrganizationId] = useState("")
  const [events, setEvents] = useState<ReportEvent[]>([])
  const [shoots, setShoots] = useState<ReportShoot[]>([])
  const [eventId, setEventId] = useState("")
  const [shootId, setShootId] = useState("")
  const [report, setReport] = useState<Awaited<ReturnType<typeof loadShootReportData>> | null>(null)
  const [publication, setPublication] = useState<AwardPublication | null>(null)
  const [placements, setPlacements] = useState(3)
  const [teamSize, setTeamSize] = useState(3)
  const [squadMinimum, setSquadMinimum] = useState(3)
  const [tab, setTab] = useState<"overall" | "class" | "team" | "squad">("overall")
  const [tvMode, setTvMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const eventShoots = useMemo(() => shoots.filter((shoot) => shoot.event_id === eventId), [shoots, eventId])
  const selectedEvent = events.find((event) => event.id === eventId)
  const selectedShoot = shoots.find((shoot) => shoot.id === shootId)
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
    try {
      const [nextReport, admin] = await Promise.all([
        loadShootReportData(organizationId, eventId, shootId),
        loadAwardAdministration(shootId),
      ])
      setReport(nextReport)
      setPublication(admin.publication)
      const settings = admin.publication?.settings as { placements?: number; teamSize?: number; squadMinimum?: number } | undefined
      if (settings?.placements) setPlacements(settings.placements)
      if (settings?.teamSize) setTeamSize(settings.teamSize)
      if (settings?.squadMinimum) setSquadMinimum(settings.squadMinimum)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to calculate awards.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [organizationId, eventId, shootId])

  const standings = useMemo<AwardRow[]>(() => {
    if (!report) return []
    const registrationById = new Map(report.registrations.map((row) => [row.id, row]))
    const athleteById = new Map(report.athletes.map((row) => [row.id, row]))
    const teamById = new Map(report.teams.map((row) => [row.id, row]))
    const classById = new Map(report.classes.map((row) => [row.id, row]))
    const memberByEnrollment = new Map(report.members.map((row) => [row.registration_shoot_id, row]))
    const squadById = new Map(report.squads.map((row) => [row.id, row]))
    const scoresByMember = new Map<string, typeof report.scores>()
    report.scores.forEach((score) => scoresByMember.set(score.squad_member_id, [...(scoresByMember.get(score.squad_member_id) || []), score]))
    const shootOffByKey = new Map(report.shootOffScores.map((score) => [`${score.squad_member_id}:${score.shoot_off_round_id}`, score.score ?? 0]))

    const rows = report.enrollments
      .filter((enrollment: ReportEnrollment) => !["withdrawn", "cancelled"].includes(enrollment.status))
      .map((enrollment) => {
        const registration = registrationById.get(enrollment.registration_id)
        const athlete = athleteById.get(registration?.athlete_id || "")
        const member = memberByEnrollment.get(enrollment.id)
        const squad = member ? squadById.get(member.squad_id) : undefined
        const scores = member ? scoresByMember.get(member.id) || [] : []
        const entered = scores.filter((score) => score.score !== null).length
        const row: AwardRow = {
          enrollmentId: enrollment.id,
          name: participantName(athlete),
          team: teamById.get(registration?.team_id || "")?.name || "No team",
          classCode: classById.get(registration?.class_id || "")?.code || "Unclassified",
          squad: squad ? `Squad ${squad.squad_number}` : "Unassigned",
          total: enrollment.historical_total_score ?? scores.reduce((sum, score) => sum + (score.score ?? 0), 0),
          complete: enrollment.historical_total_score !== null || entered >= (selectedShoot?.number_of_rounds || 0),
          shootOffs: member ? report.shootOffRounds.map((round) => shootOffByKey.get(`${member.id}:${round.id}`) ?? 0) : [],
          tied: false,
        }
        return row
      })
      .sort(compareRows)

    return rows.map((row, index) => ({
      ...row,
      tied: Boolean((rows[index - 1] && sameScore(row, rows[index - 1])) || (rows[index + 1] && sameScore(row, rows[index + 1]))),
    }))
  }, [report, selectedShoot])

  const completeRows = standings.filter((row) => row.complete)
  const overall = completeRows.slice(0, placements)

  const classGroups = useMemo(() => {
    const grouped = new Map<string, AwardRow[]>()
    completeRows.forEach((row) => grouped.set(row.classCode, [...(grouped.get(row.classCode) || []), row]))
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, rows]) => ({ label, rows: rows.sort(compareRows).slice(0, placements) }))
  }, [completeRows, placements])

  const teamResults = useMemo<TeamResult[]>(() => {
    const grouped = new Map<string, AwardRow[]>()
    completeRows.filter((row) => row.team !== "No team").forEach((row) => grouped.set(row.team, [...(grouped.get(row.team) || []), row]))
    return Array.from(grouped.entries()).map(([label, rows]) => {
      const members = rows.sort(compareRows).slice(0, teamSize)
      return { label, members, total: members.reduce((sum, row) => sum + row.total, 0), eligible: rows.length >= teamSize }
    }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
  }, [completeRows, teamSize])

  const squadResults = useMemo<TeamResult[]>(() => {
    const grouped = new Map<string, AwardRow[]>()
    completeRows.filter((row) => row.squad !== "Unassigned").forEach((row) => grouped.set(row.squad, [...(grouped.get(row.squad) || []), row]))
    return Array.from(grouped.entries()).map(([label, rows]) => ({ label, members: rows, total: rows.reduce((sum, row) => sum + row.total, 0), eligible: rows.length >= squadMinimum })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
  }, [completeRows, squadMinimum])

  async function saveStatus(status: "draft" | "published" | "locked") {
    if (!organizationId || !eventId || !shootId) return
    try {
      const saved = await saveAwardPublication({ organizationId, eventId, shootId, status, settings: { placements, teamSize, squadMinimum } })
      setPublication(saved)
      setMessage(status === "locked" ? "Awards locked." : status === "published" ? "Awards published." : "Draft saved.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save awards.")
    }
  }

  function exportCsv() {
    const lines = [["Group", "Category", "Place", "Name", "Score", "Team", "Class", "Tie"].map(csvValue).join(",")]
    overall.forEach((row, index) => lines.push(["Individual", "Overall", index + 1, row.name, row.total, row.team, row.classCode, row.tied ? "Yes" : "No"].map(csvValue).join(",")))
    classGroups.forEach((group) => group.rows.forEach((row, index) => lines.push(["Individual", group.label, index + 1, row.name, row.total, row.team, row.classCode, row.tied ? "Yes" : "No"].map(csvValue).join(","))))
    teamResults.filter((team) => team.eligible).slice(0, placements).forEach((team, index) => lines.push(["Team", "Overall", index + 1, team.label, team.total, team.label, "", ""].map(csvValue).join(",")))
    squadResults.filter((squad) => squad.eligible).slice(0, placements).forEach((squad, index) => lines.push(["Squad", "Overall", index + 1, squad.label, squad.total, "", "", ""].map(csvValue).join(",")))
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${selectedShoot?.name || "awards"}-awards.csv`.replaceAll(" ", "-").toLowerCase()
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const resultRows = (rows: AwardRow[]) => (
    <div className="divide-y">
      {rows.map((row, index) => (
        <div key={row.enrollmentId} className="grid grid-cols-[54px_1fr_auto] items-center gap-4 px-5 py-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${index === 0 ? "bg-amber-400 text-slate-950" : index === 1 ? "bg-slate-300 text-slate-950" : index === 2 ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-900"}`}>{index + 1}</div>
          <div>
            <p className="font-bold">{row.name}{row.tied && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Tie unresolved</span>}</p>
            <p className="text-xs text-slate-500">{row.team} · {row.classCode} · {row.squad}{row.shootOffs.some(Boolean) ? ` · SO ${row.shootOffs.join("/")}` : ""}</p>
          </div>
          <p className="text-2xl font-black">{row.total}</p>
        </div>
      ))}
    </div>
  )

  return (
    <div className={tvMode ? "min-h-screen bg-slate-950 text-white" : "min-h-screen"}>
      {!tvMode && <AppHeader title="Awards & Results" description="Calculate, publish, print, and present competition awards." />}
      <PageContainer className={tvMode ? "max-w-none px-8 py-8" : ""}>
        <div className="space-y-6">
          <section className={`rounded-2xl border p-5 shadow-sm ${tvMode ? "border-slate-800 bg-slate-900" : "bg-white"}`}>
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm font-medium">Event<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" value={eventId} onChange={(event) => { const next = event.target.value; setEventId(next); setShootId(shoots.find((shoot) => shoot.event_id === next)?.id || "") }}>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
              <label className="text-sm font-medium">Shoot<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900" value={shootId} onChange={(event) => setShootId(event.target.value)}>{eventShoots.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name}</option>)}</select></label>
              <div className="flex flex-wrap items-end gap-2"><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button onClick={() => setTvMode((value) => !value)}><Tv className="mr-2 h-4 w-4" />{tvMode ? "Exit TV" : "TV Mode"}</Button></div>
            </div>
          </section>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{message}</div>}

          {!tvMode && <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Award places<input type="number" min={1} max={10} value={placements} disabled={locked} onChange={(event) => setPlacements(Number(event.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">Scoring team size<input type="number" min={1} max={10} value={teamSize} disabled={locked} onChange={(event) => setTeamSize(Number(event.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">Minimum squad size<input type="number" min={1} max={10} value={squadMinimum} disabled={locked} onChange={(event) => setSquadMinimum(Number(event.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><div className="flex gap-2"><Button variant="outline" disabled={locked} onClick={() => void saveStatus("draft")}><Save className="mr-2 h-4 w-4" />Save Draft</Button><Button disabled={locked} onClick={() => void saveStatus("published")}><Trophy className="mr-2 h-4 w-4" />Publish</Button><Button variant="outline" disabled={locked} onClick={() => void saveStatus("locked")}><Lock className="mr-2 h-4 w-4" />Lock</Button></div></div><p className="mt-3 text-xs text-slate-500">Status: <strong className="capitalize">{publication?.status || "unsaved draft"}</strong></p></section>}

          <section className={`rounded-3xl border p-6 shadow-sm ${tvMode ? "border-slate-800 bg-slate-900" : "bg-white"}`}>
            <div className="mb-6 flex items-center justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">{selectedEvent?.name}</p><h1 className={tvMode ? "text-5xl font-black" : "text-3xl font-bold"}>{selectedShoot?.name || "Select a shoot"}</h1></div><div className="flex gap-3"><div className="rounded-2xl bg-slate-100 p-4 text-slate-900"><Users className="h-5 w-5" /><p className="text-2xl font-bold">{standings.length}</p><p className="text-xs">Participants</p></div><div className="rounded-2xl bg-amber-100 p-4 text-slate-900"><Medal className="h-5 w-5" /><p className="text-2xl font-bold">{completeRows.length}</p><p className="text-xs">Complete</p></div></div></div>

            {!tvMode && <div className="mb-5 flex flex-wrap gap-2">{([['overall','Overall'],['class','By Class'],['team','Teams'],['squad','Squads']] as const).map(([key, label]) => <Button key={key} variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{label}</Button>)}</div>}

            {loading ? <div className="py-20 text-center text-slate-500">Calculating awards…</div> : standings.length === 0 ? <div className="py-20 text-center"><Medal className="mx-auto h-12 w-12 text-slate-400" /><p className="mt-3 text-lg font-semibold">No results available</p></div> : <div className="space-y-5">
              {(tvMode || tab === "overall") && <div className={`overflow-hidden rounded-2xl border ${tvMode ? "border-slate-800 bg-slate-950" : ""}`}><div className="border-b px-5 py-4"><h2 className="text-xl font-bold">Overall Awards</h2></div>{resultRows(overall)}</div>}
              {!tvMode && tab === "class" && <div className="grid gap-5 xl:grid-cols-2">{classGroups.map((group) => <div key={group.label} className="overflow-hidden rounded-2xl border"><div className="border-b bg-slate-50 px-5 py-4"><h2 className="font-bold">Class {group.label}</h2></div>{resultRows(group.rows)}</div>)}</div>}
              {!tvMode && tab === "team" && <ResultTable rows={teamResults} placements={placements} label="Team" />}
              {!tvMode && tab === "squad" && <ResultTable rows={squadResults} placements={placements} label="Squad" />}
            </div>}
          </section>
        </div>
      </PageContainer>
    </div>
  )
}

function ResultTable({ rows, placements, label }: { rows: TeamResult[]; placements: number; label: string }) {
  let eligiblePlace = 0
  return <div className="overflow-hidden rounded-2xl border"><div className="grid grid-cols-[70px_1fr_120px_120px] bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500"><span>Place</span><span>{label}</span><span>Members</span><span>Total</span></div>{rows.map((row) => { if (row.eligible) eligiblePlace += 1; const place = row.eligible ? eligiblePlace : null; return <div key={row.label} className={`grid grid-cols-[70px_1fr_120px_120px] items-center border-t px-5 py-4 ${!row.eligible ? "bg-slate-50 text-slate-400" : ""}`}><span className="font-bold">{place && place <= placements ? place : "—"}</span><div><p className="font-semibold">{row.label}</p><p className="text-xs">{row.members.map((member) => member.name).join(", ")}</p></div><span>{row.members.length}</span><span className="text-xl font-black">{row.total}</span></div> })}</div>
}
