import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Database, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import {
  deleteEventFromMaintenance,
  loadEventMaintenanceRecords,
  type EventMaintenanceRecord,
} from "@/lib/services/eventMaintenance"

function formatDate(value: string | null) {
  if (!value) return "No date"
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

function statusLabel(event: EventMaintenanceRecord) {
  if (event.health === "duplicate") return { label: "Duplicate name", className: "bg-amber-100 text-amber-800" }
  if (event.health === "orphan-candidate") return { label: "Orphan candidate", className: "bg-red-100 text-red-800" }
  if (event.health === "linked-import") return { label: "Linked import", className: "bg-emerald-100 text-emerald-800" }
  return { label: "Manual event", className: "bg-slate-100 text-slate-700" }
}

export function EventMaintenancePage() {
  const [events, setEvents] = useState<EventMaintenanceRecord[]>([])
  const [role, setRole] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await loadEventMaintenanceRecords()
      setEvents(result.events)
      setRole(result.role)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load event maintenance.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return events
    return events.filter((event) =>
      [event.name, event.status, event.externalId ?? "", ...event.importFileNames]
        .join(" ")
        .toLowerCase()
        .includes(value),
    )
  }, [events, query])

  const canDelete = role === "owner" || role === "admin"

  async function handleDelete(event: EventMaintenanceRecord) {
    const detail = [
      `Delete “${event.name}”?`,
      "",
      `Shoots: ${event.shootCount}`,
      `Registrations: ${event.registrationCount}`,
      `Score entries: ${event.scoreCount}`,
      `Import records: ${event.importCount}`,
      "",
      "This removes the event and all event-owned competition data. Shared participants, teams, classes, and locations are preserved.",
      "",
      "This cannot be undone.",
    ].join("\n")

    if (!window.confirm(detail)) return

    setDeletingId(event.id)
    try {
      const result = await deleteEventFromMaintenance(event.id)
      setEvents((current) => current.filter((item) => item.id !== event.id))
      toast.success(`${result?.eventName ?? event.name} was deleted.`)
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "The event could not be deleted."
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Event Maintenance"
        description="Inspect duplicate and orphaned events and safely remove incomplete event data"
      />

      <PageContainer className="space-y-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Use this page carefully.</p>
              <p className="mt-1">
                Deleting an event removes its shoots, registrations, squads, score entries, and linked import history. Participants, teams, classes, and locations remain available.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events or imported file names"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        {!canDelete && !loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Your role is <strong>{role || "unknown"}</strong>. Only an organization owner or administrator can delete events.
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Database className="h-5 w-5 text-emerald-600" />
              All events
            </h2>
            <p className="mt-1 text-sm text-slate-500">Compare shoot and registration counts before deleting a duplicate.</p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading event records…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No matching events were found.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filtered.map((event) => {
                const badge = statusLabel(event)
                return (
                  <article key={event.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{event.name}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                          {event.duplicateNameCount > 1 && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                              {event.duplicateNameCount} events share this name
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(event.startDate)} · {event.status} · Created {new Date(event.createdAt).toLocaleString()}
                        </p>
                        {event.importFileNames.length > 0 && (
                          <p className="mt-2 text-sm text-slate-600">Import: {event.importFileNames.join(", ")}</p>
                        )}
                        {event.externalId && <p className="mt-1 break-all text-xs text-slate-400">External ID: {event.externalId}</p>}

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {[
                            ["Shoots", event.shootCount],
                            ["Registrations", event.registrationCount],
                            ["Score entries", event.scoreCount],
                            ["Import records", event.importCount],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                              <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDelete(event)}
                        disabled={!canDelete || deletingId !== null}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === event.id ? "Deleting…" : "Delete event"}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  )
}
