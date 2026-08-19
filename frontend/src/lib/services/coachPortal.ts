import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type CoachTeam = {
  id: string
  name: string
  school_club_name: string | null
  mascot: string | null
  primary_color: string | null
  secondary_color: string | null
  notes: string | null
}
export type CoachAthlete = { id: string; first_name: string; last_name: string; preferred_name: string | null; class_id: string | null; cyssa_number: string | null; email: string | null; phone: string | null }
export type CoachEvent = { id: string; name: string; start_date: string | null; end_date: string | null; status: string }
export type CoachShoot = { id: string; event_id: string; name: string; discipline: string; shoot_date: string | null; number_of_rounds: number; targets_per_round: number }
export type CoachRegistration = { id: string; event_id: string; athlete_id: string; team_id: string | null; class_id: string | null; status: string; checked_in: boolean; payment_status: string }
export type CoachEnrollment = { id: string; registration_id: string; shoot_id: string; status: string; squad_assignment_status: string; historical_total_score: number | null }
export type CoachSquadMember = { id: string; shoot_id: string; squad_id: string; registration_shoot_id: string; position: number; position_label: string | null; checked_in: boolean }
export type CoachSquad = { id: string; shoot_id: string; squad_number: string; house_number: string | null; course_name: string | null; start_time: string | null }
export type CoachScore = { squad_member_id: string; round_number: number; score: number | null; status: string }
export type CoachDigitalScorecard = {
  squad_member_id: string
  status: "draft" | "finalized"
  total_score: number
  total_targets: number
}
export type CoachClass = { id: string; code: string; display_name: string }
export type CoachAnnouncement = { id: string; title: string; message: string; severity: string; created_at: string; event_id: string | null }

type QueryError = { message?: string } | null
type PageResult<T> = { data: T[] | null; error: QueryError }

const PAGE_SIZE = 1000

function assert(error: QueryError) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

async function loadAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await loadPage(from, from + PAGE_SIZE - 1)
    assert(result.error)

    const page = result.data ?? []
    rows.push(...page)

    if (page.length < PAGE_SIZE) break
  }

  return rows
}

export async function loadCoachPortalData() {
  const context = await getCurrentOrganizationContext()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() || ""

  const [
    coachResult,
    teamsResult,
    eventsResult,
    shootsResult,
    classesResult,
    announcementsResult,
    assignments,
    athleteTeams,
    athletes,
    registrations,
    enrollments,
    squads,
    members,
    scores,
    digitalScorecards,
  ] = await Promise.all([
    supabase.from("coaches").select("id, first_name, last_name, preferred_name, email, user_id").eq("organization_id", context.organizationId),
    supabase.from("teams").select("id, name, school_club_name, mascot, primary_color, secondary_color, notes").eq("organization_id", context.organizationId).eq("active", true).order("name"),
    supabase.from("events").select("id, name, start_date, end_date, status").eq("organization_id", context.organizationId).order("start_date", { ascending: false }),
    supabase.from("shoots").select("id, event_id, name, discipline, shoot_date, number_of_rounds, targets_per_round").eq("organization_id", context.organizationId).eq("active", true).order("shoot_date", { ascending: false }),
    supabase.from("classes").select("id, code, display_name").eq("organization_id", context.organizationId).order("display_order"),
    supabase.from("coach_announcements").select("id, title, message, severity, created_at, event_id").eq("organization_id", context.organizationId).eq("active", true).order("created_at", { ascending: false }).limit(20),

    loadAllPages((from, to) =>
      supabase.from("team_coaches").select("coach_id, team_id, role, is_head_coach, start_date, end_date").eq("organization_id", context.organizationId).range(from, to)
    ),
    loadAllPages((from, to) =>
      supabase.from("athlete_teams").select("athlete_id, team_id, is_primary, start_date, end_date").eq("organization_id", context.organizationId).range(from, to)
    ),
    loadAllPages<CoachAthlete>((from, to) =>
      supabase.from("athletes").select("id, first_name, last_name, preferred_name, class_id, cyssa_number, email, phone").eq("organization_id", context.organizationId).eq("active", true).order("last_name").range(from, to)
    ),
    loadAllPages<CoachRegistration>((from, to) =>
      supabase.from("registrations").select("id, event_id, athlete_id, team_id, class_id, status, checked_in, payment_status").eq("organization_id", context.organizationId).range(from, to)
    ),
    loadAllPages<CoachEnrollment>((from, to) =>
      supabase.from("registration_shoots").select("id, registration_id, shoot_id, status, squad_assignment_status, historical_total_score").eq("organization_id", context.organizationId).range(from, to)
    ),
    loadAllPages<CoachSquad>((from, to) =>
      supabase.from("squads").select("id, shoot_id, squad_number, house_number, course_name, start_time").eq("organization_id", context.organizationId).range(from, to)
    ),
    loadAllPages<CoachSquadMember>((from, to) =>
      supabase.from("squad_members").select("id, shoot_id, squad_id, registration_shoot_id, position, position_label, checked_in").eq("organization_id", context.organizationId).range(from, to)
    ),
    loadAllPages<CoachScore>((from, to) =>
      supabase.from("score_entries").select("squad_member_id, round_number, score, status").eq("organization_id", context.organizationId).range(from, to)
    ),
    loadAllPages<CoachDigitalScorecard>((from, to) =>
      supabase.from("digital_scorecards").select("squad_member_id, status, total_score, total_targets").eq("organization_id", context.organizationId).range(from, to)
    ),
  ])

  for (const result of [coachResult, teamsResult, eventsResult, shootsResult, classesResult]) {
    assert(result.error)
  }

  if (
    announcementsResult.error &&
    !announcementsResult.error.message.toLowerCase().includes("coach_announcements")
  ) {
    assert(announcementsResult.error)
  }

  const coaches = coachResult.data ?? []
  const coach =
    coaches.find((row) => row.user_id === context.userId) ??
    coaches.find((row) => (row.email || "").trim().toLowerCase() === email) ??
    null

  const isManager = ["owner", "admin"].includes(context.role)
  const today = new Date().toISOString().slice(0, 10)

  const assignedTeamIds = new Set(
    assignments
      .filter((row) => !coach || row.coach_id === coach.id)
      .filter((row) => !row.end_date || row.end_date >= today)
      .map((row) => row.team_id),
  )

  const teams = (teamsResult.data ?? []).filter(
    (team) => isManager || assignedTeamIds.has(team.id),
  ) as CoachTeam[]

  return {
    context,
    coach,
    isManager,
    teams,
    athleteTeams,
    athletes,
    events: (eventsResult.data ?? []) as CoachEvent[],
    shoots: (shootsResult.data ?? []) as CoachShoot[],
    registrations,
    enrollments,
    squads,
    members,
    scores,
    digitalScorecards,
    classes: (classesResult.data ?? []) as CoachClass[],
    announcements: (announcementsResult.data ?? []) as CoachAnnouncement[],
  }
}

export type TeamManagementPayload = {
  name: string
  school_club_name: string | null
  mascot: string | null
  primary_color: string | null
  secondary_color: string | null
  notes: string | null
}

export type CoachManagementRecord = {
  id: string
  first_name: string
  last_name: string
  preferred_name: string | null
  email: string | null
  phone: string | null
  active: boolean
}

export type TeamCoachAssignment = {
  id: string
  team_id: string
  coach_id: string
  role: string
  start_date: string | null
  end_date: string | null
  is_head_coach: boolean
}

function cleanOptional(value: string | null | undefined) {
  const cleaned = value?.trim() ?? ""
  return cleaned.length > 0 ? cleaned : null
}

export async function updateCoachPortalTeam(
  teamId: string,
  payload: TeamManagementPayload,
) {
  const context = await getCurrentOrganizationContext()

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error("Only an owner or administrator can edit team details.")
  }

  const name = payload.name.trim()

  if (!name) {
    throw new Error("Team name is required.")
  }

  const { error } = await supabase
    .from("teams")
    .update({
      name,
      school_club_name: cleanOptional(payload.school_club_name),
      mascot: cleanOptional(payload.mascot),
      primary_color: cleanOptional(payload.primary_color),
      secondary_color: cleanOptional(payload.secondary_color),
      notes: cleanOptional(payload.notes),
    })
    .eq("organization_id", context.organizationId)
    .eq("id", teamId)

  assert(error)
}

export async function loadCoachManagementData() {
  const context = await getCurrentOrganizationContext()

  if (!["owner", "admin"].includes(context.role)) {
    return {
      coaches: [] as CoachManagementRecord[],
      assignments: [] as TeamCoachAssignment[],
    }
  }

  const [coaches, assignments] = await Promise.all([
    loadAllPages<CoachManagementRecord>((from, to) =>
      supabase
        .from("coaches")
        .select(
          "id, first_name, last_name, preferred_name, email, phone, active",
        )
        .eq("organization_id", context.organizationId)
        .eq("active", true)
        .order("last_name")
        .order("first_name")
        .range(from, to),
    ),
    loadAllPages<TeamCoachAssignment>((from, to) =>
      supabase
        .from("team_coaches")
        .select(
          "id, team_id, coach_id, role, start_date, end_date, is_head_coach",
        )
        .eq("organization_id", context.organizationId)
        .range(from, to),
    ),
  ])

  return { coaches, assignments }
}

export async function assignCoachToTeam(input: {
  teamId: string
  coachId: string
  role: string
  isHeadCoach: boolean
}) {
  const context = await getCurrentOrganizationContext()

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error("Only an owner or administrator can assign coaches.")
  }

  const role = input.role.trim() || "coach"

  const { error } = await supabase.from("team_coaches").insert({
    organization_id: context.organizationId,
    team_id: input.teamId,
    coach_id: input.coachId,
    role,
    is_head_coach: input.isHeadCoach,
    start_date: new Date().toISOString().slice(0, 10),
  })

  assert(error)
}

export async function endCoachTeamAssignment(assignmentId: string) {
  const context = await getCurrentOrganizationContext()

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error("Only an owner or administrator can change coach assignments.")
  }

  const { error } = await supabase
    .from("team_coaches")
    .update({
      end_date: new Date().toISOString().slice(0, 10),
    })
    .eq("organization_id", context.organizationId)
    .eq("id", assignmentId)

  assert(error)
}

export async function createCoachPortalTeam(input: {
  name: string
  schoolClubName?: string | null
}) {
  const context = await getCurrentOrganizationContext()

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error(
      "Only an owner or administrator can create teams.",
    )
  }

  const name = input.name.trim()

  if (!name) {
    throw new Error("Team name is required.")
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({
      organization_id: context.organizationId,
      name,
      school_club_name: cleanOptional(
        input.schoolClubName,
      ),
      active: true,
    })
    .select(
      "id, name, school_club_name, mascot, primary_color, secondary_color, notes",
    )
    .single()

  assert(error)

  if (!data) {
    throw new Error("The team could not be created.")
  }

  return data as CoachTeam
}

export async function createCoachPortalCoach(input: {
  firstName: string
  lastName: string
  preferredName?: string | null
  email?: string | null
  phone?: string | null
}) {
  const context = await getCurrentOrganizationContext()

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error(
      "Only an owner or administrator can create coaches.",
    )
  }

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()

  if (!firstName) {
    throw new Error("Coach first name is required.")
  }

  if (!lastName) {
    throw new Error("Coach last name is required.")
  }

  const { data, error } = await supabase
    .from("coaches")
    .insert({
      organization_id: context.organizationId,
      first_name: firstName,
      last_name: lastName,
      preferred_name: cleanOptional(
        input.preferredName,
      ),
      email: cleanOptional(input.email),
      phone: cleanOptional(input.phone),
      active: true,
    })
    .select(
      "id, first_name, last_name, preferred_name, email, phone, active",
    )
    .single()

  assert(error)

  if (!data) {
    throw new Error("The coach could not be created.")
  }

  return data as CoachManagementRecord
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", encoded)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function createActivationToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function createCoachActivationLink(
  coachId: string,
) {
  const context = await getCurrentOrganizationContext()

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error(
      "Only an owner or administrator can create coach activation links.",
    )
  }

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id,email,user_id")
    .eq("organization_id", context.organizationId)
    .eq("id", coachId)
    .single()

  assert(coachError)

  if (!coach) {
    throw new Error("Coach not found.")
  }

  if (!coach.email?.trim()) {
    throw new Error(
      "Add an email address to this coach before creating an activation link.",
    )
  }

  if (coach.user_id) {
    throw new Error(
      "This coach already has a ClayKeeper account.",
    )
  }

  const token = createActivationToken()
  const tokenHash = await sha256Hex(token)

  const { data: expiresAt, error } = await supabase.rpc(
    "create_coach_account_invitation",
    {
      p_coach_id: coachId,
      p_token_hash: tokenHash,
    },
  )

  assert(error)

  const url = new URL(
    `/coach-activate/${encodeURIComponent(token)}`,
    window.location.origin,
  )

  return {
    activationUrl: url.toString(),
    expiresAt: String(expiresAt || ""),
    email: coach.email.trim(),
  }
}

export async function updateCoachPortalCoach(
  coachId: string,
  input: {
    firstName: string
    lastName: string
    preferredName?: string | null
    email?: string | null
    phone?: string | null
  },
) {
  const context = await getCurrentOrganizationContext()

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error(
      "Only an owner or administrator can edit coaches.",
    )
  }

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()

  if (!firstName) {
    throw new Error("Coach first name is required.")
  }

  if (!lastName) {
    throw new Error("Coach last name is required.")
  }

  const { error } = await supabase
    .from("coaches")
    .update({
      first_name: firstName,
      last_name: lastName,
      preferred_name: cleanOptional(
        input.preferredName,
      ),
      email: cleanOptional(input.email),
      phone: cleanOptional(input.phone),
    })
    .eq("organization_id", context.organizationId)
    .eq("id", coachId)

  assert(error)
}
