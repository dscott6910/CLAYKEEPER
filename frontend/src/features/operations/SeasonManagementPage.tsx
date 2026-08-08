import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Unlink,
} from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  activateSeason,
  assignEventToSeason,
  createSeason,
  listSeasonEvents,
  listSeasons,
  updateSeason,
  type Season,
  type SeasonEvent,
} from "@/lib/services/seasons"

const inputClass =
  "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"

const currentYear = new Date().getFullYear()

function defaultDates() {
  return {
    name: `${currentYear} Season`,
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`,
  }
}

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

function statusClasses(status: Season["status"]) {
  if (status === "active") return "bg-emerald-100 text-emerald-800"
  if (status === "planning") return "bg-blue-100 text-blue-800"
  if (status === "closed") return "bg-slate-200 text-slate-700"
  return "bg-amber-100 text-amber-800"
}

function eventLabel(event: SeasonEvent) {
  const detail = [event.discipline, event.event_type, event.location_name]
    .filter(Boolean)
    .join(" · ")
  return detail || event.name
}

export function SeasonManagementPage() {
  const defaults = defaultDates()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [events, setEvents] = useState<SeasonEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  const [name, setName] = useState(defaults.name)
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [makeActive, setMakeActive] = useState(true)

  const [editing, setEditing] = useState<Season | null>(null)
  const [editName, setEditName] = useState("")
  const [editStart, setEditStart] = useState("")
  const [editEnd, setEditEnd] = useState("")
  const [selectedSeasonId, setSelectedSeasonId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [nextSeasons, nextEvents] = await Promise.all([
        listSeasons(),
        listSeasonEvents(),
      ])
      setSeasons(nextSeasons)
      setEvents(nextEvents)
      setSelectedSeasonId((current) => {
        if (current && nextSeasons.some((season) => season.id === current)) {
          return current
        }
        return nextSeasons.find((season) => season.status === "active")?.id ?? nextSeasons[0]?.id ?? ""
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Season management could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activeSeason = seasons.find((season) => season.status === "active") ?? null
  const unassignedEvents = events.filter((event) => !event.season_id)
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId) ?? null
  const selectedEvents = events.filter((event) => event.season_id === selectedSeasonId)

  const seasonCounts = useMemo(() => {
    return new Map(
      seasons.map((season) => [
        season.id,
        events.filter((event) => event.season_id === season.id).length,
      ]),
    )
  }, [events, seasons])

  async function handleCreate() {
    setBusy("create")
    setError("")
    try {
      const id = await createSeason({ name, startDate, endDate, makeActive })
      toast.success(`${name.trim()} created.`)
      const nextDefaults = defaultDates()
      setName(nextDefaults.name)
      setStartDate(nextDefaults.startDate)
      setEndDate(nextDefaults.endDate)
      await load()
      setSelectedSeasonId(id)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Season could not be created."
      setError(message)
      toast.error(message)
    } finally {
      setBusy("")
    }
  }

  function beginEdit(season: Season) {
    setEditing(season)
    setEditName(season.name)
    setEditStart(season.start_date)
    setEditEnd(season.end_date)
  }

  async function handleUpdate() {
    if (!editing) return
    setBusy(`edit:${editing.id}`)
    try {
      await updateSeason({
        id: editing.id,
        name: editName,
        startDate: editStart,
        endDate: editEnd,
      })
      toast.success("Season updated.")
      setEditing(null)
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Season could not be updated.")
    } finally {
      setBusy("")
    }
  }

  async function handleActivate(season: Season) {
    if (!window.confirm(`Make ${season.name} the active season? The currently active season will be closed.`)) return
    setBusy(`activate:${season.id}`)
    try {
      await activateSeason(season.id)
      toast.success(`${season.name} is now active.`)
      await load()
      setSelectedSeasonId(season.id)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Season could not be activated.")
    } finally {
      setBusy("")
    }
  }

  async function handleAssignment(event: SeasonEvent, seasonId: string | null) {
    setBusy(`event:${event.id}`)
    try {
      await assignEventToSeason({ eventId: event.id, seasonId })
      setEvents((current) =>
        current.map((row) => (row.id === event.id ? { ...row, season_id: seasonId } : row)),
      )
      toast.success(seasonId ? `${event.name} assigned to season.` : `${event.name} removed from its season.`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Event assignment could not be saved.")
    } finally {
      setBusy("")
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading season management…
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">Multi-Event Management</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">Season Management</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Create seasons, choose the active season, and group ClayKeeper tournaments into the correct season before cumulative standings are introduced.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/events"
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <CalendarDays className="mr-2 h-4 w-4" />Events
              </Link>
              <Link
                to="/operations"
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Historical Imports
              </Link>
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />Refresh
              </Button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <Summary label="Active Season" value={activeSeason?.name ?? "None"} detail={activeSeason ? `${formatDate(activeSeason.start_date)} – ${formatDate(activeSeason.end_date)}` : "Create or activate a season"} />
          <Summary label="Seasons" value={String(seasons.length)} detail={`${seasons.filter((season) => season.status === "planning").length} planning · ${seasons.filter((season) => season.status === "closed").length} closed`} />
          <Summary label="Unassigned Events" value={String(unassignedEvents.length)} detail={unassignedEvents.length ? "Assign these before season standings" : "All events are grouped"} attention={unassignedEvents.length > 0} />
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><CalendarPlus className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold">Create Season</h2>
              <p className="text-sm text-slate-500">Only one season can be active at a time.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-semibold">Season name<input className={`${inputClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="text-sm font-semibold">Start date<input className={`${inputClass} mt-1`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label className="text-sm font-semibold">End date<input className={`${inputClass} mt-1`} type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={makeActive} onChange={(event) => setMakeActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Make this the active season immediately
            </label>
            <Button onClick={() => void handleCreate()} disabled={busy === "create" || !name.trim() || !startDate || !endDate || endDate < startDate}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              Create Season
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold">Season Directory</h2>
            <p className="mt-1 text-sm text-slate-500">Review season dates, status, and tournament counts.</p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {seasons.map((season) => (
              <article key={season.id} className={`rounded-xl border p-4 ${selectedSeasonId === season.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                <button type="button" className="w-full text-left" onClick={() => setSelectedSeasonId(season.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-bold text-slate-950">{season.name}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(season.start_date)} – {formatDate(season.end_date)}</p></div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${statusClasses(season.status)}`}>{season.status}</span>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">{seasonCounts.get(season.id) ?? 0} event{(seasonCounts.get(season.id) ?? 0) === 1 ? "" : "s"}</p>
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => beginEdit(season)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                  {season.status !== "active" && season.status !== "closed" ? (
                    <Button size="sm" variant="outline" onClick={() => void handleActivate(season)} disabled={busy === `activate:${season.id}`}>
                      {busy === `activate:${season.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Make Active
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
            {seasons.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500 lg:col-span-2 xl:col-span-3">No seasons have been created yet.</div> : null}
          </div>
        </section>

        {editing ? (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-blue-950">Edit {editing.name}</h2><p className="mt-1 text-sm text-blue-800">Updating dates does not remove linked events or historical data.</p></div><button type="button" onClick={() => setEditing(null)} className="text-sm font-semibold text-blue-800">Cancel</button></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input className={inputClass} value={editName} onChange={(event) => setEditName(event.target.value)} />
              <input className={inputClass} type="date" value={editStart} onChange={(event) => setEditStart(event.target.value)} />
              <input className={inputClass} type="date" min={editStart || undefined} value={editEnd} onChange={(event) => setEditEnd(event.target.value)} />
            </div>
            <div className="mt-4 flex justify-end"><Button onClick={() => void handleUpdate()} disabled={busy === `edit:${editing.id}` || !editName.trim() || !editStart || !editEnd || editEnd < editStart}>{busy === `edit:${editing.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Season</Button></div>
          </section>
        ) : null}

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div><h2 className="text-lg font-bold">Event Assignment</h2><p className="mt-1 text-sm text-slate-500">Assign existing tournaments to a season. Event scores, registrations, and reports remain unchanged.</p></div>
            <label className="min-w-64 text-sm font-semibold">View season<select className={`${inputClass} mt-1`} value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)}><option value="">Choose a season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select></label>
          </div>

          {unassignedEvents.length > 0 ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-900"><Unlink className="h-4 w-4" /><h3 className="font-bold">Unassigned Events ({unassignedEvents.length})</h3></div>
              <div className="mt-3 space-y-2">
                {unassignedEvents.map((event) => (
                  <EventAssignmentRow key={event.id} event={event} seasons={seasons} busy={busy === `event:${event.id}`} onAssign={handleAssignment} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />All existing events are assigned to a season.</div>
          )}

          {selectedSeason ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">{selectedSeason.name} Events</h3><p className="text-sm text-slate-500">{selectedEvents.length} assigned tournament{selectedEvents.length === 1 ? "" : "s"}</p></div></div>
              <div className="mt-3 space-y-2">
                {selectedEvents.map((event) => (
                  <EventAssignmentRow key={event.id} event={event} seasons={seasons} busy={busy === `event:${event.id}`} onAssign={handleAssignment} />
                ))}
                {selectedEvents.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">No events are assigned to this season yet.</div> : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </PageContainer>
  )
}

function EventAssignmentRow(props: {
  event: SeasonEvent
  seasons: Season[]
  busy: boolean
  onAssign: (event: SeasonEvent, seasonId: string | null) => Promise<void>
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_240px] md:items-center">
      <div className="min-w-0"><p className="font-semibold text-slate-950">{props.event.name}</p><p className="mt-1 text-xs text-slate-500">{formatDate(props.event.start_date)} · {eventLabel(props.event)}</p></div>
      <select
        className={inputClass}
        value={props.event.season_id ?? ""}
        disabled={props.busy}
        onChange={(event) => void props.onAssign(props.event, event.target.value || null)}
      >
        <option value="">Unassigned</option>
        {props.seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}
      </select>
    </div>
  )
}

function Summary(props: { label: string; value: string; detail: string; attention?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${props.attention ? "border-amber-300" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{props.value}</p>
      <p className={`mt-1 text-xs ${props.attention ? "font-semibold text-amber-700" : "text-slate-500"}`}>{props.detail}</p>
    </div>
  )
}
