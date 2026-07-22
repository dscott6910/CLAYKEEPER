import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type DashboardEvent = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string | null
  location_name?: string | null
}

export type DashboardShoot = {
  id: string
  event_id: string
  name: string
  discipline: string
  shoot_date: string | null
  start_time: string | null
  number_of_rounds: number
  status: string | null
}

export type SquadOperationsRow = {
  id: string
  shootId: string
  shootName: string
  squadNumber: string
  startTime: string | null
  participantCount: number
  completedParticipants: number
  scoreEntries: number
  expectedScoreEntries: number
  status: "waiting" | "in_progress" | "complete"
}

export type DashboardSnapshot = {
  organizationId: string
  events: DashboardEvent[]
  selectedEvent: DashboardEvent | null
  shoots: DashboardShoot[]
  activeParticipants: number
  registrations: number
  checkedIn: number
  enrolledParticipants: number
  squads: number
  assignedParticipants: number
  unassignedParticipants: number
  scoreEntries: number
  expectedScoreEntries: number
  completedParticipants: number
  upcomingShoots: DashboardShoot[]
  squadOperations: SquadOperationsRow[]
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

function chooseDefaultEvent(events: DashboardEvent[], today: string) {
  return events.find((event) => {
    const startsBeforeToday = !event.start_date || event.start_date <= today
    const endsAfterToday = !event.end_date || event.end_date >= today
    return startsBeforeToday && endsAfterToday
  }) ?? events.find((event) => !event.start_date || event.start_date >= today) ?? events[0] ?? null
}

export async function loadDashboardSnapshot(requestedEventId?: string): Promise<DashboardSnapshot> {
  const organizationId = await getCurrentOrganizationId()
  const today = new Date().toISOString().slice(0, 10)

  const [eventsResult, athletesResult] = await Promise.all([
    supabase.from("events").select("id, name, start_date, end_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
    supabase.from("athletes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("active", true),
  ])
  throwIfError(eventsResult.error)
  throwIfError(athletesResult.error)

  const events = (eventsResult.data ?? []) as DashboardEvent[]
  const selectedEvent = events.find((event) => event.id === requestedEventId) ?? chooseDefaultEvent(events, today)

  if (!selectedEvent) {
    return {
      organizationId,
      events,
      selectedEvent: null,
      shoots: [],
      activeParticipants: athletesResult.count ?? 0,
      registrations: 0,
      checkedIn: 0,
      enrolledParticipants: 0,
      squads: 0,
      assignedParticipants: 0,
      unassignedParticipants: 0,
      scoreEntries: 0,
      expectedScoreEntries: 0,
      completedParticipants: 0,
      upcomingShoots: [],
      squadOperations: [],
    }
  }

  const eventId = selectedEvent.id
  const [shootsResult, registrationsResult, enrollmentResult] = await Promise.all([
    supabase.from("shoots").select("id, event_id, name, discipline, shoot_date, start_time, number_of_rounds, status").eq("organization_id", organizationId).eq("event_id", eventId).eq("active", true).order("shoot_date").order("start_time"),
    supabase.from("registrations").select("id, checked_in").eq("organization_id", organizationId).eq("event_id", eventId).neq("status", "cancelled"),
    supabase.from("registration_shoots").select("id, shoot_id").eq("organization_id", organizationId).eq("event_id", eventId).not("status", "in", "(withdrawn,cancelled)"),
  ])

  // Supabase cannot filter child tables until shoot IDs are known. Re-run those three
  // event-level queries with the resolved IDs while keeping the first group parallel.
  for (const result of [shootsResult, registrationsResult, enrollmentResult]) throwIfError(result.error)
  const shoots = (shootsResult.data ?? []) as DashboardShoot[]
  const shootIds = shoots.map((shoot) => shoot.id)

  let squadRows: Array<{ id: string; shoot_id: string; squad_number: string; start_time: string | null }> = []
  let memberRows: Array<{ id: string; shoot_id: string; squad_id: string; registration_shoot_id: string }> = []
  let scoreRows: Array<{ id: string; shoot_id: string; squad_member_id: string; round_number: number; score: number }> = []

  if (shootIds.length) {
    const [resolvedSquads, resolvedMembers, resolvedScores] = await Promise.all([
      supabase.from("squads").select("id, shoot_id, squad_number, start_time").eq("organization_id", organizationId).in("shoot_id", shootIds).order("start_time").order("squad_number"),
      supabase.from("squad_members").select("id, shoot_id, squad_id, registration_shoot_id").eq("organization_id", organizationId).in("shoot_id", shootIds).neq("status", "withdrawn"),
      supabase.from("score_entries").select("id, shoot_id, squad_member_id, round_number, score").eq("organization_id", organizationId).in("shoot_id", shootIds).not("score", "is", null),
    ])
    for (const result of [resolvedSquads, resolvedMembers, resolvedScores]) throwIfError(result.error)
    squadRows = resolvedSquads.data ?? []
    memberRows = resolvedMembers.data ?? []
    scoreRows = resolvedScores.data ?? []
  }

  const registrations = (registrationsResult.data ?? []) as Array<{ id: string; checked_in: boolean }>
  const enrollments = (enrollmentResult.data ?? []) as Array<{ id: string; shoot_id: string }>
  const roundsByShoot = new Map(shoots.map((shoot) => [shoot.id, Math.max(0, shoot.number_of_rounds || 0)]))
  const shootById = new Map(shoots.map((shoot) => [shoot.id, shoot]))
  const scoreCountByMember = new Map<string, number>()
  for (const score of scoreRows) scoreCountByMember.set(score.squad_member_id, (scoreCountByMember.get(score.squad_member_id) ?? 0) + 1)

  const assignedEnrollmentIds = new Set(memberRows.map((member) => member.registration_shoot_id))
  const completedParticipants = memberRows.filter((member) => {
    const expected = roundsByShoot.get(member.shoot_id) ?? 0
    return expected > 0 && (scoreCountByMember.get(member.id) ?? 0) >= expected
  }).length

  const squadOperations = squadRows.map((squad): SquadOperationsRow => {
    const squadMembers = memberRows.filter((member) => member.squad_id === squad.id)
    const expectedScoreEntries = squadMembers.reduce((total, member) => total + (roundsByShoot.get(member.shoot_id) ?? 0), 0)
    const scoreEntries = squadMembers.reduce((total, member) => total + (scoreCountByMember.get(member.id) ?? 0), 0)
    const completed = squadMembers.filter((member) => {
      const expected = roundsByShoot.get(member.shoot_id) ?? 0
      return expected > 0 && (scoreCountByMember.get(member.id) ?? 0) >= expected
    }).length
    const status: SquadOperationsRow["status"] = expectedScoreEntries > 0 && scoreEntries >= expectedScoreEntries
      ? "complete"
      : scoreEntries > 0
        ? "in_progress"
        : "waiting"

    return {
      id: squad.id,
      shootId: squad.shoot_id,
      shootName: shootById.get(squad.shoot_id)?.name ?? "Shoot",
      squadNumber: squad.squad_number,
      startTime: squad.start_time,
      participantCount: squadMembers.length,
      completedParticipants: completed,
      scoreEntries,
      expectedScoreEntries,
      status,
    }
  })

  const expectedScoreEntries = memberRows.reduce((total, member) => total + (roundsByShoot.get(member.shoot_id) ?? 0), 0)

  return {
    organizationId,
    events,
    selectedEvent,
    shoots,
    activeParticipants: athletesResult.count ?? 0,
    registrations: registrations.length,
    checkedIn: registrations.filter((row) => row.checked_in).length,
    enrolledParticipants: enrollments.length,
    squads: squadRows.length,
    assignedParticipants: memberRows.length,
    unassignedParticipants: Math.max(0, enrollments.length - assignedEnrollmentIds.size),
    scoreEntries: scoreRows.length,
    expectedScoreEntries,
    completedParticipants,
    upcomingShoots: shoots.filter((shoot) => !shoot.shoot_date || shoot.shoot_date >= today).slice(0, 6),
    squadOperations,
  }
}
