import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  GraduationCap,
  Loader2,
  RefreshCw,
  Save,
  Trophy,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadSeasonQualification,
  saveSeasonQualificationSettings,
  type QualificationStatus,
  type SeasonQualificationData,
  type SeasonQualificationRow,
} from "@/lib/services/seasonQualification"

const inputClass =
  "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"

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

function statusLabel(status: QualificationStatus) {
  if (status === "qualified") return "Qualified"
  if (status === "on_track") return "On Track"
  if (status === "at_risk") return "At Risk"
  if (status === "not_qualified") return "Not Qualified"
  return "Tracking Disabled"
}

function statusClasses(status: QualificationStatus) {
  if (status === "qualified") return "bg-emerald-100 text-emerald-800"
  if (status === "on_track") return "bg-blue-100 text-blue-800"
  if (status === "at_risk") return "bg-amber-100 text-amber-800"
  if (status === "not_qualified") return "bg-red-100 text-red-800"
  return "bg-slate-200 text-slate-700"
}

export function SeasonQualificationPage() {
  const { seasonId } = useParams()
  const [data, setData] = useState<SeasonQualificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<QualificationStatus | "all">("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [enabled, setEnabled] = useState(false)
  const [minEvents, setMinEvents] = useState(3)
  const [notes, setNotes] = useState("")

  const load = useCallback(async () => {
    if (!seasonId) return
    setLoading(true)
    setError("")
    try {
      const next = await loadSeasonQualification(seasonId)
      setData(next)
      setEnabled(next.season.qualification_enabled)
      setMinEvents(next.season.qualification_min_events || 3)
      setNotes(next.season.qualification_notes ?? "")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Season qualification could not be loaded.")
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
    return data.rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false
      if (!query) return true
      return [row.athleteName, row.cyssaNumber, row.teamName, row.classCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [data, search, statusFilter])

  function toggle(row: SeasonQualificationRow) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(row.athleteId)) next.delete(row.athleteId)
      else next.add(row.athleteId)
      return next
    })
  }

  async function saveSettings() {
    if (!seasonId) return
    setSaving(true)
    try {
      await saveSeasonQualificationSettings({ seasonId, enabled, minEvents, notes })
      toast.success("Qualification rules saved.")
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Qualification rules could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageContainer><div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading qualification tracking…</div></PageContainer>
  }

  if (!data) {
    return <PageContainer><div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || "Qualification tracking is unavailable."}</div></PageContainer>
  }

  const locked = data.season.status === "archived"

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <Link to="/seasons" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Season Management</Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">Season Eligibility</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">{data.season.name} Qualification</h1>
              <p className="mt-2 text-sm text-slate-600">{formatDate(data.season.start_date)} – {formatDate(data.season.end_date)} · {data.events.length} event{data.events.length === 1 ? "" : "s"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/seasons/${data.season.id}/standings`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"><Trophy className="mr-2 h-4 w-4" />Standings</Link>
              <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Summary label="Athletes" value={String(data.totals.athletes)} detail="Season participants" />
          <Summary label="Qualified" value={String(data.totals.qualified)} detail="Minimum completed" />
          <Summary label="On Track" value={String(data.totals.onTrack)} detail="Qualification still comfortable" />
          <Summary label="At Risk" value={String(data.totals.atRisk)} detail="Little margin remaining" attention={data.totals.atRisk > 0} />
          <Summary label="Not Qualified" value={String(data.totals.notQualified)} detail="Cannot currently reach minimum" attention={data.totals.notQualified > 0} danger={data.totals.notQualified > 0} />
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><GraduationCap className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold">Qualification Rules</h2><p className="mt-1 text-sm text-slate-500">A qualifying event counts only after all of that athlete&apos;s assigned scorecards for the tournament are finalized.</p></div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_240px_1fr] lg:items-end">
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-semibold"><input type="checkbox" checked={enabled} disabled={locked} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />Enable qualification tracking</label>
            <label className="text-sm font-semibold">Minimum completed events<input type="number" min={1} max={100} value={minEvents} disabled={locked} onChange={(event) => setMinEvents(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className={`${inputClass} mt-1`} /></label>
            <label className="text-sm font-semibold">Director notes<input value={notes} disabled={locked} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Top qualifiers advance to State Finals" className={`${inputClass} mt-1`} /></label>
          </div>
          <div className="mt-4 flex justify-end"><Button onClick={() => void saveSettings()} disabled={saving || locked}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Qualification Rules</Button></div>
        </section>

        {locked ? (
          <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Historical qualification rules are locked.</p><p className="mt-1 text-emerald-800">This season has been finalized and archived. Qualification settings are read-only to preserve the historical championship record.</p></div></section>
        ) : null}

        {!data.season.qualification_enabled ? (
          <section className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Qualification tracking is currently disabled.</p><p className="mt-1 text-blue-800">You can review participation below, but ClayKeeper will not label athletes Qualified, On Track, At Risk, or Not Qualified until the rule is enabled.</p></div></section>
        ) : null}

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="text-lg font-bold">Athlete Qualification Progress</h2><p className="mt-1 text-sm text-slate-500">Expand an athlete for the event-by-event audit trail.</p></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm font-semibold">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as QualificationStatus | "all")} className={`${inputClass} mt-1 min-w-48`}><option value="all">All statuses</option><option value="qualified">Qualified</option><option value="on_track">On Track</option><option value="at_risk">At Risk</option><option value="not_qualified">Not Qualified</option><option value="tracking_disabled">Tracking Disabled</option></select></label>
                <label className="text-sm font-semibold">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Athlete, team, class…" className={`${inputClass} mt-1 min-w-64`} /></label>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Athlete</th><th className="p-4">Team / Class</th><th className="p-4">Status</th><th className="p-4 text-right">Completed</th><th className="p-4">Progress</th><th className="p-4 text-right">Needed</th><th className="w-12 p-4" /></tr></thead>
              <tbody className="divide-y">{rows.map((row) => <QualificationRow key={row.athleteId} row={row} open={expanded.has(row.athleteId)} toggle={() => toggle(row)} />)}</tbody>
            </table>
          </div>
          {rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No athletes match the current filters.</div> : null}
        </section>
      </div>
    </PageContainer>
  )
}

function QualificationRow(props: { row: SeasonQualificationRow; open: boolean; toggle: () => void }) {
  const row = props.row
  return <>
    <tr className="align-top">
      <td className="p-4"><p className="font-bold text-slate-950">{row.athleteName}</p><p className="mt-1 text-xs text-slate-500">{row.cyssaNumber ? `Participant # ${row.cyssaNumber}` : "No participant number"}</p></td>
      <td className="p-4"><p>{row.teamName}</p><p className="mt-1 text-xs text-slate-500">Class {row.classCode}</p></td>
      <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(row.status)}`}>{statusLabel(row.status)}</span>{row.incompleteEnteredEvents > 0 ? <p className="mt-2 text-xs font-semibold text-amber-700">{row.incompleteEnteredEvents} entered result{row.incompleteEnteredEvents === 1 ? "" : "s"} incomplete</p> : null}</td>
      <td className="p-4 text-right"><p className="text-lg font-black">{row.completedEvents} / {row.minimumEvents}</p><p className="text-xs text-slate-500">events</p></td>
      <td className="p-4"><div className="min-w-44"><div className="flex justify-between text-xs"><span>{row.progressPercent}%</span><span>{row.availableEvents} available</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.status === "not_qualified" ? "bg-red-500" : row.status === "at_risk" ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${row.progressPercent}%` }} /></div></div></td>
      <td className="p-4 text-right"><p className="font-bold">{row.eventsNeeded}</p><p className="text-xs text-slate-500">more event{row.eventsNeeded === 1 ? "" : "s"}</p></td>
      <td className="p-4"><button type="button" onClick={props.toggle} className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50" aria-label={props.open ? "Hide qualification audit" : "Show qualification audit"}>{props.open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
    </tr>
    {props.open ? <tr className="bg-slate-50/70"><td colSpan={7} className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{row.audits.map((audit) => <div key={audit.eventId} className={`rounded-xl border bg-white p-4 ${audit.state === "complete" ? "border-emerald-200" : audit.state === "incomplete" ? "border-amber-200" : "border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{audit.eventName}</p><p className="mt-1 text-xs text-slate-500">{formatDate(audit.startDate)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${audit.state === "complete" ? "bg-emerald-100 text-emerald-800" : audit.state === "incomplete" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{audit.state === "complete" ? "Counts" : audit.state === "incomplete" ? "Incomplete" : "Not Entered"}</span></div>{audit.state === "complete" ? <div className="mt-3 flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{audit.score}/{audit.targets} · {audit.percentage.toFixed(2)}%</div> : audit.state === "incomplete" ? <div className="mt-3 flex items-center gap-2 text-sm text-amber-800"><CircleAlert className="h-4 w-4" />Finish all assigned scorecards for this event to count.</div> : <p className="mt-3 text-sm text-slate-500">No season contribution recorded for this athlete.</p>}<Link to={`/events/${audit.eventId}/digital-scoring`} className="mt-3 inline-flex text-xs font-bold text-emerald-700 hover:text-emerald-900">Open event scoring →</Link></div>)}</div></td></tr> : null}
  </>
}

function Summary(props: { label: string; value: string; detail: string; attention?: boolean; danger?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-4 shadow-sm ${props.danger ? "border-red-300" : props.attention ? "border-amber-300" : ""}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{props.label}</p><p className="mt-1 text-2xl font-black text-slate-950">{props.value}</p><p className={`mt-1 text-xs ${props.danger ? "font-semibold text-red-700" : props.attention ? "font-semibold text-amber-700" : "text-slate-500"}`}>{props.detail}</p></div>
}
