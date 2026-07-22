import { supabase } from "@/lib/supabase"

export type SquadEvent = {
  id: string
  organization_id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string | null
}

export type SquadShoot = {
  id: string
  organization_id: string
  event_id: string
  name: string
  discipline: string
  competition_type: string | null
  shoot_date: string | null
  start_time: string | null
  squad_size: number | null
  status: string | null
}

export type SquadRecord = {
  id: string
  organization_id: string
  shoot_id: string
  squad_number: string
  name: string | null
  house_number: string | null
  course_name: string | null
  station_name: string | null
  flight_name: string | null
  start_time: string | null
  capacity: number
  sort_order: number
  assignment_method: string
  status: string
  is_locked: boolean
  notes: string | null
}

export type SquadMemberRecord = {
  id: string
  organization_id: string
  shoot_id: string
  squad_id: string
  registration_shoot_id: string
  position: number
  position_label: string | null
  assignment_method: string
  status: string
  is_squad_leader: boolean
  checked_in: boolean
}

export type EnrollmentRecord = {
  id: string
  organization_id: string
  event_id: string
  registration_id: string
  shoot_id: string
  status: string
}

export type RegistrationSnapshot = {
  id: string
  athlete_id: string
  team_id: string | null
  class_id: string | null
  registration_number: string | null
  status: string
}

export type AthleteSnapshot = {
  id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  cyssa_number: string | null
}

export type NamedRecord = { id: string; name: string }
export type ClassSnapshot = { id: string; code: string; display_name: string }

export type SquaddingData = {
  events: SquadEvent[]
  shoots: SquadShoot[]
  squads: SquadRecord[]
  members: SquadMemberRecord[]
  enrollments: EnrollmentRecord[]
  registrations: RegistrationSnapshot[]
  athletes: AthleteSnapshot[]
  teams: NamedRecord[]
  classes: ClassSnapshot[]
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadSquaddingBaseData(): Promise<Pick<SquaddingData, "events" | "shoots"> & { organizationId: string }> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  throwIfError(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error("You must be signed in to use squadding.")

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle()
  throwIfError(membershipError)
  if (!membership?.organization_id) throw new Error("No active organization membership was found.")

  const organizationId = membership.organization_id as string
  const [{ data: events, error: eventsError }, { data: shoots, error: shootsError }] = await Promise.all([
    supabase.from("events").select("id, organization_id, name, start_date, end_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
    supabase.from("shoots").select("id, organization_id, event_id, name, discipline, competition_type, shoot_date, start_time, squad_size, status").eq("organization_id", organizationId).eq("active", true).order("shoot_date").order("start_time"),
  ])
  throwIfError(eventsError)
  throwIfError(shootsError)

  return { organizationId, events: (events ?? []) as SquadEvent[], shoots: (shoots ?? []) as SquadShoot[] }
}

export async function loadShootSquaddingData(organizationId: string, eventId: string, shootId: string): Promise<Omit<SquaddingData, "events" | "shoots">> {
  const [squadsResult, membersResult, enrollmentsResult, registrationsResult, athletesResult, teamsResult, classesResult] = await Promise.all([
    supabase.from("squads").select("id, organization_id, shoot_id, squad_number, name, house_number, course_name, station_name, flight_name, start_time, capacity, sort_order, assignment_method, status, is_locked, notes").eq("organization_id", organizationId).eq("shoot_id", shootId).order("sort_order").order("squad_number"),
    supabase.from("squad_members").select("id, organization_id, shoot_id, squad_id, registration_shoot_id, position, position_label, assignment_method, status, is_squad_leader, checked_in").eq("organization_id", organizationId).eq("shoot_id", shootId).order("position"),
    supabase.from("registration_shoots").select("id, organization_id, event_id, registration_id, shoot_id, status").eq("organization_id", organizationId).eq("shoot_id", shootId).not("status", "in", "(withdrawn,cancelled)"),
    supabase.from("registrations").select("id, athlete_id, team_id, class_id, registration_number, status").eq("organization_id", organizationId).eq("event_id", eventId),
    supabase.from("athletes").select("id, first_name, last_name, preferred_name, cyssa_number").eq("organization_id", organizationId),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabase.from("classes").select("id, code, display_name").eq("organization_id", organizationId).eq("active", true).order("display_order"),
  ])

  for (const result of [squadsResult, membersResult, enrollmentsResult, registrationsResult, athletesResult, teamsResult, classesResult]) throwIfError(result.error)

  return {
    squads: (squadsResult.data ?? []) as SquadRecord[],
    members: (membersResult.data ?? []) as SquadMemberRecord[],
    enrollments: (enrollmentsResult.data ?? []) as EnrollmentRecord[],
    registrations: (registrationsResult.data ?? []) as RegistrationSnapshot[],
    athletes: (athletesResult.data ?? []) as AthleteSnapshot[],
    teams: (teamsResult.data ?? []) as NamedRecord[],
    classes: (classesResult.data ?? []) as ClassSnapshot[],
  }
}

export async function createSquad(payload: Omit<SquadRecord, "id" | "status" | "is_locked">) {
  const { error } = await supabase.from("squads").insert({ ...payload, status: "open", is_locked: false })
  throwIfError(error)
}

export async function updateSquad(squadId: string, payload: Partial<SquadRecord>) {
  const { error } = await supabase.from("squads").update(payload).eq("id", squadId)
  throwIfError(error)
}

export async function deleteSquad(squadId: string) {
  const { error } = await supabase.from("squads").delete().eq("id", squadId)
  throwIfError(error)
}

export async function assignEnrollment(params: { organizationId: string; shootId: string; squadId: string; registrationShootId: string; position: number; label: string; method?: "manual" | "automatic" }) {
  const { error } = await supabase.from("squad_members").insert({
    organization_id: params.organizationId,
    shoot_id: params.shootId,
    squad_id: params.squadId,
    registration_shoot_id: params.registrationShootId,
    position: params.position,
    position_label: params.label,
    assignment_method: params.method ?? "manual",
    status: "assigned",
  })
  throwIfError(error)
}

export async function moveMember(memberId: string, squadId: string, position: number, label: string) {
  const { error } = await supabase.from("squad_members").update({ squad_id: squadId, position, position_label: label, assignment_method: "manual" }).eq("id", memberId)
  throwIfError(error)
}

export async function removeMember(memberId: string) {
  const { error } = await supabase.from("squad_members").delete().eq("id", memberId)
  throwIfError(error)
}
