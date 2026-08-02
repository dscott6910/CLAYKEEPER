import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Mail,
  Phone,
  School,
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
          title="Participant Profile"
          description="Loading participant details and history"
        />
        <PageContainer>
          <div className="py-24 text-center text-slate-500">
            Loading participant profile…
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
          description="Participant details and history"
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

  const { athlete } = data
  const checkedInCount = data.registrations.filter(
    (registration) => registration.checked_in,
  ).length

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader
        title="Participant Profile"
        description="Participant details, registrations, and team history"
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
                  Participant
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
              value={data.registrations.length}
            />
            <MetricCard
              icon={BadgeCheck}
              label="Checked In"
              value={checkedInCount}
            />
            <MetricCard
              icon={School}
              label="Team Assignments"
              value={data.teamHistory.length}
            />
            <MetricCard
              icon={UserRound}
              label="Status"
              value={athlete.active ? "Active" : "Archived"}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
            <div className="space-y-5">
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

