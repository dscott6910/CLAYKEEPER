import { supabase } from "@/lib/supabase"

export type ParticipantClass = {
  id: string
  code: string
  display_name: string
}

export type ParticipantTeam = {
  id: string
  name: string
}

export type ParticipantRecord = {
  id: string
  organization_id: string
  class_id: string | null
  first_name: string
  last_name: string
  preferred_name: string | null
  birth_date: string | null
  gender: string | null
  graduation_year: number | null
  cyssa_number: string | null
  ata_number: string | null
  nssa_number: string | null
  external_id: string | null
  email: string | null
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
  team_id: string | null
  registration_count: number
}

export type ParticipantPayload = {
  organization_id: string
  class_id: string | null
  first_name: string
  last_name: string
  preferred_name: string | null
  birth_date: string | null
  gender: string | null
  graduation_year: number | null
  cyssa_number: string | null
  ata_number: string | null
  nssa_number: string | null
  email: string | null
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
  active: boolean
}

type AthleteRow = Omit<ParticipantRecord, "team_id" | "registration_count">
type TeamAssignmentRow = { athlete_id: string; team_id: string }
type RegistrationCountRow = { athlete_id: string }

async function getOrganizationId(): Promise<string> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("active", true)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data?.organization_id) {
    throw new Error("No active organization membership was found for this account.")
  }

  return data.organization_id
}

export async function getParticipantDirectory() {
  const organizationId = await getOrganizationId()

  const [athletesResult, classesResult, teamsResult, assignmentsResult, registrationsResult] = await Promise.all([
    supabase
      .from("athletes")
      .select("id,organization_id,class_id,first_name,last_name,preferred_name,birth_date,gender,graduation_year,cyssa_number,ata_number,nssa_number,external_id,email,phone,emergency_contact_name,emergency_contact_phone,notes,active,created_at,updated_at")
      .eq("organization_id", organizationId)
      .order("last_name")
      .order("first_name"),
    supabase
      .from("classes")
      .select("id,code,display_name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("display_order")
      .order("code"),
    supabase
      .from("teams")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("athlete_teams")
      .select("athlete_id,team_id")
      .eq("organization_id", organizationId)
      .eq("is_primary", true)
      .is("end_date", null),
    supabase
      .from("registrations")
      .select("athlete_id")
      .eq("organization_id", organizationId),
  ])

  for (const result of [athletesResult, classesResult, teamsResult, assignmentsResult, registrationsResult]) {
    if (result.error) throw result.error
  }

  const teamByAthlete = Object.fromEntries(
    ((assignmentsResult.data ?? []) as TeamAssignmentRow[]).map((row) => [row.athlete_id, row.team_id]),
  )
  const registrationCounts: Record<string, number> = {}
  for (const row of (registrationsResult.data ?? []) as RegistrationCountRow[]) {
    registrationCounts[row.athlete_id] = (registrationCounts[row.athlete_id] ?? 0) + 1
  }

  const participants = ((athletesResult.data ?? []) as AthleteRow[]).map((athlete) => ({
    ...athlete,
    team_id: teamByAthlete[athlete.id] ?? null,
    registration_count: registrationCounts[athlete.id] ?? 0,
  }))

  return {
    organizationId,
    participants,
    classes: (classesResult.data ?? []) as ParticipantClass[],
    teams: (teamsResult.data ?? []) as ParticipantTeam[],
  }
}

export async function createParticipant(payload: ParticipantPayload, teamId: string | null) {
  const { data, error } = await supabase
    .from("athletes")
    .insert(payload)
    .select("id")
    .single()

  if (error) throw error

  if (teamId) {
    const { error: teamError } = await supabase.from("athlete_teams").insert({
      organization_id: payload.organization_id,
      athlete_id: data.id,
      team_id: teamId,
      start_date: new Date().toISOString().slice(0, 10),
      is_primary: true,
    })
    if (teamError) throw teamError
  }

  return data.id as string
}

export async function updateParticipant(
  participantId: string,
  payload: ParticipantPayload,
  previousTeamId: string | null,
  nextTeamId: string | null,
) {
  const { error } = await supabase
    .from("athletes")
    .update(payload)
    .eq("id", participantId)

  if (error) throw error

  if (previousTeamId === nextTeamId) return

  if (previousTeamId) {
    const { error: closeError } = await supabase
      .from("athlete_teams")
      .update({ end_date: new Date().toISOString().slice(0, 10) })
      .eq("athlete_id", participantId)
      .eq("team_id", previousTeamId)
      .eq("is_primary", true)
      .is("end_date", null)

    if (closeError) throw closeError
  }

  if (nextTeamId) {
    const { error: insertError } = await supabase.from("athlete_teams").insert({
      organization_id: payload.organization_id,
      athlete_id: participantId,
      team_id: nextTeamId,
      start_date: new Date().toISOString().slice(0, 10),
      is_primary: true,
    })

    if (insertError) throw insertError
  }
}

export async function setParticipantActive(participantId: string, active: boolean) {
  const { error } = await supabase
    .from("athletes")
    .update({ active })
    .eq("id", participantId)

  if (error) throw error
}
