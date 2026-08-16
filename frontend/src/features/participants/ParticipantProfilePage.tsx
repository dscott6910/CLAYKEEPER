import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Mail,
  Phone,
  School,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import {
  loadParticipantProfile,
  type ParticipantProfile,
} from "@/lib/services/participantProfile"

type ShootResult = ParticipantProfile["shootResults"][number]

function displayName(athlete: ParticipantProfile["athlete"]) {
  return `${athlete.preferred_name?.trim() || athlete.first_name} ${athlete.last_name}`.trim()
}

function dateLabel(value: string | null) {
  if (!value) return "Not set"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

function statusLabel(value: string | null | undefined) {
  if (!value) return "Unknown"

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function disciplineLabel(value: string) {
  return statusLabel(value)
}

function scoreTone(percentage: number) {
  if (percentage >= 90) return "text-emerald-700"
  if (percentage >= 80) return "text-teal-700"
  if (percentage >= 70) return "text-amber-700"
  return "text-rose-700"
}

function scoreBarTone(percentage: number) {
  if (percentage >= 90) return "bg-emerald-500"
  if (percentage >= 80) return "bg-teal-500"
  if (percentage >= 70) return "bg-amber-500"
  return "bg-rose-500"
}

function calculateTrend(results: ShootResult[]) {
  const scored = results
    .filter((result) => result.total_possible > 0)
    .slice(0, 6)

  if (scored.length < 2) {
    return { direction: "steady" as const, change: 0 }
  }

  const split = Math.ceil(scored.length / 2)
  const newest = scored.slice(0, split)
  const older = scored.slice(split)

  const newestAverage =
    newest.reduce((sum, result) => sum + result.score_percentage, 0) /
    newest.length
  const olderAverage =
    older.reduce((sum, result) => sum + result.score_percentage, 0) /
    older.length

  const change = newestAverage - olderAverage

  if (change > 0.5) return { direction: "up" as const, change }
  if (change < -0.5) return { direction: "down" as const, change }

  return { direction: "steady" as const, change }
}

function calculateInsights(results: ShootResult[]) {
  const scores = results.flatMap((result) => result.round_scores)
  const targetsHit = scores.reduce((sum, score) => sum + score, 0)
  const targetsPossible = results.reduce(
    (sum, result) =>
      sum + result.round_scores.length * result.targets_per_round,
    0,
  )

  return {
    shootCount: results.length,
    roundsShot: scores.length,
    targetsHit,
    targetsPossible,
    averageRound: scores.length ? targetsHit / scores.length : 0,
    percentage:
      targetsPossible > 0 ? (targetsHit / targetsPossible) * 100 : 0,
    highestRound: scores.length ? Math.max(...scores) : 0,
  }
}

export function ParticipantProfilePage() {
  const { athleteId = "" } = useParams()
  const [data, setData] = useState<ParticipantProfile | null>(null)
  const [selectedSeason, setSelectedSeason] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError("")

      try {
        const next = await loadParticipantProfile(athleteId)
        if (mounted) setData(next)
      } catch (nextError) {
        if (mounted) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load participant profile.",
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (athleteId) {
      void load()
    } else {
      setLoading(false)
      setError("Participant not found.")
    }

    return () => {
      mounted = false
    }
  }, [athleteId])

  const currentTeam = useMemo(
    () =>
      data?.teamHistory.find((assignment) => assignment.end_date === null) ??
      data?.teamHistory[0] ??
      null,
    [data],
  )

  const seasons = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.shootResults ?? [])
            .map((result) => result.season)
            .filter((season) => season !== "Unknown"),
        ),
      ).sort((left, right) => right.localeCompare(left)),
    [data],
  )

  const filteredResults = useMemo(
    () =>
      (data?.shootResults ?? []).filter(
        (result) =>
          selectedSeason === "all" || result.season === selectedSeason,
      ),
    [data, selectedSeason],
  )

  const selectedInsights = useMemo(
    () => calculateInsights(filteredResults),
    [filteredResults],
  )

  const trend = useMemo(
    () => calculateTrend(filteredResults),
    [filteredResults],
  )

  const selectedDisciplineAverages = useMemo(() => {
    const map = new Map<
      string,
      {
        roundsShot: number
        targetsHit: number
        targetsPossible: number
        bestScore: number
        bestPossible: number
        bestPercentage: number
      }
    >()

    for (const result of filteredResults) {
      const current = map.get(result.discipline) ?? {
        roundsShot: 0,
        targetsHit: 0,
        targetsPossible: 0,
        bestScore: 0,
        bestPossible: 0,
        bestPercentage: 0,
      }

      current.roundsShot += result.round_scores.length
      current.targetsHit += result.round_scores.reduce(
        (sum, score) => sum + score,
        0,
      )
      current.targetsPossible +=
        result.round_scores.length * result.targets_per_round

      if (result.score_percentage > current.bestPercentage) {
        current.bestScore = result.total_score
        current.bestPossible = result.total_possible
        current.bestPercentage = result.score_percentage
      }

      map.set(result.discipline, current)
    }

    return Array.from(map.entries())
      .map(([discipline, values]) => ({
        discipline,
        roundsShot: values.roundsShot,
        targetsHit: values.targetsHit,
        targetsPossible: values.targetsPossible,
        averageRound:
          values.roundsShot > 0
            ? values.targetsHit / values.roundsShot
            : 0,
        percentage:
          values.targetsPossible > 0
            ? (values.targetsHit / values.targetsPossible) * 100
            : 0,
        bestScore: values.bestScore,
        bestPossible: values.bestPossible,
        bestPercentage: values.bestPercentage,
      }))
      .sort((left, right) => right.percentage - left.percentage)
  }, [filteredResults])

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader
          title="Participant Profile"
          description="Loading participant performance and history"
        />
        <PageContainer>
          <div className="py-24 text-center text-slate-500">
            Loading athlete dashboard…
          </div>
        </PageContainer>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <AppHeader
          title="Participant Profile"
          description="Participant performance and history"
        />
        <PageContainer>
          <div className="space-y-4 py-12">
            <BackLink />
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              {error || "Participant not found."}
            </div>
          </div>
        </PageContainer>
      </div>
    )
  }

  const { athlete, statistics } = data
  const checkedInCount = data.registrations.filter(
    (registration) => registration.checked_in,
  ).length
  const recentResults = filteredResults.slice(0, 8)
  const personalBest =
    [...filteredResults]
      .filter((result) => result.total_possible > 0)
      .sort(
        (left, right) =>
          right.score_percentage - left.score_percentage,
      )[0] ?? null
  const scopeLabel =
    selectedSeason === "all" ? "All-Time" : `${selectedSeason} Season`

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader
        title="Participant Profile"
        description="Career statistics, season insights, recent scores, and history"
      />

      <PageContainer>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BackLink />

            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              Season
              <select
                value={selectedSeason}
                onChange={(event) => setSelectedSeason(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              >
                <option value="all">All seasons</option>
                {seasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <UserRound className="h-12 w-12 text-emerald-300" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
                  Athlete Dashboard
                </p>

                <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                  {displayName(athlete)}
                </h1>

                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-200">
                  <span>{currentTeam?.team_name ?? "No active team"}</span>
                  <span aria-hidden="true">•</span>
                  <span>
                    {data.classRecord?.display_name ??
                      data.classRecord?.code ??
                      "No class assigned"}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span>{athlete.active ? "Active" : "Archived"}</span>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
                    {scopeLabel}: {selectedInsights.percentage.toFixed(1)}%
                  </span>

                  {trend.direction === "up" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-300">
                      <TrendingUp className="h-4 w-4" />
                      Up {Math.abs(trend.change).toFixed(1)} pts
                    </span>
                  ) : trend.direction === "down" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/15 px-3 py-1.5 text-sm font-semibold text-rose-300">
                      <TrendingDown className="h-4 w-4" />
                      Down {Math.abs(trend.change).toFixed(1)} pts
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-slate-200">
                      Trend steady
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2 text-sm lg:text-right">
                <p>
                  CYSSA: <strong>{athlete.cyssa_number || "—"}</strong>
                </p>
                <p>
                  ATA: <strong>{athlete.ata_number || "—"}</strong>
                </p>
                <p>
                  NSSA: <strong>{athlete.nssa_number || "—"}</strong>
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CalendarDays}
              label={`${scopeLabel} Shoots`}
              value={selectedInsights.shootCount}
            />
            <MetricCard
              icon={Target}
              label={`${scopeLabel} Rounds`}
              value={selectedInsights.roundsShot}
            />
            <MetricCard
              icon={BadgeCheck}
              label={`${scopeLabel} Percentage`}
              value={`${selectedInsights.percentage.toFixed(1)}%`}
            />
            <MetricCard
              icon={Trophy}
              label={`${scopeLabel} High Round`}
              value={selectedInsights.highestRound}
            />
          </section>

          {personalBest ? (
            <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
                    <Trophy className="h-6 w-6 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
                      {scopeLabel} Personal Best
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {personalBest.event_name}
                    </p>
                    <p className="text-sm text-slate-600">
                      {disciplineLabel(personalBest.discipline)} ·{" "}
                      {dateLabel(personalBest.event_date)}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-3xl font-black text-slate-950">
                    {personalBest.total_score} / {personalBest.total_possible}
                  </p>
                  <p className="text-sm font-bold text-amber-700">
                    {personalBest.score_percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
            <div className="space-y-5">
              <InfoCard title={`${scopeLabel} Statistics`}>
                <InfoRow
                  label="Shoots Recorded"
                  value={String(selectedInsights.shootCount)}
                />
                <InfoRow
                  label="Rounds Recorded"
                  value={String(selectedInsights.roundsShot)}
                />
                <InfoRow
                  label="Targets Hit"
                  value={`${selectedInsights.targetsHit} / ${selectedInsights.targetsPossible}`}
                />
                <InfoRow
                  label="Score Percentage"
                  value={`${selectedInsights.percentage.toFixed(2)}%`}
                />
                <InfoRow
                  label="Average Round"
                  value={selectedInsights.averageRound.toFixed(2)}
                />
                <InfoRow
                  label="Highest Round"
                  value={String(selectedInsights.highestRound)}
                />
              </InfoCard>

              <InfoCard title={`${scopeLabel} Discipline Insights`}>
                {selectedDisciplineAverages.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No round-by-round scores are available for this season.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedDisciplineAverages.map((item) => (
                      <div
                        key={item.discipline}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {disciplineLabel(item.discipline)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.roundsShot} rounds · {item.targetsHit} /{" "}
                              {item.targetsPossible} targets
                            </p>
                            <p className="mt-2 text-xs font-semibold text-emerald-700">
                              Personal best: {item.bestScore} /{" "}
                              {item.bestPossible} (
                              {item.bestPercentage.toFixed(1)}%)
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-black text-slate-950">
                              {item.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs text-slate-500">
                              Avg round {item.averageRound.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>

              <InfoCard title="All-Time Career Snapshot">
                <InfoRow
                  label="Registered Events"
                  value={String(statistics.eventCount)}
                />
                <InfoRow
                  label="Shoots Recorded"
                  value={String(statistics.shootCount)}
                />
                <InfoRow
                  label="Rounds Recorded"
                  value={String(statistics.roundsShot)}
                />
                <InfoRow
                  label="Targets Hit"
                  value={`${statistics.targetsHit} / ${statistics.targetsPossible}`}
                />
                <InfoRow
                  label="Career Percentage"
                  value={`${statistics.overallPercentage.toFixed(2)}%`}
                />
                <InfoRow
                  label="Career Average Round"
                  value={statistics.averageRound.toFixed(2)}
                />
              </InfoCard>

              <InfoCard title="Participant Information">
                <InfoRow
                  label="Class"
                  value={
                    data.classRecord
                      ? `${data.classRecord.code} — ${data.classRecord.display_name}`
                      : "Not assigned"
                  }
                />
                <InfoRow
                  label="Graduation Year"
                  value={
                    athlete.graduation_year
                      ? String(athlete.graduation_year)
                      : "Not set"
                  }
                />
                <InfoRow
                  label="CYSSA Number"
                  value={athlete.cyssa_number || "Not set"}
                />
                <InfoRow
                  label="ATA Number"
                  value={athlete.ata_number || "Not set"}
                />
                <InfoRow
                  label="NSSA Number"
                  value={athlete.nssa_number || "Not set"}
                />
              </InfoCard>

              <InfoCard title="Contact Information">
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={athlete.email || "Not provided"}
                />
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={athlete.phone || "Not provided"}
                />
                <InfoRow
                  label="Emergency Contact"
                  value={athlete.emergency_contact_name || "Not provided"}
                />
                <InfoRow
                  label="Emergency Phone"
                  value={athlete.emergency_contact_phone || "Not provided"}
                />
              </InfoCard>

              <InfoCard title="Team History">
                {data.teamHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No team assignments recorded.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.teamHistory.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {assignment.team_name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {dateLabel(assignment.start_date)} –{" "}
                              {assignment.end_date
                                ? dateLabel(assignment.end_date)
                                : "Present"}
                            </p>
                          </div>

                          {assignment.is_primary ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              Primary
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>
            </div>

            <div className="space-y-5">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <h2 className="text-lg font-bold text-slate-950">
                    Performance Trend
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Shoot percentages for the selected season.
                  </p>
                </div>

                {recentResults.length === 0 ? (
                  <div className="p-10 text-center text-slate-500">
                    No performance history is available.
                  </div>
                ) : (
                  <div className="space-y-4 p-5">
                    {[...recentResults].reverse().map((result) => (
                      <div
                        key={`trend-${result.registration_id}-${result.shoot_id}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {result.event_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {dateLabel(result.event_date)}
                            </p>
                          </div>
                          <p
                            className={`font-bold ${scoreTone(
                              result.score_percentage,
                            )}`}
                          >
                            {result.score_percentage.toFixed(1)}%
                          </p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${scoreBarTone(
                              result.score_percentage,
                            )}`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, result.score_percentage),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <h2 className="text-lg font-bold text-slate-950">
                    {scopeLabel} Scores
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Shoot totals, target counts, percentages, and recorded rounds.
                  </p>
                </div>

                {recentResults.length === 0 ? (
                  <div className="p-10 text-center text-slate-500">
                    No score history is available for this season.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentResults.map((result) => (
                      <div
                        key={`${result.registration_id}-${result.shoot_id}`}
                        className="p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-950">
                              {result.event_name}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {result.shoot_name} ·{" "}
                              {disciplineLabel(result.discipline)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {dateLabel(result.event_date)}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-3xl font-black text-slate-950">
                              {result.total_score} / {result.total_possible}
                            </p>
                            <p
                              className={`text-sm font-bold ${scoreTone(
                                result.score_percentage,
                              )}`}
                            >
                              {result.score_percentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        {result.round_scores.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {result.round_scores.map((score, index) => (
                              <div
                                key={`${result.shoot_id}-${index}`}
                                className="min-w-14 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center"
                              >
                                <p className="text-xs text-slate-500">
                                  R{index + 1}
                                </p>
                                <p className="text-lg font-bold text-slate-950">
                                  {score}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : result.historical_total_score !== null ? (
                          <p className="mt-3 text-xs text-slate-500">
                            Historical total; individual round scores were not imported.
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <h2 className="text-lg font-bold text-slate-950">
                    Registration History
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Events, attendance, payments, and registration status.
                  </p>
                </div>

                {data.registrations.length === 0 ? (
                  <div className="p-10 text-center text-slate-500">
                    No registrations are available.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.registrations.map((registration) => (
                      <div
                        key={registration.id}
                        className="grid gap-3 p-5 sm:grid-cols-[1fr_auto]"
                      >
                        <div>
                          <p className="font-semibold text-slate-950">
                            {registration.event_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {dateLabel(registration.event_date)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <StatusBadge
                            label={
                              registration.checked_in
                                ? "Checked In"
                                : "Not Checked In"
                            }
                            positive={registration.checked_in}
                          />
                          <StatusBadge
                            label={statusLabel(registration.payment_status)}
                            positive={[
                              "paid",
                              "waived",
                              "not_required",
                            ].includes(registration.payment_status.toLowerCase())}
                          />
                          <StatusBadge
                            label={statusLabel(registration.status)}
                            positive={
                              registration.status.toLowerCase() !== "cancelled"
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <InfoCard title="Attendance Summary">
                <InfoRow
                  label="Registered Events"
                  value={String(statistics.eventCount)}
                />
                <InfoRow
                  label="Checked In"
                  value={String(checkedInCount)}
                />
              </InfoCard>

              {athlete.notes ? (
                <InfoCard title="Notes">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {athlete.notes}
                  </p>
                </InfoCard>
              ) : null}
            </div>
          </section>
        </div>
      </PageContainer>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/participants"
      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Participants
    </Link>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="h-5 w-5 text-emerald-600" />
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

function InfoCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">{title}</h2>
      {children}
    </section>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof School
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
      </div>
      <p className="text-right text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function StatusBadge({
  label,
  positive,
}: {
  label: string
  positive: boolean
}) {
  return (
    <span
      className={
        positive
          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
          : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"
      }
    >
      {label}
    </span>
  )
}
