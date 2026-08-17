import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Loader2,
  Medal,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadSeasonTeamRankings,
  type SeasonTeamRankingRow,
} from "@/lib/services/seasonTeamRankings"

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

function formatPoints(value: number) {
  return value.toFixed(2)
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

export function SeasonTeamRankingsPage() {
  const { seasonId } = useParams()
  const [data, setData] = useState<Awaited<ReturnType<typeof loadSeasonTeamRankings>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!seasonId) return
    setLoading(true)
    setError("")
    try {
      setData(await loadSeasonTeamRankings(seasonId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Season team rankings could not be loaded.")
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
      row.teamName.toLowerCase().includes(query) ||
      row.leaders.some((athlete) => athlete.athleteName.toLowerCase().includes(query)),
    )
  }, [data, search])

  function toggle(row: SeasonTeamRankingRow) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(row.teamName)) next.delete(row.teamName)
      else next.add(row.teamName)
      return next
    })
  }

  if (loading) {
    return <PageContainer><div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading season team rankings…</div></PageContainer>
  }

  if (!data) {
    return <PageContainer><div className="rounded-xl border p-6">Season team rankings are unavailable.</div></PageContainer>
  }

  const incompleteTeamResults = data.rows.reduce(
    (sum, row) => sum + row.eventResults.filter((event) => event.athletesEntered > 0 && !event.complete).length,
    0,
  )

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <Link to="/seasons" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Season Management</Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">Season Championships</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">{data.season.name} Team Rankings</h1>
              <p className="mt-2 text-sm text-slate-600">{formatDate(data.season.start_date)} – {formatDate(data.season.end_date)} · {data.events.length} event{data.events.length === 1 ? "" : "s"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/seasons/${data.season.id}/standings`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"><Trophy className="mr-2 h-4 w-4" />Participant Standings</Link>
              <Link to={`/seasons/${data.season.id}/qualification`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">Qualification</Link>
              <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Teams" value={String(data.totals.teams)} detail="Teams represented this season" />
          <Summary label="Team Participants" value={String(data.totals.athletesOnTeams)} detail="Participants assigned to a team" />
          <Summary label="Season Events" value={String(data.totals.events)} detail="Assigned tournaments" />
          <Summary label="Current Leader" value={data.totals.leader ?? "—"} detail={data.totals.leader ? "Provisional season leader" : "No team results yet"} />
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="flex items-start gap-3"><Medal className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Team scoring rule</p><p className="mt-1 text-blue-800">{data.scoringRule}</p><p className="mt-2 text-xs text-blue-700">ClayKeeper currently operates within one organization context, so this sprint ranks teams inside the organization and provides the organization-wide season summary above. Cross-organization competition would require a separate shared-data model.</p></div></div>
        </section>

        {incompleteTeamResults > 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Team standings are provisional.</p><p className="mt-1 text-amber-800">{incompleteTeamResults} team-event result{incompleteTeamResults === 1 ? " is" : "s are"} still incomplete. Only finalized participant results contribute points.</p></div></div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-lg font-bold">Team Season Championship</h2><p className="mt-1 text-sm text-slate-500">Expand a team to audit its counting participants and event results.</p></div>
              <label className="text-sm font-semibold">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Team or participant…" className="mt-1 min-h-10 w-full min-w-64 rounded-lg border border-slate-200 px-3 font-normal" /></label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-14 p-4">#</th><th className="p-4">Team</th><th className="p-4 text-right">Participants</th><th className="p-4 text-right">Events</th><th className="p-4 text-right">Team Points</th><th className="p-4 text-right">Aggregate</th><th className="w-12 p-4" /></tr></thead>
              <tbody className="divide-y">{rows.map((row) => <TeamRows key={row.teamName} row={row} open={expanded.has(row.teamName)} toggle={() => toggle(row)} />)}</tbody>
            </table>
          </div>
          {rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No teams match the current search.</div> : null}
        </section>
      </div>
    </PageContainer>
  )
}

function TeamRows(props: { row: SeasonTeamRankingRow; open: boolean; toggle: () => void }) {
  const row = props.row
  return <>
    <tr className="align-top">
      <td className="p-4 text-lg font-black">{row.rank}</td>
      <td className="p-4"><p className="font-bold text-slate-950">{row.teamName}{row.tied ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Tie</span> : null}</p><p className="mt-1 text-xs text-slate-500">Top {Math.min(5, row.athletes)} participant{Math.min(5, row.athletes) === 1 ? "" : "s"} count</p></td>
      <td className="p-4 text-right"><p className="font-bold">{row.athletes}</p><p className="text-xs text-slate-500">{row.athletesCounted} with finalized results</p></td>
      <td className="p-4 text-right"><p className="font-bold">{row.eventsRepresented}</p><p className="text-xs text-slate-500">represented</p></td>
      <td className="p-4 text-right text-xl font-black">{formatPoints(row.seasonPoints)}</td>
      <td className="p-4 text-right"><p className="font-bold">{formatPercent(row.aggregatePercentage)}</p><p className="text-xs text-slate-500">{row.totalScore}/{row.totalTargets}</p></td>
      <td className="p-4"><button type="button" onClick={props.toggle} className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50" aria-label={props.open ? "Hide team audit" : "Show team audit"}>{props.open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
    </tr>
    {props.open ? <tr className="bg-slate-50/70"><td colSpan={7} className="p-4"><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-700" /><h3 className="font-bold">Counting Participants</h3></div><div className="mt-3 space-y-2">{row.leaders.map((athlete, index) => <div key={athlete.athleteId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><div><span className="mr-2 font-bold">{index + 1}.</span>{athlete.athleteName}</div><div className="text-right"><p className="font-bold">{formatPoints(athlete.seasonPoints)}</p><p className="text-xs text-slate-500">{athlete.eventsCounted} event{athlete.eventsCounted === 1 ? "" : "s"}</p></div></div>)}</div></div><div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-emerald-700" /><h3 className="font-bold">Event Audit</h3></div><div className="mt-3 space-y-2">{row.eventResults.map((event) => <div key={event.eventId} className="rounded-lg border border-slate-100 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{event.eventName}</p><p className="text-xs text-slate-500">{formatDate(event.startDate)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${event.complete ? "bg-emerald-100 text-emerald-800" : event.athletesEntered > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{event.complete ? "Complete" : event.athletesEntered > 0 ? "Provisional" : "No Entry"}</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-500">Participants</p><p className="font-bold">{event.athletesCounted}/{event.athletesEntered}</p></div><div><p className="text-slate-500">Team Points</p><p className="font-bold">{formatPoints(event.teamPoints)}</p></div><div><p className="text-slate-500">Average</p><p className="font-bold">{formatPercent(event.averagePercentage)}</p></div></div></div>)}</div></div></div></td></tr> : null}
  </>
}

function Summary(props: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{props.label}</p><p className="mt-1 text-2xl font-black text-slate-950">{props.value}</p><p className="mt-1 text-xs text-slate-500">{props.detail}</p></div>
}
