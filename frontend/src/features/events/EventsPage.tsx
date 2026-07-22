import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/services/organizationContext"

type EventStatus =
  | "draft"
  | "published"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "archived"

type ClayEvent = {
  id: string
  organization_id: string
  name: string
  description: string | null
  series_name: string | null
  sponsor_name: string | null
  start_date: string | null
  end_date: string | null
  registration_opens_at: string | null
  registration_closes_at: string | null
  status: EventStatus
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

type EventForm = {
  name: string
  description: string
  series_name: string
  sponsor_name: string
  start_date: string
  end_date: string
  registration_opens_at: string
  registration_closes_at: string
  status: EventStatus
  notes: string
  active: boolean
}

const EVENT_STATUSES: Array<{
  value: EventStatus
  label: string
}> = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "registration_open", label: "Registration Open" },
  { value: "registration_closed", label: "Registration Closed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
]

const EMPTY_FORM: EventForm = {
  name: "",
  description: "",
  series_name: "",
  sponsor_name: "",
  start_date: "",
  end_date: "",
  registration_opens_at: "",
  registration_closes_at: "",
  status: "draft",
  notes: "",
  active: true,
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return "An unexpected error occurred."
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function localInputToIso(value: string): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function isoToLocalInput(value: string | null): string {
  if (!value) {
    return ""
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)

  return localDate.toISOString().slice(0, 16)
}

function formatEventDates(
  startDate: string | null,
  endDate: string | null,
): string {
  if (!startDate && !endDate) {
    return "Dates not set"
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  if (startDate && !endDate) {
    return formatter.format(new Date(`${startDate}T12:00:00`))
  }

  if (!startDate && endDate) {
    return formatter.format(new Date(`${endDate}T12:00:00`))
  }

  if (startDate === endDate) {
    return formatter.format(new Date(`${startDate}T12:00:00`))
  }

  return `${formatter.format(
    new Date(`${startDate}T12:00:00`),
  )} – ${formatter.format(new Date(`${endDate}T12:00:00`))}`
}

function getStatusLabel(status: EventStatus): string {
  return (
    EVENT_STATUSES.find((option) => option.value === status)?.label ??
    status
  )
}

function getStatusClasses(status: EventStatus): string {
  switch (status) {
    case "registration_open":
      return "bg-emerald-100 text-emerald-800"
    case "published":
      return "bg-blue-100 text-blue-800"
    case "in_progress":
      return "bg-amber-100 text-amber-900"
    case "completed":
      return "bg-slate-200 text-slate-800"
    case "cancelled":
      return "bg-red-100 text-red-800"
    case "archived":
      return "bg-zinc-200 text-zinc-700"
    case "registration_closed":
      return "bg-orange-100 text-orange-800"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

export function EventsPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [events, setEvents] = useState<ClayEvent[]>([])
  const [shootCounts, setShootCounts] = useState<Record<string, number>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | EventStatus>(
    "all",
  )
  const [showArchived, setShowArchived] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(EMPTY_FORM)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const currentOrganizationId = await getCurrentOrganizationId()

      setOrganizationId(currentOrganizationId)

      const [eventsResult, shootsResult] = await Promise.all([
        supabase
          .from("events")
          .select("*")
          .eq("organization_id", currentOrganizationId)
          .order("start_date", {
            ascending: false,
            nullsFirst: false,
          })
          .order("created_at", { ascending: false }),

        supabase
          .from("shoots")
          .select("id,event_id")
          .eq("organization_id", currentOrganizationId),
      ])

      if (eventsResult.error) {
        throw eventsResult.error
      }

      if (shootsResult.error) {
        throw shootsResult.error
      }

      const counts: Record<string, number> = {}

      for (const shoot of shootsResult.data ?? []) {
        counts[shoot.event_id] = (counts[shoot.event_id] ?? 0) + 1
      }

      setEvents((eventsResult.data ?? []) as ClayEvent[])
      setShootCounts(counts)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return events.filter((event) => {
      if (!showArchived && event.status === "archived") {
        return false
      }

      if (statusFilter !== "all" && event.status !== statusFilter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [
        event.name,
        event.series_name,
        event.sponsor_name,
        event.description,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        )
    })
  }, [events, search, showArchived, statusFilter])

  const summary = useMemo(() => {
    return {
      total: events.filter((event) => event.status !== "archived").length,
      open: events.filter(
        (event) => event.status === "registration_open",
      ).length,
      upcoming: events.filter((event) => {
        if (!event.start_date) {
          return false
        }

        return (
          event.start_date >= new Date().toISOString().slice(0, 10) &&
          !["completed", "cancelled", "archived"].includes(event.status)
        )
      }).length,
      shoots: Object.values(shootCounts).reduce(
        (total, count) => total + count,
        0,
      ),
    }
  }, [events, shootCounts])

  function openCreateEditor() {
    setEditingEventId(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
    setError(null)
  }

  function openEditEditor(event: ClayEvent) {
    setEditingEventId(event.id)
    setForm({
      name: event.name,
      description: event.description ?? "",
      series_name: event.series_name ?? "",
      sponsor_name: event.sponsor_name ?? "",
      start_date: event.start_date ?? "",
      end_date: event.end_date ?? "",
      registration_opens_at: isoToLocalInput(
        event.registration_opens_at,
      ),
      registration_closes_at: isoToLocalInput(
        event.registration_closes_at,
      ),
      status: event.status,
      notes: event.notes ?? "",
      active: event.active,
    })
    setEditorOpen(true)
    setError(null)
  }

  function closeEditor() {
    if (saving) {
      return
    }

    setEditorOpen(false)
    setEditingEventId(null)
    setForm(EMPTY_FORM)
  }

  function updateForm<K extends keyof EventForm>(
    field: K,
    value: EventForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!organizationId) {
      setError("No organization is currently selected.")
      return
    }

    const trimmedName = form.name.trim()

    if (!trimmedName) {
      setError("Event name is required.")
      return
    }

    if (
      form.start_date &&
      form.end_date &&
      form.end_date < form.start_date
    ) {
      setError("The event end date cannot be before the start date.")
      return
    }

    if (
      form.registration_opens_at &&
      form.registration_closes_at &&
      new Date(form.registration_closes_at) <
        new Date(form.registration_opens_at)
    ) {
      setError(
        "Registration closing time cannot be before registration opens.",
      )
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      organization_id: organizationId,
      name: trimmedName,
      description: normalizeOptionalText(form.description),
      series_name: normalizeOptionalText(form.series_name),
      sponsor_name: normalizeOptionalText(form.sponsor_name),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      registration_opens_at: localInputToIso(
        form.registration_opens_at,
      ),
      registration_closes_at: localInputToIso(
        form.registration_closes_at,
      ),
      status: form.status,
      notes: normalizeOptionalText(form.notes),
      active: form.active,
    }

    try {
      if (editingEventId) {
        const result = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingEventId)
          .eq("organization_id", organizationId)

        if (result.error) {
          throw result.error
        }
      } else {
        const result = await supabase.from("events").insert(payload)

        if (result.error) {
          throw result.error
        }
      }

      closeEditor()
      await loadEvents()
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(event: ClayEvent) {
    const shootCount = shootCounts[event.id] ?? 0

    const confirmationMessage =
      shootCount > 0
        ? `Delete "${event.name}" and its ${shootCount} associated shoot${
            shootCount === 1 ? "" : "s"
          }? This cannot be undone.`
        : `Delete "${event.name}"? This cannot be undone.`

    if (!window.confirm(confirmationMessage)) {
      return
    }

    setDeletingId(event.id)
    setError(null)

    try {
      const result = await supabase
        .from("events")
        .delete()
        .eq("id", event.id)
        .eq("organization_id", event.organization_id)

      if (result.error) {
        throw result.error
      }

      await loadEvents()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Competition Management
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Events
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Create events, manage registration windows, and organize
              the shoots within each competition.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateEditor}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            New Event
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <div className="font-semibold">ClayKeeper encountered an error</div>
            <div className="mt-1 break-words">{error}</div>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Active Events" value={summary.total} />
          <SummaryCard label="Registration Open" value={summary.open} />
          <SummaryCard label="Upcoming" value={summary.upcoming} />
          <SummaryCard label="Total Shoots" value={summary.shoots} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events, series, or sponsors"
              className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | EventStatus,
                )
              }
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">All statuses</option>
              {EVENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived
            </label>

            <button
              type="button"
              onClick={() => void loadEvents()}
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading events…
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-10 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                {events.length === 0
                  ? "No events have been created"
                  : "No events match your filters"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {events.length === 0
                  ? "Create your first event, then add its individual shoots."
                  : "Try changing the search text or selected status."}
              </p>

              {events.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateEditor}
                  className="mt-5 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Create First Event
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredEvents.map((event) => (
                <article
                  key={event.id}
                  className="p-5 transition hover:bg-slate-50/70"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-slate-950">
                          {event.name}
                        </h2>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                            event.status,
                          )}`}
                        >
                          {getStatusLabel(event.status)}
                        </span>

                        {!event.active && (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                        <span>
                          {formatEventDates(
                            event.start_date,
                            event.end_date,
                          )}
                        </span>

                        <span>
                          {shootCounts[event.id] ?? 0} shoot
                          {(shootCounts[event.id] ?? 0) === 1 ? "" : "s"}
                        </span>

                        {event.series_name && (
                          <span>Series: {event.series_name}</span>
                        )}

                        {event.sponsor_name && (
                          <span>Sponsored by {event.sponsor_name}</span>
                        )}
                      </div>

                      {event.description && (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        to={`/events/${event.id}`}
                        className="inline-flex min-h-10 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Open Workspace
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditEditor(event)}
                        className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-white"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === event.id}
                        onClick={() => void deleteEvent(event)}
                        className="min-h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === event.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-editor-title"
        >
          <div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2
                  id="event-editor-title"
                  className="text-xl font-bold text-slate-950"
                >
                  {editingEventId ? "Edit Event" : "Create Event"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Shoots can be added after the event has been created.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveEvent}>
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Event Name *
                  </span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      updateForm("name", event.target.value)
                    }
                    placeholder="Example: US Open 2027"
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Series Name
                  </span>
                  <input
                    value={form.series_name}
                    onChange={(event) =>
                      updateForm("series_name", event.target.value)
                    }
                    placeholder="Example: Trap Series"
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Sponsor
                  </span>
                  <input
                    value={form.sponsor_name}
                    onChange={(event) =>
                      updateForm("sponsor_name", event.target.value)
                    }
                    placeholder="Sponsor name"
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Start Date
                  </span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      updateForm("start_date", event.target.value)
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    End Date
                  </span>
                  <input
                    type="date"
                    min={form.start_date || undefined}
                    value={form.end_date}
                    onChange={(event) =>
                      updateForm("end_date", event.target.value)
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Registration Opens
                  </span>
                  <input
                    type="datetime-local"
                    value={form.registration_opens_at}
                    onChange={(event) =>
                      updateForm(
                        "registration_opens_at",
                        event.target.value,
                      )
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Registration Closes
                  </span>
                  <input
                    type="datetime-local"
                    value={form.registration_closes_at}
                    onChange={(event) =>
                      updateForm(
                        "registration_closes_at",
                        event.target.value,
                      )
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Status
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value as EventStatus,
                      )
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  >
                    {EVENT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      updateForm("active", event.target.checked)
                    }
                  />
                  Event is active
                </label>

                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Description
                  </span>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      updateForm("description", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Internal Notes
                  </span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      updateForm("notes", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving…"
                    : editingEventId
                      ? "Save Changes"
                      : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
        {value.toLocaleString()}
      </p>
    </div>
  )
}
