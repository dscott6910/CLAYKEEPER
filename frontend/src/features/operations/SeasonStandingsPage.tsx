import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Loader2,
  RefreshCw,
  Trophy,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadSeasonStandings,
  type SeasonStandingRow,
  type SeasonStandingsData,
} from "@/lib/services/seasonStandings"

function formatDate(value: string | null) {
  if (!value) return "Date not set"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function formatPoints(value: number) {
  return value.toFixed(2)
}

export function SeasonStandingsPage() {
  const { seasonId } = useParams()
  const [data, setData] = useState<SeasonStandingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!seasonId) return
    setLoading(true)
    setError("")
    try {
      setData(await loadSeasonStandings(seasonId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Season standings could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [seasonId])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()
    if (!query) return data.rows
    return data.rows.filter((row) =>
      [row.athleteName, row.cyssaNumber, row.teamName, row.classCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [data, search])

  function toggleRow(row: SeasonStandingRow) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(row.athleteId)) next.delete(row.athleteId)
      else next.add(row.athleteId)
      return next
    })
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading season standings…
        </div>
      </PageContainer>
    )
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error || "Season standings are unavailable."}
        </div>
      </PageContainer>
    )
  }

  const unavailableEvents = data.eventSummaries.filter((row) => !row.available)

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <Link to="/seasons" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />Season Management
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">Multi-Event Standings</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">{data.season.name}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {formatDate(data.season.start_date)} – {formatDate(data.season.end_date)} · {data.events.length} event{data.events.length === 1 ? "" : "s"}
              </p>
            </div>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />Refresh
            </Button>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Season Events" value={String(data.totals.events)} detail="Assigned tournaments" />
          <Summary label="Athletes" value={String(data.totals.athletes)} detail="Unique season participants" />
          <Summary label="Completed Results" value={String(data.totals.completedResults)} detail="Fully finalized event results" />
          <Summary label="Incomplete Results" value={String(data.totals.incompleteResults)} detail="Not counted in season points" attention={data.totals.incompleteResults > 0} />
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Sprint 2 scoring rule: normalized percentage points</p>
              <p className="mt-1 text-blue-800">
                Each fully finalized event contributes the athlete&apos;s aggregate hit percentage (0–100) as season points. This keeps events with different target counts comparable without inventing an organization-specific placement schedule. Incomplete event results contribute zero until finalized.
              </p>
            </div>
          </div>
        </section>

        {unavailableEvents.length > 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3 text-amber-900">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="font-bold">Some event scoring data could not be loaded</h2>
                <div className="mt-2 space-y-1 text-sm text-amber-800">
                  {unavailableEvents.map((event) => <p key={event.eventId}>{event.eventName}: {event.error}</p>)}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Event Completion</h2>
              <p className="mt-1 text-sm text-slate-500">Only fully finalized athlete results count toward season standings.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.eventSummaries.map((event) => (
                <Link key={event.eventId} to={`/events/${event.eventId}/live-scoring`} className="min-w-48 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                  <p className="truncate text-sm font-semibold text-slate-900">{event.eventName}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(event.startDate)}</p>
                  <div className="mt-2 flex items-center justify-between text-xs"><span>{event.completedAthletes}/{event.athletes} complete</span><span className="font-bold">{event.completionPercent}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(0, Math.min(100, event.completionPercent))}%` }} /></div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-lg font-bold">Season Standings</h2><p className="mt-1 text-sm text-slate-500">Expand an athlete to audit every event contribution.</p></div>
              <label className="text-sm font-semibold">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Athlete, team, class…" className="mt-1 min-h-10 w-full min-w-64 rounded-lg border border-slate-200 px-3 font-normal" /></label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="w-12 p-4">#</th><th className="p-4">Athlete</th><th className="p-4">Team / Class</th><th className="p-4 text-right">Events</th><th className="p-4 text-right">Season Points</th><th className="p-4 text-right">Average</th><th className="w-12 p-4" /></tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const rank = data.rows.findIndex((candidate) => candidate.athleteId === row.athleteId) + 1
                  const open = expanded.has(row.athleteId)
                  return (
                    <SeasonStandingRows key={row.athleteId} row={row} rank={rank} open={open} toggle={() => toggleRow(row)} />
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No athletes match the current search.</div> : null}
        </section>
      </div>
    </PageContainer>
  )
}

function SeasonStandingRows(props: { row: SeasonStandingRow; rank: number; open: boolean; toggle: () => void }) {
  const { row } = props
  return (
    <>
      <tr className="align-top">
        <td className="p-4 text-lg font-black">{props.rank}</td>
        <td className="p-4"><p className="font-bold text-slate-950">{row.athleteName}{row.tied ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Tie</span> : null}</p><p className="mt-1 text-xs text-slate-500">{row.cyssaNumber ? `CYSSA ${row.cyssaNumber}` : "No CYSSA number"}</p></td>
        <td className="p-4"><p>{row.teamName}</p><p className="mt-1 text-xs text-slate-500">Class {row.classCode}</p></td>
        <td className="p-4 text-right"><p className="font-bold">{row.eventsCounted} / {row.eventsEntered}</p><p className="text-xs text-slate-500">counted / entered</p></td>
        <td className="p-4 text-right text-xl font-black">{formatPoints(row.seasonPoints)}</td>
        <td className="p-4 text-right"><p className="font-bold">{formatPercent(row.averagePercentage)}</p><p className="text-xs text-slate-500">{row.totalScore}/{row.totalTargets} finalized</p></td>
        <td className="p-4"><button type="button" onClick={props.toggle} className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50" aria-label={props.open ? "Hide event contributions" : "Show event contributions"}>{props.open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
      </tr>
      {props.open ? (
        <tr className="bg-slate-50/70"><td colSpan={7} className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{row.contributions.map((contribution) => <div key={contribution.eventId} className={`rounded-xl border bg-white p-4 ${contribution.complete ? "border-emerald-200" : "border-amber-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{contribution.eventName}</p><p className="mt-1 text-xs text-slate-500">{formatDate(contribution.startDate)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${contribution.complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{contribution.complete ? `#${contribution.place ?? "—"}` : "Incomplete"}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-slate-500">Score</p><p className="font-bold">{contribution.complete ? `${contribution.score}/${contribution.targets}` : "—"}</p></div><div><p className="text-xs text-slate-500">Percent</p><p className="font-bold">{contribution.complete ? formatPercent(contribution.percentage) : "—"}</p></div><div><p className="text-xs text-slate-500">Points</p><p className="font-bold">{formatPoints(contribution.points)}</p></div></div><p className="mt-2 text-xs text-slate-500">{contribution.finalizedScorecards}/{contribution.expectedScorecards} scorecards finalized</p></div>)}</div></td></tr>
      ) : null}
    </>
  )
}

function Summary(props: { label: string; value: string; detail: string; attention?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-4 shadow-sm ${props.attention ? "border-amber-300" : ""}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{props.label}</p><p className="mt-1 text-2xl font-black text-slate-950">{props.value}</p><p className={`mt-1 text-xs ${props.attention ? "font-semibold text-amber-700" : "text-slate-500"}`}>{props.detail}</p></div>
}
