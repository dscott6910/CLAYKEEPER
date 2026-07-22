import { useEffect, useMemo, useState } from "react"
import { AlertCircle, BarChart3, CheckCircle2, DollarSign, Download, Medal, Printer, RefreshCw, Trophy, Users } from "lucide-react"

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
  const [organizationId, setOrganizationId] = useState("")
  const [events, setEvents] = useState<ReportEvent[]>([])
  const [shoots, setShoots] = useState<ReportShoot[]>([])
  const [eventId, setEventId] = useState("")
  const [shootId, setShootId] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")
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
      const nextEvent = eventId || base.events[0]?.id || ""
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
      if (!needle) return true
      return [row.athleteName, row.cyssaNumber || "", row.teamName, row.classCode, row.className, row.squadLabel].some((value) => value.toLowerCase().includes(needle))
    })
  }, [standings, classFilter, teamFilter, search])

  const completeCount = standings.filter((row) => row.complete).length
  const enteredScoreCount = standings.reduce((sum, row) => sum + row.enteredRounds, 0)
  const expectedScoreCount = standings.length * (selectedShoot?.number_of_rounds ?? 0)
  const totalFees = data.enrollments.reduce((sum, enrollment) => sum + Number(enrollment.total_fee || 0), 0)
  const totalPaid = data.registrations.reduce((sum, registration) => sum + Number(registration.amount_paid || 0), 0)

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

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div><h2 className="text-lg font-semibold">Individual Standings</h2><p className="text-sm text-slate-500">{selectedShoot ? `${selectedShoot.name} · ${selectedShoot.targets_per_round} targets per round · ${selectedShoot.number_of_rounds} rounds` : "Select a shoot"}</p></div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <input className="w-56 rounded-lg border px-3 py-2 text-sm" placeholder="Search participant, team…" value={search} onChange={(event) => setSearch(event.target.value)} />
                <select className="rounded-lg border bg-white px-3 py-2 text-sm" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="all">All classes</option>{data.classes.map((cls) => <option key={cls.id} value={cls.code}>{cls.display_name}</option>)}</select>
                <select className="rounded-lg border bg-white px-3 py-2 text-sm" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">All teams</option>{Array.from(new Set(standings.map((row) => row.teamName).filter((name) => name !== "No team"))).sort().map((name) => <option key={name} value={name}>{name}</option>)}</select>
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
