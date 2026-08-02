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
  Trophy,
  UserRound,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import {
  loadParticipantProfile,
  type ParticipantProfile,
} from "@/lib/services/participantProfile"

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

export function ParticipantProfilePage() {
  const { athleteId = "" } = useParams()
  const [data, setData] = useState<ParticipantProfile | null>(null)
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

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader
          title="Athlete Dashboard"
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
          title="Athlete Dashboard"
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

  const recentResults = data.shootResults.slice(0, 6)

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader
        title="Athlete Dashboard"
        description="Career statistics, recent scores, registrations, and team history"
      />

      <PageContainer>
        <div className="space-y-6">
          <BackLink />

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
              label="Registered Events"
              value={statistics.eventCount}
            />
            <MetricCard
              icon={Target}
              label="Rounds Recorded"
              value={statistics.roundsShot}
            />
            <MetricCard
              icon={BadgeCheck}
              label="Average Round"
              value={statistics.averageRound.toFixed(2)}
            />
            <MetricCard
              icon={Trophy}
              label="Highest Round"
              value={statistics.highestRound}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
            <div className="space-y-5">
              <InfoCard title="Career Statistics">
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
                  value={String(statistics.targetsHit)}
                />
                <InfoRow
                  label="Average Round"
                  value={statistics.averageRound.toFixed(2)}
                />
                <InfoRow
                  label="Highest Round"
                  value={String(statistics.highestRound)}
                />
                <InfoRow
                  label="Highest Shoot Total"
                  value={String(statistics.highestShootTotal)}
                />
              </InfoCard>

              <InfoCard title="Discipline Averages">
                {statistics.disciplineAverages.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No round-by-round scores are available yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {statistics.disciplineAverages.map((item) => (
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
                              {item.roundsShot} rounds · {item.targetsHit} targets hit
                            </p>
                          </div>

                          <p className="text-2xl font-black text-slate-950">
                            {item.averageRound.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    Recent Scores
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Most recent shoot totals and recorded rounds.
                  </p>
                </div>

                {recentResults.length === 0 ? (
                  <div className="p-10 text-center text-slate-500">
                    No score history is available.
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
                              {result.shoot_name} · {disciplineLabel(result.discipline)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {dateLabel(result.event_date)}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-3xl font-black text-slate-950">
                              {result.total_score}
                            </p>
                            <p className="text-xs text-slate-500">
                              Total score
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
