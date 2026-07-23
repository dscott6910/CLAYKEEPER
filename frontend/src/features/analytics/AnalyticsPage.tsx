import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { BarChart3, RefreshCw, School, Target, Trophy, UserRoundCheck, Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { Button } from "@/components/ui/button"
import { DashboardSection } from "@/features/analytics/components/DashboardSection"
import { DashboardSkeleton } from "@/features/analytics/components/DashboardSkeleton"
import { HorizontalBarChart } from "@/features/analytics/components/HorizontalBarChart"
import { MetricCard } from "@/features/analytics/components/MetricCard"
import { StackedParticipationChart } from "@/features/analytics/components/StackedParticipationChart"
import {
  loadParticipationCompetitionAnalytics,
  type ParticipationCompetitionAnalytics,
} from "@/lib/services/participationAnalytics"

const disciplines = [
  { value: "", label: "All disciplines" },
  { value: "american_trap", label: "American Trap" },
  { value: "skeet", label: "Skeet" },
  { value: "sporting_clays", label: "Sporting Clays" },
  { value: "bunker", label: "Bunker" },
]

export function AnalyticsPage() {
  const [data, setData] = useState<ParticipationCompetitionAnalytics | null>(null)
  const [seasonId, setSeasonId] = useState("")
  const [eventId, setEventId] = useState("")
  const [discipline, setDiscipline] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      setData(await loadParticipationCompetitionAnalytics({ seasonId: seasonId || undefined, eventId: eventId || undefined, discipline: discipline || undefined }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load participation analytics.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [seasonId, eventId, discipline])

  const availableEvents = useMemo(
    () => (data?.events ?? []).filter((event) => !seasonId || event.seasonId === seasonId),
    [data?.events, seasonId],
  )

  useEffect(() => {
    if (eventId && !availableEvents.some((event) => event.id === eventId)) setEventId("")
  }, [availableEvents, eventId])

  if (loading && !data) {
    return <div className="min-h-screen"><AppHeader title="Participation & Competition Analytics" description="Season growth, participation, scoring, and performance insights" /><DashboardSkeleton /></div>
  }

  const metrics = [
    { label: "Participants", value: data?.totalParticipants ?? 0, detail: "Unique participants in scope", icon: Users },
    { label: "Teams", value: data?.uniqueTeams ?? 0, detail: "Teams represented", icon: School },
    { label: "Registrations", value: data?.totalRegistrations ?? 0, detail: "Event registrations", icon: UserRoundCheck },
    { label: "Scored Participants", value: data?.scoredParticipants ?? 0, detail: `${data?.completionRate ?? 0}% completion rate`, icon: Target },
    { label: "Average Round", value: data?.averageScore ?? 0, detail: "Across entered scores", icon: BarChart3 },
    { label: "High Round", value: data?.highScore ?? 0, detail: "Highest recorded round", icon: Trophy },
  ]

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader title="Participation & Competition Analytics" description="Season growth, participation, scoring, and performance insights" />
      <main className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Season
                <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  <option value="">All seasons</option>
                  {(data?.seasons ?? []).map((season) => <option key={season.id} value={season.id}>{season.name}{season.status === "active" ? " (Active)" : ""}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Event
                <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  <option value="">All events</option>
                  {availableEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Discipline
                <select value={discipline} onChange={(event) => setDiscipline(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  {disciplines.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
          </div>
          {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DashboardSection title="Participation by Season" description="Unique participants registered during each season">
            <HorizontalBarChart data={data?.participationBySeason ?? []} />
          </DashboardSection>
          <DashboardSection title="New vs. Returning Participants" description="Participant retention and growth across seasons">
            <StackedParticipationChart data={data?.newVsReturning ?? []} />
          </DashboardSection>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <DashboardSection title="Participation by Discipline" description="Unique participants entered in each discipline">
            <HorizontalBarChart data={data?.registrationsByDiscipline ?? []} />
          </DashboardSection>
          <DashboardSection title="Participation by Class" description="Current registration class distribution">
            <HorizontalBarChart data={data?.participationByClass ?? []} />
          </DashboardSection>
          <DashboardSection title="Top Teams by Participation" description="Teams with the most unique participants">
            <HorizontalBarChart data={data?.teamParticipation ?? []} />
          </DashboardSection>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DashboardSection title="Average Score by Discipline" description="Average score per entered round">
            <HorizontalBarChart data={data?.averageByDiscipline ?? []} />
          </DashboardSection>
          <DashboardSection title="Round Score Distribution" description="Distribution of all recorded round scores">
            <HorizontalBarChart data={data?.scoreDistribution ?? []} />
          </DashboardSection>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DashboardSection title="Top Participants" description="Ranked by average round score" action={<Link className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" to="/reports">Open reports</Link>}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="pb-3">Participant</th><th className="pb-3">Team</th><th className="pb-3 text-right">Avg.</th><th className="pb-3 text-right">Rounds</th></tr></thead>
                <tbody>{(data?.topParticipants ?? []).map((row) => <tr key={row.athleteId} className="border-b border-slate-100 last:border-0"><td className="py-3 font-semibold text-slate-900">{row.name}</td><td className="py-3 text-slate-500">{row.team}</td><td className="py-3 text-right font-semibold">{row.average}</td><td className="py-3 text-right text-slate-500">{row.rounds}</td></tr>)}</tbody>
              </table>
              {!data?.topParticipants.length ? <p className="py-8 text-center text-sm text-slate-500">No score data is available.</p> : null}
            </div>
          </DashboardSection>

          <DashboardSection title="Top Teams" description="Ranked by average round score" action={<Link className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" to="/teams">Open teams</Link>}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="pb-3">Team</th><th className="pb-3 text-right">Avg.</th><th className="pb-3 text-right">Participants</th><th className="pb-3 text-right">Rounds</th></tr></thead>
                <tbody>{(data?.topTeams ?? []).map((row) => <tr key={row.teamId} className="border-b border-slate-100 last:border-0"><td className="py-3 font-semibold text-slate-900">{row.name}</td><td className="py-3 text-right font-semibold">{row.average}</td><td className="py-3 text-right text-slate-500">{row.participants}</td><td className="py-3 text-right text-slate-500">{row.rounds}</td></tr>)}</tbody>
              </table>
              {!data?.topTeams.length ? <p className="py-8 text-center text-sm text-slate-500">No team score data is available.</p> : null}
            </div>
          </DashboardSection>
        </section>
      </main>
    </div>
  )
}
