import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Clock3, Maximize2, Medal, RefreshCw, Search, Target, Trophy, Users } from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router-dom"

import { loadPublicEventPortal, type PublicEventPortalEntry, type PublicEventPortalPayload } from "@/lib/services/publicEventPortal"

function formatDate(value: string | null | undefined) {
  if (!value) return "Date to be announced"
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function formatTime(value: string | null | undefined) {
  if (!value) return "TBA"
  const [hour, minute] = value.split(":").map(Number)
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, hour, minute))
}

function rank(entries: PublicEventPortalEntry[]) {
  return [...entries].sort((a, b) => b.totalScore - a.totalScore || a.participantName.localeCompare(b.participantName))
}

export function PublicEventPage() {
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const display = searchParams.get("display") === "1"
  const [payload, setPayload] = useState<PublicEventPortalPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [shootId, setShootId] = useState("all")
  const [tab, setTab] = useState<"overall" | "class" | "team" | "squads" | "awards">("overall")

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError("")
    try {
      setPayload(await loadPublicEventPortal(eventId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The public event page could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => void load(), display ? 10_000 : 20_000)
    return () => window.clearInterval(timer)
  }, [display, load])

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (payload?.entries ?? []).filter((entry) => {
      if (shootId !== "all" && entry.shootId !== shootId) return false
      if (!needle) return true
      return [entry.participantName, entry.teamName, entry.classCode, entry.squadNumber, entry.shootName].some((value) => value?.toLowerCase().includes(needle))
    })
  }, [payload?.entries, query, shootId])

  const visibleScores = useMemo(() => rank(entries.filter((row) => row.scoreStatus !== "hidden")), [entries])
  const classRows = useMemo(() => {
    const groups = new Map<string, PublicEventPortalEntry[]>()
    for (const row of visibleScores) groups.set(row.classCode, [...(groups.get(row.classCode) ?? []), row])
    return [...groups.entries()].flatMap(([classCode, rows]) => rank(rows).map((row, index) => ({ ...row, classCode, classPlace: index + 1 })))
  }, [visibleScores])
  const teams = useMemo(() => {
    const groups = new Map<string, PublicEventPortalEntry[]>()
    for (const row of visibleScores.filter((item) => item.teamName !== "Independent")) groups.set(row.teamName, [...(groups.get(row.teamName) ?? []), row])
    return [...groups.entries()].map(([teamName, members]) => ({ teamName, members: members.length, score: rank(members).slice(0, 5).reduce((sum, row) => sum + row.totalScore, 0) })).sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName))
  }, [visibleScores])
  const awards = useMemo(() => rank(entries.filter((row) => row.awardPublished)), [entries])
  const completion = payload?.stats?.assigned ? Math.round(((payload.stats.finalized ?? 0) / payload.stats.assigned) * 100) : 0

  if (loading && !payload) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><RefreshCw className="mr-3 h-6 w-6 animate-spin" />Loading ClayKeeper Live…</div>
  if (error && !payload) return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="max-w-lg rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-bold">Public event unavailable</h1><p className="mt-2 text-slate-600">{error}</p></div></div>
  if (!payload?.available) return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="max-w-lg rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-bold">This event is not public yet</h1><p className="mt-2 text-slate-600">Tournament staff will open this page when live results are ready.</p><Link to="/public" className="mt-5 inline-block font-semibold text-emerald-700">View public events</Link></div></div>

  return <div className={`min-h-screen bg-slate-100 text-slate-950 ${display ? "text-lg" : ""}`}>
    <header className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 text-white">
      <div className={`${display ? "max-w-[1600px]" : "max-w-7xl"} mx-auto px-4 py-6 sm:px-6 lg:px-8`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {payload.organization?.logoUrl ? <img src={payload.organization.logoUrl} alt="" className="h-16 w-16 rounded-xl bg-white object-contain p-1" /> : <div className="rounded-2xl bg-white/15 p-3"><Target className="h-9 w-9" /></div>}
            <div><p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-100">ClayKeeper Live</p><h1 className="text-2xl font-black sm:text-4xl">{payload.event?.name}</h1><p className="mt-1 text-emerald-50">{formatDate(payload.event?.startDate)}{payload.event?.sponsorName ? ` · ${payload.event.sponsorName}` : ""}</p></div>
          </div>
          {!display && payload.settings?.displayModeEnabled ? <a href={`/public/events/${eventId}?display=1`} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20"><Maximize2 className="h-4 w-4" />Display mode</a> : null}
        </div>
        {payload.settings?.publicMessage ? <div className="mt-5 rounded-xl bg-white/10 p-4 text-emerald-50">{payload.settings.publicMessage}</div> : null}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Registered" value={payload.stats?.registered ?? 0} icon={Users} />
          <Stat label="Checked In" value={payload.stats?.checkedIn ?? 0} icon={Check} />
          <Stat label="Started" value={payload.stats?.started ?? 0} icon={Target} />
          <Stat label="Finalized" value={payload.stats?.finalized ?? 0} icon={Trophy} />
          <Stat label="Complete" value={`${completion}%`} icon={Medal} />
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${completion}%` }} /></div>
      </div>
    </header>

    <main className={`${display ? "max-w-[1600px]" : "max-w-7xl"} mx-auto px-4 py-6 sm:px-6 lg:px-8`}>
      {!display ? <div className="mb-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_2fr_auto]">
        <select value={shootId} onChange={(event) => setShootId(event.target.value)} className="rounded-xl border px-3 py-2.5"><option value="all">All shoots</option>{payload.shoots?.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name}</option>)}</select>
        <label className="flex items-center gap-2 rounded-xl border px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search athlete, team, class, or squad" className="min-w-0 flex-1 py-2.5 outline-none" /></label>
        <button onClick={() => void load()} className="rounded-xl border px-3"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button>
      </div> : null}

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {([['overall','Overall'],['class','Class'],['team','Teams'],['squads','Squads'],['awards','Awards']] as const).filter(([key]) => key !== 'team' || payload.settings?.showTeams).filter(([key]) => key !== 'squads' || payload.settings?.showSquads).filter(([key]) => key !== 'awards' || payload.settings?.showAwards).map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`shrink-0 rounded-full px-4 py-2 font-bold ${tab === key ? "bg-emerald-700 text-white" : "bg-white shadow-sm"}`}>{label}</button>)}
      </div>

      {tab === "overall" ? <ScoreTable rows={visibleScores} empty={payload.settings?.showLiveScores ? "No scores have been entered." : "Live scores are currently hidden by tournament staff."} /> : null}
      {tab === "class" ? <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Class Place</th><th className="p-4">Athlete</th><th className="p-4">Class</th><th className="p-4 text-right">Score</th></tr></thead><tbody>{classRows.map((row) => <tr key={`${row.registrationShootId}-${row.classCode}`} className="border-t"><td className="p-4 font-black">{row.classPlace}</td><td className="p-4"><p className="font-bold">{row.participantName}</p><p className="text-xs text-slate-500">{row.teamName}</p></td><td className="p-4">{row.classCode}</td><td className="p-4 text-right text-xl font-black">{row.totalScore}</td></tr>)}</tbody></table></section> : null}
      {tab === "team" ? <section className="overflow-hidden rounded-2xl bg-white shadow-sm">{teams.map((team,index) => <div key={team.teamName} className="flex items-center gap-4 border-t p-5 first:border-t-0"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 font-black text-emerald-800">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{team.teamName}</p><p className="text-xs text-slate-500">Top five of {team.members}</p></div><p className="text-2xl font-black">{team.score}</p></div>)}</section> : null}
      {tab === "squads" ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{entries.map((row) => <article key={row.registrationShootId} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase text-emerald-700">Squad {row.squadNumber || "Unassigned"}</p><h3 className="mt-1 font-bold">{row.participantName}</h3><p className="text-sm text-slate-500">{row.teamName} · {row.classCode}</p></div><div className="rounded-xl bg-slate-100 px-3 py-2 text-center"><p className="text-xs text-slate-500">Post</p><p className="font-black">{row.positionLabel || row.post || "—"}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><span>{row.shootName}</span><span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{formatTime(row.startTime)}</span><span>{row.courseName || "Course TBA"}</span><span>{row.checkedIn ? "Checked in" : "Expected"}</span></div></article>)}</section> : null}
      {tab === "awards" ? <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Published Results</h2></div>{awards.map((row,index) => <div key={row.registrationShootId} className="flex items-center gap-4 border-t p-5"><Medal className={index < 3 ? "text-amber-500" : "text-slate-300"} /><div className="flex-1"><p className="font-bold">{row.participantName}</p><p className="text-xs text-slate-500">{row.shootName} · {row.teamName} · {row.classCode}</p></div><p className="text-2xl font-black">{row.totalScore}</p></div>)}{awards.length === 0 ? <p className="p-10 text-center text-slate-500">Official awards have not been published yet.</p> : null}</section> : null}

      <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t py-6 text-xs text-slate-500"><span>Updated {payload.stats?.lastUpdatedAt ? new Date(payload.stats.lastUpdatedAt).toLocaleTimeString() : "when scores arrive"}</span><Link to="/login" className="font-semibold text-emerald-700">Staff login</Link></footer>
    </main>
  </div>
}

function Stat(props: { label: string; value: string | number; icon: typeof Users }) {
  const Icon = props.icon
  return <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-white/15 p-2"><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-black">{props.value}</p><p className="text-xs text-emerald-50/80">{props.label}</p></div></div></div>
}

function ScoreTable(props: { rows: PublicEventPortalEntry[]; empty: string }) {
  return <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Live Standings</h2><p className="text-sm text-slate-500">Finalized scores rank ahead of drafts.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Place</th><th className="p-4">Athlete</th><th className="p-4">Team / Class</th><th className="p-4">Status</th><th className="p-4 text-right">Score</th></tr></thead><tbody>{props.rows.map((row,index) => <tr key={row.registrationShootId} className="border-t"><td className="p-4 font-black">{index + 1}</td><td className="p-4"><p className="font-bold">{row.participantName}</p><p className="text-xs text-slate-500">{row.shootName}</p></td><td className="p-4">{row.teamName}<p className="text-xs text-slate-500">{row.classCode}</p></td><td className="p-4 capitalize">{row.scoreStatus}</td><td className="p-4 text-right"><span className="text-xl font-black">{row.totalScore}</span>{row.totalTargets > 0 ? <span className="text-slate-400"> / {row.totalTargets}</span> : null}</td></tr>)}</tbody></table>{props.rows.length === 0 ? <p className="p-10 text-center text-slate-500">{props.empty}</p> : null}</div></section>
}
