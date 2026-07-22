import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/services/organizationContext"

export type ScoringEvent = { id: string; organization_id: string; name: string; start_date: string | null; status: string | null }
export type ScoringShoot = { id: string; organization_id: string; event_id: string; name: string; discipline: string; shoot_date: string | null; targets_per_round: number; number_of_rounds: number; allow_score_entry: boolean; status: string | null }
export type ScoringSquad = { id: string; shoot_id: string; squad_number: string; name: string | null; house_number: string | null; course_name: string | null; station_name: string | null; status: string; sort_order: number }
export type ScoringMember = { id: string; squad_id: string; registration_shoot_id: string; position: number; position_label: string | null; status: string }
export type ScoringEnrollment = { id: string; registration_id: string }
export type ScoringRegistration = { id: string; athlete_id: string; team_id: string | null; class_id: string | null }
export type ScoringAthlete = { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null; cyssa_number: string | null }
export type ScoringNamedRecord = { id: string; name: string }
export type ScoringClass = { id: string; code: string; display_name: string }
export type ScoreEntry = { id: string; squad_member_id: string; round_number: number; score: number | null; status: string }
export type ShootOffRound = { id: string; round_number: number; label: string | null }
export type ShootOffScore = { id: string; shoot_off_round_id: string; squad_member_id: string; score: number | null }

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadScoringBaseData() {
  const organizationId = await getCurrentOrganizationId()

  const [eventsResult, shootsResult] = await Promise.all([
    supabase.from("events").select("id, organization_id, name, start_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
    supabase.from("shoots").select("id, organization_id, event_id, name, discipline, shoot_date, targets_per_round, number_of_rounds, allow_score_entry, status").eq("organization_id", organizationId).eq("active", true).order("shoot_date"),
  ])
  throwIfError(eventsResult.error); throwIfError(shootsResult.error)
  return { organizationId, events: (eventsResult.data ?? []) as ScoringEvent[], shoots: (shootsResult.data ?? []) as ScoringShoot[] }
}

export async function loadShootScoringData(organizationId: string, eventId: string, shootId: string) {
  const [squads, members, enrollments, registrations, athletes, teams, classes, scores, shootOffRounds, shootOffScores] = await Promise.all([
    supabase.from("squads").select("id, shoot_id, squad_number, name, house_number, course_name, station_name, status, sort_order").eq("organization_id", organizationId).eq("shoot_id", shootId).order("sort_order").order("squad_number"),
    supabase.from("squad_members").select("id, squad_id, registration_shoot_id, position, position_label, status").eq("organization_id", organizationId).eq("shoot_id", shootId).order("position"),
    supabase.from("registration_shoots").select("id, registration_id").eq("organization_id", organizationId).eq("shoot_id", shootId),
    supabase.from("registrations").select("id, athlete_id, team_id, class_id").eq("organization_id", organizationId).eq("event_id", eventId),
    supabase.from("athletes").select("id, first_name, last_name, preferred_name, cyssa_number").eq("organization_id", organizationId),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId),
    supabase.from("classes").select("id, code, display_name").eq("organization_id", organizationId),
    supabase.from("score_entries").select("id, squad_member_id, round_number, score, status").eq("organization_id", organizationId).eq("shoot_id", shootId),
    supabase.from("shoot_off_rounds").select("id, round_number, label").eq("organization_id", organizationId).eq("shoot_id", shootId).order("round_number"),
    supabase.from("shoot_off_scores").select("id, shoot_off_round_id, squad_member_id, score").eq("organization_id", organizationId).eq("shoot_id", shootId),
  ])
  for (const result of [squads, members, enrollments, registrations, athletes, teams, classes, scores, shootOffRounds, shootOffScores]) throwIfError(result.error)
  return {
    squads: (squads.data ?? []) as ScoringSquad[], members: (members.data ?? []) as ScoringMember[], enrollments: (enrollments.data ?? []) as ScoringEnrollment[],
    registrations: (registrations.data ?? []) as ScoringRegistration[], athletes: (athletes.data ?? []) as ScoringAthlete[], teams: (teams.data ?? []) as ScoringNamedRecord[], classes: (classes.data ?? []) as ScoringClass[],
    scores: (scores.data ?? []) as ScoreEntry[], shootOffRounds: (shootOffRounds.data ?? []) as ShootOffRound[], shootOffScores: (shootOffScores.data ?? []) as ShootOffScore[],
  }
}

export async function saveRoundScore(params: { organizationId: string; eventId: string; shootId: string; squadMemberId: string; roundNumber: number; score: number | null }) {
  if (params.score === null) {
    const { error } = await supabase.from("score_entries").delete().eq("squad_member_id", params.squadMemberId).eq("round_number", params.roundNumber)
    throwIfError(error); return
  }
  const { error } = await supabase.from("score_entries").upsert({
    organization_id: params.organizationId, event_id: params.eventId, shoot_id: params.shootId, squad_member_id: params.squadMemberId,
    round_number: params.roundNumber, score: params.score, status: "entered",
  }, { onConflict: "squad_member_id,round_number" })
  throwIfError(error)
}

export async function createShootOffRound(params: { organizationId: string; eventId: string; shootId: string; roundNumber: number }) {
  const { error } = await supabase.from("shoot_off_rounds").insert({ ...params, label: `SO${params.roundNumber}` })
  throwIfError(error)
}
export async function deleteShootOffRound(roundId: string) { const { error } = await supabase.from("shoot_off_rounds").delete().eq("id", roundId); throwIfError(error) }
export async function saveShootOffScore(params: { organizationId: string; eventId: string; shootId: string; roundId: string; squadMemberId: string; score: number | null }) {
  if (params.score === null) { const { error } = await supabase.from("shoot_off_scores").delete().eq("shoot_off_round_id", params.roundId).eq("squad_member_id", params.squadMemberId); throwIfError(error); return }
  const { error } = await supabase.from("shoot_off_scores").upsert({ organization_id: params.organizationId, event_id: params.eventId, shoot_id: params.shootId, shoot_off_round_id: params.roundId, squad_member_id: params.squadMemberId, score: params.score }, { onConflict: "shoot_off_round_id,squad_member_id" })
  throwIfError(error)
}
