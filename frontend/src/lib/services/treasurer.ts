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

export async function loadTreasurerData() {
  const organizationId = await getCurrentOrganizationId()
  const [seasons, events, shoots, registrations, enrollments, athletes, teams, classes] = await Promise.all([
    supabase.from("seasons").select("id, name, start_date, end_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
    supabase.from("events").select("id, season_id, name, start_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
    supabase.from("shoots").select("id, event_id, name, discipline").eq("organization_id", organizationId),
    supabase.from("registrations").select("id, event_id, athlete_id, team_id, class_id, status, payment_status, payment_method, registration_fee, discount_amount, amount_paid, registration_source").eq("organization_id", organizationId),
    supabase.from("registration_shoots").select("id, registration_id, shoot_id, status, entry_fee, organization_fee, fee_adjustment, total_fee").eq("organization_id", organizationId),
    supabase.from("athletes").select("id, first_name, last_name, preferred_name, cyssa_number").eq("organization_id", organizationId),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId),
    supabase.from("classes").select("id, code, display_name").eq("organization_id", organizationId).order("display_order"),
  ])

  for (const result of [seasons, events, shoots, registrations, enrollments, athletes, teams, classes]) throwIfError(result.error)

  return {
    seasons: (seasons.data ?? []) as TreasurerSeason[],
    events: (events.data ?? []) as TreasurerEvent[],
    shoots: (shoots.data ?? []) as TreasurerShoot[],
    registrations: (registrations.data ?? []) as TreasurerRegistration[],
    enrollments: (enrollments.data ?? []) as TreasurerEnrollment[],
    athletes: (athletes.data ?? []) as TreasurerAthlete[],
    teams: (teams.data ?? []) as TreasurerNamedRecord[],
    classes: (classes.data ?? []) as TreasurerClass[],
  }
}
