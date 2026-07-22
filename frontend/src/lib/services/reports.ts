import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type ReportEvent = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string | null
}

export type ReportShoot = {
  id: string
  event_id: string
  name: string
  discipline: string
  shoot_date: string | null
  targets_per_round: number
  number_of_rounds: number
  entry_fee: number
  organization_fee: number
}

export type ReportRegistration = {
  id: string
  athlete_id: string
  team_id: string | null
  class_id: string | null
  payment_status: string
  amount_paid: number
  registration_fee: number
  checked_in: boolean
  status: string
}

export type ReportEnrollment = {
  id: string
  registration_id: string
  shoot_id: string
  status: string
  total_fee: number
  squad_assignment_status: string
}

export type ReportAthlete = {
  id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  cyssa_number: string | null
}

export type ReportNamedRecord = { id: string; name: string }
export type ReportClass = { id: string; code: string; display_name: string }
export type ReportSquad = { id: string; squad_number: string; house_number: string | null; course_name: string | null }
export type ReportMember = { id: string; squad_id: string; registration_shoot_id: string; position: number; position_label: string | null }
export type ReportScore = { squad_member_id: string; round_number: number; score: number | null; status: string }
export type ReportShootOffRound = { id: string; round_number: number; label: string | null }
export type ReportShootOffScore = { shoot_off_round_id: string; squad_member_id: string; score: number | null }

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadReportBaseData() {
  const organizationId = await getCurrentOrganizationId()
  const [eventsResult, shootsResult] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, start_date, end_date, status")
      .eq("organization_id", organizationId)
      .order("start_date", { ascending: false }),
    supabase
      .from("shoots")
      .select("id, event_id, name, discipline, shoot_date, targets_per_round, number_of_rounds, entry_fee, organization_fee")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("shoot_date"),
  ])
  throwIfError(eventsResult.error)
  throwIfError(shootsResult.error)
  return {
    organizationId,
    events: (eventsResult.data ?? []) as ReportEvent[],
    shoots: (shootsResult.data ?? []) as ReportShoot[],
  }
}

export async function loadShootReportData(organizationId: string, eventId: string, shootId: string) {
  const [registrations, enrollments, athletes, teams, classes, squads, members, scores, shootOffRounds, shootOffScores] = await Promise.all([
    supabase.from("registrations").select("id, athlete_id, team_id, class_id, payment_status, amount_paid, registration_fee, checked_in, status").eq("organization_id", organizationId).eq("event_id", eventId),
    supabase.from("registration_shoots").select("id, registration_id, shoot_id, status, total_fee, squad_assignment_status").eq("organization_id", organizationId).eq("shoot_id", shootId),
    supabase.from("athletes").select("id, first_name, last_name, preferred_name, cyssa_number").eq("organization_id", organizationId),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId),
    supabase.from("classes").select("id, code, display_name").eq("organization_id", organizationId).order("display_order"),
    supabase.from("squads").select("id, squad_number, house_number, course_name").eq("organization_id", organizationId).eq("shoot_id", shootId),
    supabase.from("squad_members").select("id, squad_id, registration_shoot_id, position, position_label").eq("organization_id", organizationId).eq("shoot_id", shootId),
    supabase.from("score_entries").select("squad_member_id, round_number, score, status").eq("organization_id", organizationId).eq("shoot_id", shootId),
    supabase.from("shoot_off_rounds").select("id, round_number, label").eq("organization_id", organizationId).eq("shoot_id", shootId).order("round_number"),
    supabase.from("shoot_off_scores").select("shoot_off_round_id, squad_member_id, score").eq("organization_id", organizationId).eq("shoot_id", shootId),
  ])

  for (const result of [registrations, enrollments, athletes, teams, classes, squads, members, scores, shootOffRounds, shootOffScores]) {
    throwIfError(result.error)
  }

  return {
    registrations: (registrations.data ?? []) as ReportRegistration[],
    enrollments: (enrollments.data ?? []) as ReportEnrollment[],
    athletes: (athletes.data ?? []) as ReportAthlete[],
    teams: (teams.data ?? []) as ReportNamedRecord[],
    classes: (classes.data ?? []) as ReportClass[],
    squads: (squads.data ?? []) as ReportSquad[],
    members: (members.data ?? []) as ReportMember[],
    scores: (scores.data ?? []) as ReportScore[],
    shootOffRounds: (shootOffRounds.data ?? []) as ReportShootOffRound[],
    shootOffScores: (shootOffScores.data ?? []) as ReportShootOffScore[],
  }
}
