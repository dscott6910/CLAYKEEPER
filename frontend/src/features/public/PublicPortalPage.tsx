import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import {
  CalendarDays,
  Check,
  Clipboard,
  Clock3,
  MapPin,
  Medal,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Target,
  Trophy,
  Users,
} from "lucide-react"

import {
  loadPublicTournamentPortal,
  type PublicEntry,
  type PublicPortalPayload,
} from "@/lib/services/publicPortal"

const EMPTY: PublicPortalPayload = {
  organization: null,
  events: [],
  selectedEvent: null,
  shoots: [],
  entries: [],
  stats: {},
}

function formatDate(value: string | null) {
  if (!value) return "Date to be announced"
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function formatTime(value: string | null) {
  if (!value) return "TBA"
  const [hour, minute] = value.split(":").map(Number)
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, hour, minute))
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white/15 p-2"><Icon className="h-5 w-5" /></div>
        <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-emerald-50/80">{label}</p></div>
      </div>
    </div>
  )
}

function rankEntries(entries: PublicEntry[]) {
  return [...entries].sort((a, b) => b.totalScore - a.totalScore || b.shootOffTotal - a.shootOffTotal || a.participantName.localeCompare(b.participantName))
}

export function PublicPortalPage() {
  const { organizationSlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const eventId = searchParams.get("event") || undefined
  const [payload, setPayload] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [shootId, setShootId] = useState("all")
  const [activeView, setActiveView] = useState<"leaderboard" | "squads" | "teams" | "results">("leaderboard")
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await loadPublicTournamentPortal(organizationSlug, eventId)
      setPayload(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the public tournament portal.")
    } finally {
      setLoading(false)
    }
  }, [organizationSlug, eventId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return payload.entries.filter((entry) => {
      if (shootId !== "all" && entry.shootId !== shootId) return false
      if (!needle) return true
      return [entry.participantName, entry.teamName, entry.classCode, entry.squadNumber, entry.shootName].some((value) => value?.toLowerCase().includes(needle))
    })
  }, [payload.entries, query, shootId])

  const leaderboard = useMemo(() => rankEntries(visibleEntries), [visibleEntries])
  const teamStandings = useMemo(() => {
    const groups = new Map<string, PublicEntry[]>()
    visibleEntries.forEach((entry) => groups.set(entry.teamName, [...(groups.get(entry.teamName) ?? []), entry]))
    return [...groups.entries()].map(([teamName, members]) => ({
      teamName,
      members: members.length,
      score: rankEntries(members).slice(0, 5).reduce((sum, entry) => sum + entry.totalScore, 0),
    })).sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName))
  }, [visibleEntries])

  const squadRows = useMemo(() => [...visibleEntries].sort((a, b) => (a.squadNumber || "ZZZ").localeCompare(b.squadNumber || "ZZZ", undefined, { numeric: true }) || (a.post ?? 99) - (b.post ?? 99)), [visibleEntries])
  const results = useMemo(() => leaderboard.filter((entry) => entry.awardPublished), [leaderboard])

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (loading && !payload.organization) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><RefreshCw className="mr-3 h-6 w-6 animate-spin" /> Loading tournament portal…</div>
  }

  if (error && !payload.organization) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="max-w-lg rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-bold">Public portal unavailable</h1><p className="mt-2 text-slate-600">{error}</p><button className="mt-5 rounded-lg bg-emerald-700 px-4 py-2 text-white" onClick={() => void load()}>Try again</button></div></div>
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <header className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 text-white print:bg-white print:text-black">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {payload.organization?.logoUrl ? <img src={payload.organization.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1" /> : <div className="rounded-2xl bg-white/15 p-3"><Target className="h-8 w-8" /></div>}
              <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">ClayKeeper Live</p><h1 className="text-2xl font-bold sm:text-3xl">{payload.organization?.name ?? "Tournament Portal"}</h1></div>
            </div>
            <div className="flex gap-2 print:hidden">
              <button onClick={() => void copyLink()} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? "Copied" : "Copy link"}</button>
              <button onClick={() => navigator.share?.({ title: payload.selectedEvent?.name || "ClayKeeper", url: window.location.href })} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20"><Share2 className="h-4 w-4" />Share</button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-emerald-900"><Printer className="h-4 w-4" />Print</button>
            </div>
          </div>

          {payload.selectedEvent && <div className="mt-8"><p className="text-emerald-100">{payload.selectedEvent.seriesName || "Public tournament information"}</p><h2 className="mt-1 text-3xl font-black sm:text-5xl">{payload.selectedEvent.name}</h2><div className="mt-3 flex flex-wrap gap-4 text-sm text-emerald-50"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatDate(payload.selectedEvent.startDate)}</span>{payload.selectedEvent.sponsorName && <span>Sponsored by {payload.selectedEvent.sponsorName}</span>}<span className="rounded-full bg-white/15 px-3 py-1 capitalize">{payload.selectedEvent.status.replaceAll("_", " ")}</span></div></div>}

          <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Registered" value={payload.stats.registeredParticipants ?? 0} icon={Users} />
            <StatCard label="Checked In" value={payload.stats.checkedInParticipants ?? 0} icon={Check} />
            <StatCard label="Squads" value={payload.stats.totalSquads ?? 0} icon={Target} />
            <StatCard label="Completed" value={payload.stats.completedSquads ?? 0} icon={Trophy} />
            <StatCard label="Results Published" value={payload.stats.publishedShoots ?? 0} icon={Medal} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_2fr_auto] print:hidden">
          <select value={eventId ?? payload.selectedEvent?.id ?? ""} onChange={(event) => setSearchParams(event.target.value ? { event: event.target.value } : {})} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5">
            {payload.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
          <select value={shootId} onChange={(event) => setShootId(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="all">All shoots</option>{payload.shoots.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name}</option>)}</select>
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search participant, team, class, or squad" className="min-w-0 flex-1 py-2.5 outline-none" /></label>
          <button onClick={() => void load()} className="rounded-xl border border-slate-300 px-3 hover:bg-slate-50" title="Refresh"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto print:hidden">
          {([['leaderboard','Live Scores',Trophy],['squads','Squad Lookup',Target],['teams','Team Standings',Users],['results','Published Results',Medal]] as const).map(([key,label,Icon]) => <button key={key} onClick={() => setActiveView(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${activeView === key ? "bg-emerald-700 text-white" : "bg-white text-slate-700 shadow-sm"}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>

        {activeView === "leaderboard" && <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h3 className="text-xl font-bold">Live Scores</h3><p className="text-sm text-slate-500">Automatically refreshes every 30 seconds. Shoot-off totals break tied regulation scores.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Place</th><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Team / Class</th><th className="px-4 py-3">Shoot</th><th className="px-4 py-3 text-right">Score</th></tr></thead><tbody>{leaderboard.map((entry,index) => <tr key={entry.registrationShootId} className="border-t"><td className="px-4 py-3 font-bold">{index + 1}</td><td className="px-4 py-3"><div className="font-semibold">{entry.participantName}</div><div className="text-xs text-slate-500">{entry.scoreRounds}/{entry.expectedRounds} rounds</div></td><td className="px-4 py-3">{entry.teamName}<div className="text-xs text-slate-500">{entry.classCode}</div></td><td className="px-4 py-3">{entry.shootName}</td><td className="px-4 py-3 text-right"><span className="text-lg font-black">{entry.totalScore}</span>{entry.shootOffTotal > 0 && <div className="text-xs text-emerald-700">SO {entry.shootOffTotal}</div>}</td></tr>)}</tbody></table>{leaderboard.length === 0 && <p className="p-10 text-center text-slate-500">No scores match the current filters.</p>}</div></section>}

        {activeView === "squads" && <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{squadRows.map((entry) => <article key={entry.registrationShootId} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Squad {entry.squadNumber || "Unassigned"}</p><h3 className="mt-1 text-lg font-bold">{entry.participantName}</h3><p className="text-sm text-slate-500">{entry.teamName} · {entry.classCode}</p></div><div className="rounded-xl bg-slate-100 px-3 py-2 text-center"><p className="text-xs text-slate-500">Post</p><p className="font-black">{entry.positionLabel || entry.post || "—"}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><span className="flex items-center gap-2"><Target className="h-4 w-4 text-slate-400" />{entry.shootName}</span><span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{formatTime(entry.startTime)}</span><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{entry.houseNumber || entry.courseName || entry.stationName || "Field TBA"}</span><span className="flex items-center gap-2">{entry.checkedIn ? <Check className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-amber-600" />}{entry.checkedIn ? "Checked in" : "Not checked in"}</span></div></article>)}</section>}

        {activeView === "teams" && <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h3 className="text-xl font-bold">Team Standings</h3><p className="text-sm text-slate-500">Sum of each team's top five visible scores.</p></div>{teamStandings.map((team,index) => <div key={team.teamName} className="flex items-center gap-4 border-t px-5 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 font-black text-emerald-800">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{team.teamName}</p><p className="text-xs text-slate-500">{team.members} participant{team.members === 1 ? "" : "s"}</p></div><p className="text-2xl font-black">{team.score}</p></div>)}</section>}

        {activeView === "results" && <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h3 className="text-xl font-bold">Published Results</h3><p className="text-sm text-slate-500">Only shoots published or locked by tournament administration appear here.</p></div>{results.map((entry,index) => <div key={entry.registrationShootId} className="flex items-center gap-4 border-t px-5 py-4"><Medal className={`h-7 w-7 ${index < 3 ? "text-amber-500" : "text-slate-300"}`} /><div className="min-w-0 flex-1"><p className="font-bold">{entry.participantName}</p><p className="text-xs text-slate-500">{entry.shootName} · {entry.teamName} · {entry.classCode}</p>{entry.resultNote && <p className="mt-1 text-sm text-emerald-700">{entry.resultNote}</p>}</div><p className="text-2xl font-black">{entry.totalScore}</p></div>)}{results.length === 0 && <p className="p-10 text-center text-slate-500">No final results have been published for the selected event.</p>}</section>}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-6 text-xs text-slate-500"><p>Live tournament information powered by ClayKeeper.</p><Link to="/login" className="font-semibold text-emerald-700 print:hidden">Staff login</Link></footer>
      </main>
    </div>
  )
}
