import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type DashboardEvent = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string | null
}

export type DashboardShoot = {
  id: string
  event_id: string
  name: string
  discipline: string
  shoot_date: string | null
  number_of_rounds: number
  status: string | null
}

export type DashboardSnapshot = {
  organizationId: string
  events: DashboardEvent[]
  shoots: DashboardShoot[]
  activeParticipants: number
  registrations: number
  checkedIn: number
  squads: number
  assignedParticipants: number
  scoreEntries: number
  expectedScoreEntries: number
  upcomingShoots: DashboardShoot[]
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const organizationId = await getCurrentOrganizationId()
  const today = new Date().toISOString().slice(0, 10)

  const [eventsResult, shootsResult, athletesResult, registrationsResult, squadsResult, membersResult, scoresResult] = await Promise.all([
    supabase.from("events").select("id, name, start_date, end_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
    supabase.from("shoots").select("id, event_id, name, discipline, shoot_date, number_of_rounds, status").eq("organization_id", organizationId).eq("active", true).order("shoot_date"),
    supabase.from("athletes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("active", true),
    supabase.from("registrations").select("id, checked_in").eq("organization_id", organizationId).neq("status", "cancelled"),
    supabase.from("squads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("squad_members").select("id, shoot_id").eq("organization_id", organizationId).neq("status", "withdrawn"),
    supabase.from("score_entries").select("id, shoot_id, score").eq("organization_id", organizationId).not("score", "is", null),
  ])

  for (const result of [eventsResult, shootsResult, athletesResult, registrationsResult, squadsResult, membersResult, scoresResult]) {
    throwIfError(result.error)
  }

  const shoots = (shootsResult.data ?? []) as DashboardShoot[]
  const roundsByShoot = new Map(shoots.map((shoot) => [shoot.id, shoot.number_of_rounds || 0]))
  const members = (membersResult.data ?? []) as Array<{ id: string; shoot_id: string }>
  const expectedScoreEntries = members.reduce((total, member) => total + (roundsByShoot.get(member.shoot_id) ?? 0), 0)
  const registrations = (registrationsResult.data ?? []) as Array<{ id: string; checked_in: boolean }>

  return {
    organizationId,
    events: (eventsResult.data ?? []) as DashboardEvent[],
    shoots,
    activeParticipants: athletesResult.count ?? 0,
    registrations: registrations.length,
    checkedIn: registrations.filter((row) => row.checked_in).length,
    squads: squadsResult.count ?? 0,
    assignedParticipants: members.length,
    scoreEntries: (scoresResult.data ?? []).length,
    expectedScoreEntries,
    upcomingShoots: shoots.filter((shoot) => !shoot.shoot_date || shoot.shoot_date >= today).slice(0, 6),
  }
}
