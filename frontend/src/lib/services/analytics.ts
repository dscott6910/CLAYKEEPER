import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type AnalyticsTrendPoint = {
  label: string
  registrations: number
  revenue: number
}

export type ExecutiveAnalytics = {
  organizationId: string
  activeSeason: { id: string; name: string; startDate: string; endDate: string } | null
  activeParticipants: number
  activeTeams: number
  scheduledEvents: number
  liveEvents: number
  registrationsThisWeek: number
  totalRegistrations: number
  revenueCollected: number
  outstandingBalance: number
  collectionRate: number
  upcomingEvents: Array<{ id: string; name: string; startDate: string | null; status: string | null; registrations: number }>
  recentTrend: AnalyticsTrendPoint[]
}

type RegistrationRow = {
  event_id: string
  registered_at: string
  registration_fee: number | string | null
  discount_amount: number | string | null
  amount_paid: number | string | null
  status: string
}

type EventRow = {
  id: string
  name: string
  start_date: string | null
  status: string | null
  active: boolean
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "short" }).format(date)
}

export async function loadExecutiveAnalytics(): Promise<ExecutiveAnalytics> {
  const organizationId = await getCurrentOrganizationId()
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)
  const trendStart = new Date(today.getFullYear(), today.getMonth() - 5, 1)

  const [seasonResult, athletesResult, teamsResult, eventsResult, registrationsResult] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, name, start_date, end_date")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("athletes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("active", true),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("active", true),
    supabase
      .from("events")
      .select("id, name, start_date, status, active")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("start_date", { ascending: true }),
    supabase
      .from("registrations")
      .select("event_id, registered_at, registration_fee, discount_amount, amount_paid, status")
      .eq("organization_id", organizationId)
      .gte("registered_at", trendStart.toISOString()),
  ])

  for (const result of [seasonResult, athletesResult, teamsResult, eventsResult, registrationsResult]) {
    if (result.error) throw new Error(result.error.message)
  }

  const events = (eventsResult.data ?? []) as EventRow[]
  const registrations = ((registrationsResult.data ?? []) as RegistrationRow[]).filter(
    (row) => row.status !== "cancelled" && row.status !== "withdrawn",
  )
  const registrationCountByEvent = new Map<string, number>()
  let revenueCollected = 0
  let expectedRevenue = 0
  let registrationsThisWeek = 0

  for (const row of registrations) {
    registrationCountByEvent.set(row.event_id, (registrationCountByEvent.get(row.event_id) ?? 0) + 1)
    revenueCollected += numeric(row.amount_paid)
    expectedRevenue += Math.max(0, numeric(row.registration_fee) - numeric(row.discount_amount))
    if (new Date(row.registered_at) >= weekStart) registrationsThisWeek += 1
  }

  const trendMap = new Map<string, AnalyticsTrendPoint>()
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1)
    trendMap.set(monthKey(date), { label: monthLabel(date), registrations: 0, revenue: 0 })
  }
  for (const row of registrations) {
    const point = trendMap.get(monthKey(new Date(row.registered_at)))
    if (!point) continue
    point.registrations += 1
    point.revenue += numeric(row.amount_paid)
  }

  const liveStatuses = new Set(["in_progress", "registration_open"])
  const upcomingEvents = events
    .filter((event) => !event.start_date || event.start_date >= todayKey)
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      name: event.name,
      startDate: event.start_date,
      status: event.status,
      registrations: registrationCountByEvent.get(event.id) ?? 0,
    }))

  const season = seasonResult.data as { id: string; name: string; start_date: string; end_date: string } | null
  const outstandingBalance = Math.max(0, expectedRevenue - revenueCollected)

  return {
    organizationId,
    activeSeason: season ? { id: season.id, name: season.name, startDate: season.start_date, endDate: season.end_date } : null,
    activeParticipants: athletesResult.count ?? 0,
    activeTeams: teamsResult.count ?? 0,
    scheduledEvents: events.filter((event) => !event.start_date || event.start_date >= todayKey).length,
    liveEvents: events.filter((event) => liveStatuses.has(event.status ?? "")).length,
    registrationsThisWeek,
    totalRegistrations: registrations.length,
    revenueCollected,
    outstandingBalance,
    collectionRate: expectedRevenue > 0 ? Math.round((revenueCollected / expectedRevenue) * 100) : 0,
    upcomingEvents,
    recentTrend: Array.from(trendMap.values()),
  }
}
