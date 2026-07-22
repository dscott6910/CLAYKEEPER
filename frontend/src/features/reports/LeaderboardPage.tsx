import { useEffect, useMemo, useState } from "react"
import { Expand, Minimize, RefreshCw, Trophy, Users } from "lucide-react"

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

type LeaderboardData = {
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

type LeaderRow = {
  enrollmentId: string
  name: string
  team: string
  classCode: string
  squad: string
  total: number
  complete: boolean
  shootOffs: number[]
}

const emptyData: LeaderboardData = {
  registrations: [],
  enrollments: [],
  athletes: [],
  teams: [],
  classes: [],
  squads: [],
  members: [],
  scores: [],
  shootOffRounds: [],
  shootOffScores: [],
}

function participantName(athlete: ReportAthlete | undefined) {
  if (!athlete) return "Unknown participant"
  const first = athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim() || "Unnamed participant"
}

export function LeaderboardPage() {
  const [organizationId, setOrganizationId] = useState("")
  const [events, setEvents] = useState<ReportEvent[]>([])
  const [shoots, setShoots] = useState<ReportShoot[]>([])
  const [eventId, setEventId] = useState("")
  const [shootId, setShootId] = useState("")
  const [data, setData] = useState<LeaderboardData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [displayMode, setDisplayMode] = useState<"overall" | "class" | "team">("overall")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const eventShoots = useMemo(() => shoots.filter((shoot) => shoot.event_id === eventId), [shoots, eventId])
  const selectedEvent = events.find((event) => event.id === eventId)
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
      setError(err instanceof Error ? err.message : "Unable to load leaderboard selections.")
    } finally {
      setLoading(false)
    }
  }

  async function refreshLeaderboard(showSpinner = true) {
    if (!organizationId || !eventId || !shootId) {
      setData(emptyData)
      return
    }
    if (showSpinner) setLoading(true)
    setError("")
    try {
      setData(await loadShootReportData(organizationId, eventId, shootId))
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh the leaderboard.")
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  useEffect(() => { void loadBase() }, [])
  useEffect(() => { void refreshLeaderboard() }, [organizationId, eventId, shootId])

  useEffect(() => {
    if (!autoRefresh || !organizationId || !eventId || !shootId) return
    const timer = window.setInterval(() => { void refreshLeaderboard(false) }, 15000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, organizationId, eventId, shootId])

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFullscreen)
    return () => document.removeEventListener("fullscreenchange", onFullscreen)
  }, [])

  const leaders = useMemo<LeaderRow[]>(() => {
    const registrationById = new Map(data.registrations.map((row) => [row.id, row]))
    const athleteById = new Map(data.athletes.map((row) => [row.id, row]))
    const teamById = new Map(data.teams.map((row) => [row.id, row]))
    const classById = new Map(data.classes.map((row) => [row.id, row]))
    const memberByEnrollment = new Map(data.members.map((row) => [row.registration_shoot_id, row]))
    const squadById = new Map(data.squads.map((row) => [row.id, row]))
    const scoresByMember = new Map<string, ReportScore[]>()
    for (const score of data.scores) {
      const list = scoresByMember.get(score.squad_member_id) ?? []
      list.push(score)
      scoresByMember.set(score.squad_member_id, list)
    }
    const shootOffScoreByKey = new Map(data.shootOffScores.map((row) => [`${row.squad_member_id}:${row.shoot_off_round_id}`, row.score ?? 0]))

    return data.enrollments.map((enrollment) => {
      const registration = registrationById.get(enrollment.registration_id)
      const member = memberByEnrollment.get(enrollment.id)
      const athlete = registration ? athleteById.get(registration.athlete_id) : undefined
      const squad = member ? squadById.get(member.squad_id) : undefined
      const memberScores = member ? scoresByMember.get(member.id) ?? [] : []
      const total = memberScores.reduce((sum, score) => sum + (score.score ?? 0), 0)
      const complete = memberScores.filter((score) => score.score !== null).length >= (selectedShoot?.number_of_rounds ?? 0)
      const shootOffs = member ? data.shootOffRounds.map((round) => shootOffScoreByKey.get(`${member.id}:${round.id}`) ?? 0) : []
      return {
        enrollmentId: enrollment.id,
        name: participantName(athlete),
        team: registration?.team_id ? teamById.get(registration.team_id)?.name ?? "No team" : "No team",
        classCode: registration?.class_id ? classById.get(registration.class_id)?.code ?? "—" : "—",
        squad: squad ? `Squad ${squad.squad_number}` : "Unassigned",
        total,
        complete,
        shootOffs,
      }
    }).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      const maxShootOffs = Math.max(a.shootOffs.length, b.shootOffs.length)
      for (let index = 0; index < maxShootOffs; index += 1) {
        const difference = (b.shootOffs[index] ?? 0) - (a.shootOffs[index] ?? 0)
        if (difference !== 0) return difference
      }
      return a.name.localeCompare(b.name)
    })
  }, [data, selectedShoot])

  const groupedLeaders = useMemo(() => {
    if (displayMode === "overall") return [{ label: "Overall Leaders", rows: leaders.slice(0, 10) }]
    const keyFor = (row: LeaderRow) => displayMode === "class" ? row.classCode : row.team
    const groups = new Map<string, LeaderRow[]>()
    for (const row of leaders) {
      const key = keyFor(row)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(row)
    }
    return Array.from(groups.entries())
      .filter(([label]) => label && label !== "—" && label !== "No team")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, rows]) => ({ label, rows: rows.slice(0, displayMode === "class" ? 3 : 5) }))
  }, [displayMode, leaders])

  const completedCount = leaders.filter((row) => row.complete).length

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }

  return (
    <div className={isFullscreen ? "min-h-screen bg-slate-950 text-white" : ""}>
      {!isFullscreen && <AppHeader title="Live Leaderboard" description="Auto-refreshing standings for clubhouse and event displays." />}
      <PageContainer className={isFullscreen ? "max-w-none px-8 py-8" : ""}>
        <div className="space-y-6">
          <section className={`rounded-2xl border p-5 shadow-sm ${isFullscreen ? "border-slate-800 bg-slate-900" : "bg-white"}`}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium">Event<select className={`mt-1 w-full rounded-lg border px-3 py-2 ${isFullscreen ? "border-slate-700 bg-slate-950" : "bg-white"}`} value={eventId} onChange={(event) => { const next = event.target.value; setEventId(next); setShootId(shoots.find((shoot) => shoot.event_id === next)?.id || "") }}>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
                <label className="text-sm font-medium">Shoot<select className={`mt-1 w-full rounded-lg border px-3 py-2 ${isFullscreen ? "border-slate-700 bg-slate-950" : "bg-white"}`} value={shootId} onChange={(event) => setShootId(event.target.value)}>{eventShoots.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name}</option>)}</select></label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className={`rounded-lg border px-3 py-2 text-sm ${isFullscreen ? "border-slate-700 bg-slate-950" : "bg-white"}`} value={displayMode} onChange={(event) => setDisplayMode(event.target.value as typeof displayMode)}><option value="overall">Overall</option><option value="class">By class</option><option value="team">By team</option></select>
                <Button variant="outline" onClick={() => setAutoRefresh((value) => !value)}>{autoRefresh ? "Auto refresh: On" : "Auto refresh: Off"}</Button>
                <Button variant="outline" onClick={() => void refreshLeaderboard()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                <Button onClick={() => void toggleFullscreen()}>{isFullscreen ? <Minimize className="mr-2 h-4 w-4" /> : <Expand className="mr-2 h-4 w-4" />}{isFullscreen ? "Exit Fullscreen" : "TV Mode"}</Button>
              </div>
            </div>
          </section>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <section className={`rounded-3xl border p-6 shadow-sm ${isFullscreen ? "border-slate-800 bg-slate-900" : "bg-white"}`}>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className={`text-sm font-semibold uppercase tracking-[0.25em] ${isFullscreen ? "text-emerald-400" : "text-emerald-700"}`}>{selectedEvent?.name || "ClayKeeper"}</p>
                <h1 className={`mt-1 font-bold ${isFullscreen ? "text-5xl" : "text-3xl"}`}>{selectedShoot?.name || "Select a shoot"}</h1>
                <p className={`mt-2 ${isFullscreen ? "text-lg text-slate-300" : "text-slate-500"}`}>{selectedShoot ? `${selectedShoot.discipline} · ${selectedShoot.number_of_rounds} rounds · ${selectedShoot.targets_per_round} targets per round` : ""}</p>
              </div>
              <div className="flex gap-3">
                <div className={`rounded-2xl p-4 ${isFullscreen ? "bg-slate-950" : "bg-slate-50"}`}><Users className="mb-2 h-5 w-5 text-emerald-500" /><p className="text-2xl font-bold">{leaders.length}</p><p className="text-xs uppercase tracking-wide text-slate-500">Participants</p></div>
                <div className={`rounded-2xl p-4 ${isFullscreen ? "bg-slate-950" : "bg-slate-50"}`}><Trophy className="mb-2 h-5 w-5 text-amber-500" /><p className="text-2xl font-bold">{completedCount}</p><p className="text-xs uppercase tracking-wide text-slate-500">Complete</p></div>
              </div>
            </div>

            {loading ? <div className="py-20 text-center text-slate-500">Loading live standings…</div> : leaders.length === 0 ? <div className="py-20 text-center"><Trophy className="mx-auto mb-4 h-12 w-12 text-slate-400" /><h2 className="text-xl font-semibold">No standings available yet</h2><p className="mt-2 text-slate-500">Register participants, assign squads, and enter scores to populate the leaderboard.</p></div> : (
              <div className={`grid gap-5 ${displayMode === "overall" ? "grid-cols-1" : "xl:grid-cols-2"}`}>
                {groupedLeaders.map((group) => <div key={group.label} className={`overflow-hidden rounded-2xl border ${isFullscreen ? "border-slate-800 bg-slate-950" : "bg-white"}`}><div className={`border-b px-5 py-4 ${isFullscreen ? "border-slate-800" : "bg-slate-50"}`}><h2 className={isFullscreen ? "text-2xl font-bold" : "text-lg font-semibold"}>{group.label}</h2></div><div className="divide-y divide-slate-200/20">{group.rows.map((row, index) => <div key={row.enrollmentId} className={`grid grid-cols-[64px_1fr_auto] items-center gap-4 px-5 py-4 ${isFullscreen ? "text-xl" : ""}`}><div className={`flex h-11 w-11 items-center justify-center rounded-full font-bold ${index === 0 ? "bg-amber-400 text-slate-950" : index === 1 ? "bg-slate-300 text-slate-950" : index === 2 ? "bg-amber-700 text-white" : isFullscreen ? "bg-slate-800" : "bg-slate-100"}`}>{index + 1}</div><div><p className="font-bold">{row.name}</p><p className={`${isFullscreen ? "text-sm text-slate-400" : "text-xs text-slate-500"}`}>{row.team} · {row.classCode} · {row.squad}</p></div><div className="text-right"><p className={`${isFullscreen ? "text-4xl" : "text-2xl"} font-black`}>{row.total}</p>{row.shootOffs.some((score) => score > 0) && <p className="text-xs font-semibold text-amber-500">SO {row.shootOffs.join(" / ")}</p>}</div></div>)}</div></div>)}
              </div>
            )}

            <div className={`mt-5 flex items-center justify-between text-xs ${isFullscreen ? "text-slate-500" : "text-slate-400"}`}><span>{autoRefresh ? "Updates every 15 seconds" : "Automatic refresh paused"}</span><span>{lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Not refreshed yet"}</span></div>
          </section>
        </div>
      </PageContainer>
    </div>
  )
}
