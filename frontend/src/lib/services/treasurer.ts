import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type TreasurerSeason = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
}

export type TreasurerEvent = {
  id: string
  season_id: string | null
  name: string
  start_date: string | null
  status: string
}

export type TreasurerShoot = {
  id: string
  event_id: string
  name: string
  discipline: string
}

export type TreasurerRegistration = {
  id: string
  event_id: string
  athlete_id: string
  team_id: string | null
  class_id: string | null
  status: string
  payment_status: string
  payment_method: string | null
  registration_fee: number
  discount_amount: number
  amount_paid: number
  registration_source: string
}

export type TreasurerEnrollment = {
  id: string
  registration_id: string
  shoot_id: string
  status: string
  entry_fee: number
  organization_fee: number
  fee_adjustment: number
  total_fee: number
}

export type TreasurerAthlete = {
  id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  cyssa_number: string | null
}

export type TreasurerNamedRecord = { id: string; name: string }
export type TreasurerClass = { id: string; code: string; display_name: string }

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

async function loadAllRows<T>(
  table: string,
  columns: string,
  organizationId: string,
) {
  const pageSize = 1000
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("organization_id", organizationId)
      .range(from, from + pageSize - 1)

    throwIfError(error)

    const page = (data ?? []) as T[]
    rows.push(...page)

    if (page.length < pageSize) break
  }

  return rows
}

export async function loadTreasurerData() {
  const organizationId = await getCurrentOrganizationId()

  const [seasons, events, shoots, registrations, enrollments, athletes, teams, classes] = await Promise.all([
    loadAllRows<TreasurerSeason>(
      "seasons",
      "id, name, start_date, end_date, status",
      organizationId,
    ),
    loadAllRows<TreasurerEvent>(
      "events",
      "id, season_id, name, start_date, status",
      organizationId,
    ),
    loadAllRows<TreasurerShoot>(
      "shoots",
      "id, event_id, name, discipline",
      organizationId,
    ),
    loadAllRows<TreasurerRegistration>(
      "registrations",
      "id, event_id, athlete_id, team_id, class_id, status, payment_status, payment_method, registration_fee, discount_amount, amount_paid, registration_source",
      organizationId,
    ),
    loadAllRows<TreasurerEnrollment>(
      "registration_shoots",
      "id, registration_id, shoot_id, status, entry_fee, organization_fee, fee_adjustment, total_fee",
      organizationId,
    ),
    loadAllRows<TreasurerAthlete>(
      "athletes",
      "id, first_name, last_name, preferred_name, cyssa_number",
      organizationId,
    ),
    loadAllRows<TreasurerNamedRecord>(
      "teams",
      "id, name",
      organizationId,
    ),
    loadAllRows<TreasurerClass>(
      "classes",
      "id, code, display_name",
      organizationId,
    ),
  ])

  seasons.sort((a, b) => b.start_date.localeCompare(a.start_date))
  events.sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""))
  classes.sort((a, b) => a.code.localeCompare(b.code))

  return {
    seasons,
    events,
    shoots,
    registrations,
    enrollments,
    athletes,
    teams,
    classes,
  }
}
