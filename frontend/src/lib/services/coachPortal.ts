import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type CoachTeam = { id: string; name: string; school_club_name: string | null; primary_color: string | null }
export type CoachAthlete = { id: string; first_name: string; last_name: string; preferred_name: string | null; class_id: string | null; cyssa_number: string | null; email: string | null; phone: string | null }
export type CoachEvent = { id: string; name: string; start_date: string | null; end_date: string | null; status: string }
export type CoachShoot = { id: string; event_id: string; name: string; discipline: string; shoot_date: string | null; number_of_rounds: number; targets_per_round: number }
export type CoachRegistration = { id: string; event_id: string; athlete_id: string; team_id: string | null; class_id: string | null; status: string; checked_in: boolean; payment_status: string }
export type CoachEnrollment = { id: string; registration_id: string; shoot_id: string; status: string; squad_assignment_status: string; historical_total_score: number | null }
export type CoachSquadMember = { id: string; shoot_id: string; squad_id: string; registration_shoot_id: string; position: number; position_label: string | null; checked_in: boolean }
export type CoachSquad = { id: string; shoot_id: string; squad_number: string; house_number: string | null; course_name: string | null; start_time: string | null }
export type CoachScore = { squad_member_id: string; round_number: number; score: number | null; status: string }
export type CoachClass = { id: string; code: string; display_name: string }
export type CoachAnnouncement = { id: string; title: string; message: string; severity: string; created_at: string; event_id: string | null }

function assert(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadCoachPortalData() {
  const context = await getCurrentOrganizationContext()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() || ""

  const [coachResult, teamsResult, assignmentsResult, athleteTeamsResult, athletesResult, eventsResult, shootsResult, registrationsResult, enrollmentsResult, squadsResult, membersResult, scoresResult, classesResult, announcementsResult] = await Promise.all([
    supabase.from("coaches").select("id, first_name, last_name, preferred_name, email, user_id").eq("organization_id", context.organizationId),
    supabase.from("teams").select("id, name, school_club_name, primary_color").eq("organization_id", context.organizationId).eq("active", true).order("name"),
    supabase.from("team_coaches").select("coach_id, team_id, role, is_head_coach, start_date, end_date").eq("organization_id", context.organizationId),
    supabase.from("athlete_teams").select("athlete_id, team_id, is_primary, start_date, end_date").eq("organization_id", context.organizationId),
    supabase.from("athletes").select("id, first_name, last_name, preferred_name, class_id, cyssa_number, email, phone").eq("organization_id", context.organizationId).eq("active", true).order("last_name"),
    supabase.from("events").select("id, name, start_date, end_date, status").eq("organization_id", context.organizationId).order("start_date", { ascending: false }),
    supabase.from("shoots").select("id, event_id, name, discipline, shoot_date, number_of_rounds, targets_per_round").eq("organization_id", context.organizationId).eq("active", true).order("shoot_date", { ascending: false }),
    supabase.from("registrations").select("id, event_id, athlete_id, team_id, class_id, status, checked_in, payment_status").eq("organization_id", context.organizationId),
    supabase.from("registration_shoots").select("id, registration_id, shoot_id, status, squad_assignment_status, historical_total_score").eq("organization_id", context.organizationId),
    supabase.from("squads").select("id, shoot_id, squad_number, house_number, course_name, start_time").eq("organization_id", context.organizationId),
    supabase.from("squad_members").select("id, shoot_id, squad_id, registration_shoot_id, position, position_label, checked_in").eq("organization_id", context.organizationId),
    supabase.from("score_entries").select("squad_member_id, round_number, score, status").eq("organization_id", context.organizationId),
    supabase.from("classes").select("id, code, display_name").eq("organization_id", context.organizationId).order("display_order"),
    supabase.from("coach_announcements").select("id, title, message, severity, created_at, event_id").eq("organization_id", context.organizationId).eq("active", true).order("created_at", { ascending: false }).limit(20),
  ])

  for (const result of [coachResult, teamsResult, assignmentsResult, athleteTeamsResult, athletesResult, eventsResult, shootsResult, registrationsResult, enrollmentsResult, squadsResult, membersResult, scoresResult, classesResult]) assert(result.error)
  // The announcements table is introduced by the Sprint 16 migration. Keep the portal usable before migration is applied.
  if (announcementsResult.error && !announcementsResult.error.message.toLowerCase().includes("coach_announcements")) assert(announcementsResult.error)

  const coaches = coachResult.data ?? []
  const coach = coaches.find((row) => row.user_id === context.userId) ?? coaches.find((row) => (row.email || "").trim().toLowerCase() === email) ?? null
  const isManager = ["owner", "admin"].includes(context.role)
  const assignedTeamIds = new Set((assignmentsResult.data ?? []).filter((row) => !coach || row.coach_id === coach.id).filter((row) => !row.end_date || row.end_date >= new Date().toISOString().slice(0, 10)).map((row) => row.team_id))
  const teams = (teamsResult.data ?? []).filter((team) => isManager || assignedTeamIds.has(team.id)) as CoachTeam[]

  return {
    context,
    coach,
    isManager,
    teams,
    athleteTeams: athleteTeamsResult.data ?? [],
    athletes: (athletesResult.data ?? []) as CoachAthlete[],
    events: (eventsResult.data ?? []) as CoachEvent[],
    shoots: (shootsResult.data ?? []) as CoachShoot[],
    registrations: (registrationsResult.data ?? []) as CoachRegistration[],
    enrollments: (enrollmentsResult.data ?? []) as CoachEnrollment[],
    squads: (squadsResult.data ?? []) as CoachSquad[],
    members: (membersResult.data ?? []) as CoachSquadMember[],
    scores: (scoresResult.data ?? []) as CoachScore[],
    classes: (classesResult.data ?? []) as CoachClass[],
    announcements: (announcementsResult.data ?? []) as CoachAnnouncement[],
  }
}
