import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  Lock,
  Printer,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  buildSeasonFinalCsv,
  finalizeSeason,
  loadSeasonFinals,
  type SeasonFinalRecord,
} from "@/lib/services/seasonFinals"

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

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "season"
}

export function SeasonFinalsPage() {
  const { seasonId } = useParams()
  const [data, setData] = useState<Awaited<ReturnType<typeof loadSeasonFinals>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState("")

  const load = useCallback(async () => {
    if (!seasonId) return
    setLoading(true)
    setError("")
    try {
      setData(await loadSeasonFinals(seasonId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Season finals could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [seasonId])

  useEffect(() => {
    void load()
  }, [load])

  const draft = data?.mode === "draft" ? data : null
  const record = data?.mode === "finalized" ? data.record : null

  const previewRecord = useMemo<SeasonFinalRecord | null>(() => {
    if (!draft) return null
    return {
      id: "preview",
      organization_id: draft.standings.events[0]?.organization_id ?? "",
      season_id: draft.standings.season.id,
      season_name: draft.standings.season.name,
      season_start_date: draft.standings.season.start_date,
      season_end_date: draft.standings.season.end_date,
      scoring_rule: draft.teams.scoringRule,
      individual_standings: draft.individualRows,
      team_standings: draft.teams.rows,
      qualification_snapshot: {
        enabled: draft.qualification.season.qualification_enabled,
        minimumEvents: draft.qualification.season.qualification_min_events,
        notes: draft.qualification.season.qualification_notes,
        totals: draft.qualification.totals,
        rows: draft.qualification.rows,
      },
      event_snapshot: draft.standings.eventSummaries,
      summary: {
        events: draft.standings.totals.events,
        athletes: draft.standings.totals.athletes,
        teams: draft.teams.totals.teams,
        completedResults: draft.standings.totals.completedResults,
        incompleteResults: draft.standings.totals.incompleteResults,
        unavailableEvents: draft.unavailableEvents,
        individualChampions: draft.individualChampions.map((row) => row.athleteName),
        teamChampions: draft.teamChampions.map((row) => row.teamName),
      },
      finalized_at: new Date().toISOString(),
      finalized_by: null,
      created_at: new Date().toISOString(),
    }
  }, [draft])

  async function handleFinalize() {
    if (!seasonId || !draft || confirmation !== "FINALIZE") return
    setFinalizing(true)
    try {
      await finalizeSeason({ seasonId, draft })
      toast.success("Season finalized and historical championship records locked.")
      setConfirmation("")
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Season could not be finalized.")
    } finally {
      setFinalizing(false)
    }
  }

  function exportCsv(source: SeasonFinalRecord) {
    downloadText(`${slug(source.season_name)}-final-results.csv`, buildSeasonFinalCsv(source))
  }

  if (loading) {
    return <PageContainer><div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading season finals…</div></PageContainer>
  }

  if (!data) {
    return <PageContainer><div className="rounded-xl border p-6">Season finals are unavailable.</div></PageContainer>
  }

  const seasonName = record?.season_name ?? draft?.standings.season.name ?? "Season"
  const startDate = record?.season_start_date ?? draft?.standings.season.start_date ?? null
  const endDate = record?.season_end_date ?? draft?.standings.season.end_date ?? null
  const individualRows = record?.individual_standings ?? draft?.individualRows ?? []
  const teamRows = record?.team_standings ?? draft?.teams.rows ?? []
  const individualChampions = record
    ? record.individual_standings.filter((row) => row.rank === 1 && row.eventsCounted > 0)
    : draft?.individualChampions ?? []
  const teamChampions = record
    ? record.team_standings.filter((row) => row.rank === 1 && row.athletesCounted > 0)
    : draft?.teamChampions ?? []

  return (
    <PageContainer>
      <div className="space-y-6 print:space-y-4">
        <header className="rounded-2xl border bg-white p-6 shadow-sm print:shadow-none">
          <Link to="/seasons" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 print:hidden"><ArrowLeft className="h-4 w-4" />Season Management</Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">Season Championships</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">{seasonName} Finals</h1>
              <p className="mt-2 text-sm text-slate-600">{formatDate(startDate)} – {formatDate(endDate)}</p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link to={`/seasons/${seasonId}/standings`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">Standings</Link>
              <Link to={`/seasons/${seasonId}/teams`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">Teams</Link>
              <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {record ? (
          <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
            <div className="flex items-start gap-3"><Lock className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="font-bold">Historical record locked</h2><p className="mt-1 text-sm text-emerald-800">Finalized {formatDateTime(record.finalized_at)}. The standings below are the frozen championship record and no longer recalculate from live tournament data.</p></div></div>
          </section>
        ) : draft?.readyToFinalize ? (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
            <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="font-bold">Season is ready for finalization</h2><p className="mt-1 text-sm text-blue-800">All available participant-event results are complete. Finalization will freeze the individual, team, qualification, and event summaries shown here.</p></div></div>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="font-bold">Season cannot be finalized yet</h2><div className="mt-2 space-y-1 text-sm text-amber-800">{draft?.blockers.map((blocker) => <p key={blocker}>• {blocker}</p>)}</div></div></div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Events" value={String(record?.summary.events ?? draft?.standings.totals.events ?? 0)} detail="Season tournaments" />
          <Summary label="Participants" value={String(record?.summary.athletes ?? draft?.standings.totals.athletes ?? 0)} detail="Season participants" />
          <Summary label="Teams" value={String(record?.summary.teams ?? draft?.teams.totals.teams ?? 0)} detail="Ranked teams" />
          <Summary label="Record Status" value={record ? "Final" : "Provisional"} detail={record ? "Frozen historical results" : "Still calculated from live data"} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5 shadow-sm print:shadow-none">
            <div className="flex items-center gap-3"><Trophy className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-bold">Individual Champion{individualChampions.length === 1 ? "" : "s"}</h2></div>
            <div className="mt-4 space-y-3">{individualChampions.map((row) => <div key={row.athleteId} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xl font-black text-slate-950">{row.athleteName}</p><p className="mt-1 text-sm text-slate-600">{row.teamName} · Class {row.classCode}</p><p className="mt-2 text-sm font-bold text-amber-800">{row.seasonPoints.toFixed(2)} season points</p></div>)}{individualChampions.length === 0 ? <p className="text-sm text-slate-500">No individual champion is available yet.</p> : null}</div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm print:shadow-none">
            <div className="flex items-center gap-3"><Users className="h-5 w-5 text-emerald-700" /><h2 className="text-lg font-bold">Team Champion{teamChampions.length === 1 ? "" : "s"}</h2></div>
            <div className="mt-4 space-y-3">{teamChampions.map((row) => <div key={row.teamName} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xl font-black text-slate-950">{row.teamName}</p><p className="mt-1 text-sm text-slate-600">{row.athletesCounted} counting participants · {row.eventsRepresented} events represented</p><p className="mt-2 text-sm font-bold text-emerald-800">{row.seasonPoints.toFixed(2)} team season points</p></div>)}{teamChampions.length === 0 ? <p className="text-sm text-slate-500">No team champion is available yet.</p> : null}</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm print:shadow-none">
          <div className="border-b p-5"><h2 className="text-lg font-bold">Final Individual Standings</h2><p className="mt-1 text-sm text-slate-500">{record ? "Frozen championship standings." : "Preview of the standings that will be frozen."}</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Rank</th><th className="p-4">Participant</th><th className="p-4">Team / Class</th><th className="p-4 text-right">Events</th><th className="p-4 text-right">Season Points</th><th className="p-4 text-right">Average</th></tr></thead><tbody className="divide-y">{individualRows.map((row) => <tr key={row.athleteId}><td className="p-4 text-lg font-black">{row.rank}{row.tied ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Tie</span> : null}</td><td className="p-4"><p className="font-bold">{row.athleteName}</p><p className="text-xs text-slate-500">{row.cyssaNumber ? `Participant # ${row.cyssaNumber}` : "No participant number"}</p></td><td className="p-4">{row.teamName}<p className="text-xs text-slate-500">Class {row.classCode}</p></td><td className="p-4 text-right">{row.eventsCounted}</td><td className="p-4 text-right font-black">{row.seasonPoints.toFixed(2)}</td><td className="p-4 text-right">{row.averagePercentage.toFixed(2)}%</td></tr>)}</tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm print:shadow-none">
          <div className="border-b p-5"><h2 className="text-lg font-bold">Final Team Standings</h2><p className="mt-1 text-sm text-slate-500">{record ? record.scoring_rule : draft?.teams.scoringRule}</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Rank</th><th className="p-4">Team</th><th className="p-4 text-right">Participants</th><th className="p-4 text-right">Events</th><th className="p-4 text-right">Season Points</th><th className="p-4 text-right">Aggregate</th></tr></thead><tbody className="divide-y">{teamRows.map((row) => <tr key={row.teamName}><td className="p-4 text-lg font-black">{row.rank}{row.tied ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Tie</span> : null}</td><td className="p-4 font-bold">{row.teamName}</td><td className="p-4 text-right">{row.athletesCounted}</td><td className="p-4 text-right">{row.eventsRepresented}</td><td className="p-4 text-right font-black">{row.seasonPoints.toFixed(2)}</td><td className="p-4 text-right">{row.aggregatePercentage.toFixed(2)}%</td></tr>)}</tbody></table></div>
        </section>

        {record ? (
          <section className="flex flex-wrap justify-end gap-2 print:hidden">
            <Button variant="outline" onClick={() => exportCsv(record)}><Download className="h-4 w-4" />Export Final CSV</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / Save PDF</Button>
          </section>
        ) : previewRecord ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 print:hidden">
            <div className="flex items-start gap-3"><Lock className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><div className="flex-1"><h2 className="font-bold text-red-950">Finalize Historical Season Record</h2><p className="mt-1 text-sm text-red-800">This creates a permanent championship snapshot and changes the season status to Archived. Season configuration and event assignments should be treated as locked afterward.</p><label className="mt-4 block max-w-sm text-sm font-semibold text-red-950">Type FINALIZE to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-red-300 bg-white px-3" /></label><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportCsv(previewRecord)}><Download className="h-4 w-4" />Preview CSV</Button><Button onClick={() => void handleFinalize()} disabled={!draft?.readyToFinalize || confirmation !== "FINALIZE" || finalizing}>{finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}Finalize Season</Button></div></div></div>
          </section>
        ) : null}
      </div>
    </PageContainer>
  )
}

function Summary(props: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm print:shadow-none"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{props.label}</p><p className="mt-1 text-2xl font-black text-slate-950">{props.value}</p><p className="mt-1 text-xs text-slate-500">{props.detail}</p></div>
}
