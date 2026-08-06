import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Loader2, RefreshCw, Target } from "lucide-react"
import { Link } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { getDisciplineLabel } from "@/lib/constants/disciplines"
import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

type ScoringEvent = {
  id: string
  name: string
  start_date: string | null
  status: string | null
  discipline: string | null
}

function formatDate(value: string | null) {
  if (!value) return "Date not set"

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

function statusLabel(value: string | null) {
  if (!value) return "Unknown"
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function LiveScoringEventSelectorPage() {
  const [events, setEvents] = useState<ScoringEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const organizationId = await getCurrentOrganizationId()
      const result = await supabase
        .from("events")
        .select("id,name,start_date,status,discipline")
        .eq("organization_id", organizationId)
        .order("start_date", { ascending: false })

      if (result.error) throw new Error(result.error.message)
      setEvents((result.data ?? []) as ScoringEvent[])
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Events could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return events

    return events.filter((event) =>
      [
        event.name,
        event.status,
        getDisciplineLabel(event.discipline, ""),
        event.start_date,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [events, search])

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">
                Tournament Scoring
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">
                Choose an Event
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Select the tournament you want to score. This prevents scores
                from being entered under the wrong event.
              </p>
            </div>

            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh Events
            </Button>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Search events
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Event name, discipline, status, or date"
              className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"
            />
          </label>
        </section>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading events…
          </div>
        ) : filteredEvents.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredEvents.map((event) => (
              <article
                key={event.id}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                    <Target className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-slate-950">
                      {event.name}
                    </h2>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(event.start_date)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    {getDisciplineLabel(event.discipline)}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                    {statusLabel(event.status)}
                  </span>
                </div>

                <Link
                  to={`/events/${event.id}/live-scoring`}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Open Live Scoring
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-slate-500">
            No events match your search.
          </div>
        )}
      </div>
    </PageContainer>
  )
}

