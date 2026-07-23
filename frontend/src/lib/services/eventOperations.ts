import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/services/organizationContext"

export type OperationsEvent = { id: string; name: string; start_date: string | null; end_date: string | null; status: string }
export type OperationsShoot = { id: string; name: string; discipline: string; shoot_date: string | null; start_time: string | null; number_of_rounds: number; entry_fee: number; organization_fee: number; registration_capacity: number | null }
export type OperationsAlert = { id: string; severity: "urgent" | "warning" | "info" | "success"; title: string; detail: string; path: string }
export type OperationsTimelineItem = { id: string; time: string | null; title: string; detail: string; kind: "registration" | "checkin" | "score" | "award" }
export type OperationsSquad = { id: string; shootName: string; squadNumber: string; startTime: string | null; participants: number; completed: number; scoreEntries: number; expectedScores: number; status: "waiting" | "in_progress" | "complete" }

export type EventOperationsSnapshot = {
  organizationId: string
  events: OperationsEvent[]
  selectedEvent: OperationsEvent | null
  shoots: OperationsShoot[]
  registrations: number
  checkedIn: number
  unpaid: number
  expectedRevenue: number
  amountPaid: number
  enrollments: number
  assigned: number
  scoreEntries: number
  expectedScoreEntries: number
  completedParticipants: number
  awardPublications: number
  alerts: OperationsAlert[]
  squads: OperationsSquad[]
  timeline: OperationsTimelineItem[]
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

function chooseEvent(events: OperationsEvent[], requested?: string) {
  if (requested) return events.find((event) => event.id === requested) ?? null
  const today = new Date().toISOString().slice(0, 10)
  return events.find((event) => (!event.start_date || event.start_date <= today) && (!event.end_date || event.end_date >= today))
    ?? events.find((event) => !event.start_date || event.start_date >= today)
    ?? events[0]
    ?? null
}

export async function loadEventOperations(requestedEventId?: string): Promise<EventOperationsSnapshot> {
  const organizationId = await getCurrentOrganizationId()
  const eventsResult = await supabase.from("events").select("id, name, start_date, end_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false })
  throwIfError(eventsResult.error)
  const events = (eventsResult.data ?? []) as OperationsEvent[]
  const selectedEvent = chooseEvent(events, requestedEventId)

  if (!selectedEvent) {
    return { organizationId, events, selectedEvent: null, shoots: [], registrations: 0, checkedIn: 0, unpaid: 0, expectedRevenue: 0, amountPaid: 0, enrollments: 0, assigned: 0, scoreEntries: 0, expectedScoreEntries: 0, completedParticipants: 0, awardPublications: 0, alerts: [], squads: [], timeline: [] }
  }

  const eventId = selectedEvent.id
  const [shootsResult, registrationsResult, enrollmentResult, publicationResult] = await Promise.all([
    supabase.from("shoots").select("id, name, discipline, shoot_date, start_time, number_of_rounds, entry_fee, organization_fee, registration_capacity").eq("organization_id", organizationId).eq("event_id", eventId).eq("active", true).order("shoot_date").order("start_time"),
    supabase.from("registrations").select("id, checked_in, payment_status, amount_paid, created_at").eq("organization_id", organizationId).eq("event_id", eventId).neq("status", "cancelled"),
    supabase.from("registration_shoots").select("id, shoot_id, historical_total_score, created_at").eq("organization_id", organizationId).eq("event_id", eventId).not("status", "in", "(withdrawn,cancelled)"),
    supabase.from("award_publications").select("id, shoot_id, status, published_at").eq("organization_id", organizationId).eq("event_id", eventId),
  ])
  for (const result of [shootsResult, registrationsResult, enrollmentResult, publicationResult]) throwIfError(result.error)

  const shoots = (shootsResult.data ?? []) as OperationsShoot[]
  const registrations = (registrationsResult.data ?? []) as Array<{ id: string; checked_in: boolean; payment_status: string; amount_paid: number | null; created_at: string | null }>
  const enrollments = (enrollmentResult.data ?? []) as Array<{ id: string; shoot_id: string; historical_total_score: number | null; created_at: string | null }>
  const publications = (publicationResult.data ?? []) as Array<{ id: string; shoot_id: string; status: string; published_at: string | null }>
  const shootIds = shoots.map((shoot) => shoot.id)

  let squadRows: Array<{ id: string; shoot_id: string; squad_number: string; start_time: string | null }> = []
  let memberRows: Array<{ id: string; shoot_id: string; squad_id: string; registration_shoot_id: string; created_at: string | null }> = []
  let scoreRows: Array<{ id: string; shoot_id: string; squad_member_id: string; round_number: number; score: number; entered_at: string | null; updated_at: string | null }> = []
  if (shootIds.length) {
    const [squadsResult, membersResult, scoresResult] = await Promise.all([
      supabase.from("squads").select("id, shoot_id, squad_number, start_time").eq("organization_id", organizationId).in("shoot_id", shootIds).order("start_time").order("squad_number"),
      supabase.from("squad_members").select("id, shoot_id, squad_id, registration_shoot_id, created_at").eq("organization_id", organizationId).in("shoot_id", shootIds).neq("status", "withdrawn"),
      supabase.from("score_entries").select("id, shoot_id, squad_member_id, round_number, score, entered_at, updated_at").eq("organization_id", organizationId).in("shoot_id", shootIds).not("score", "is", null),
    ])
    for (const result of [squadsResult, membersResult, scoresResult]) throwIfError(result.error)
    squadRows = squadsResult.data ?? []
    memberRows = membersResult.data ?? []
    scoreRows = scoresResult.data ?? []
  }

  const shootById = new Map(shoots.map((shoot) => [shoot.id, shoot]))
  const scoreCountByMember = new Map<string, number>()
  for (const score of scoreRows) scoreCountByMember.set(score.squad_member_id, (scoreCountByMember.get(score.squad_member_id) ?? 0) + 1)
  const assignedEnrollmentIds = new Set(memberRows.map((member) => member.registration_shoot_id))
  const expectedScoreEntries = memberRows.reduce((sum, member) => sum + Math.max(0, shootById.get(member.shoot_id)?.number_of_rounds ?? 0), 0)
  const completedParticipants = memberRows.filter((member) => {
    const expected = Math.max(0, shootById.get(member.shoot_id)?.number_of_rounds ?? 0)
    return expected > 0 && (scoreCountByMember.get(member.id) ?? 0) >= expected
  }).length + enrollments.filter((row) => row.historical_total_score !== null).length

  const squads = squadRows.map((squad): OperationsSquad => {
    const members = memberRows.filter((member) => member.squad_id === squad.id)
    const expectedScores = members.reduce((sum, member) => sum + Math.max(0, shootById.get(member.shoot_id)?.number_of_rounds ?? 0), 0)
    const scoreEntries = members.reduce((sum, member) => sum + (scoreCountByMember.get(member.id) ?? 0), 0)
    const completed = members.filter((member) => {
      const expected = Math.max(0, shootById.get(member.shoot_id)?.number_of_rounds ?? 0)
      return expected > 0 && (scoreCountByMember.get(member.id) ?? 0) >= expected
    }).length
    const status = expectedScores > 0 && scoreEntries >= expectedScores ? "complete" : scoreEntries > 0 ? "in_progress" : "waiting"
    return { id: squad.id, shootName: shootById.get(squad.shoot_id)?.name ?? "Shoot", squadNumber: squad.squad_number, startTime: squad.start_time, participants: members.length, completed, scoreEntries, expectedScores, status }
  })

  const unpaid = registrations.filter((row) => !["paid", "complete", "completed"].includes((row.payment_status || "").toLowerCase())).length
  const amountPaid = registrations.reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0)
  const expectedRevenue = enrollments.reduce((sum, row) => {
    const shoot = shootById.get(row.shoot_id)
    return sum + Number(shoot?.entry_fee ?? 0) + Number(shoot?.organization_fee ?? 0)
  }, 0)
  const unassigned = Math.max(0, enrollments.length - assignedEnrollmentIds.size)
  const incompleteScores = Math.max(0, memberRows.length - completedParticipants)

  const alerts: OperationsAlert[] = []
  if (registrations.length && registrations.some((row) => !row.checked_in)) alerts.push({ id: "checkin", severity: "warning", title: "Check-in incomplete", detail: `${registrations.filter((row) => !row.checked_in).length} participant(s) still need check-in.`, path: "/registration" })
  if (unassigned) alerts.push({ id: "unassigned", severity: "urgent", title: "Participants need squad assignments", detail: `${unassigned} shoot enrollment(s) are not assigned to a squad.`, path: "/squads" })
  if (incompleteScores && scoreRows.length) alerts.push({ id: "scores", severity: "warning", title: "Scorecards incomplete", detail: `${incompleteScores} assigned participant(s) still have incomplete scorecards.`, path: "/scoring" })
  if (unpaid) alerts.push({ id: "payments", severity: "info", title: "Payment follow-up", detail: `${unpaid} registration(s) are not marked paid.`, path: "/treasurer" })
  if (shoots.length && publications.filter((row) => ["published", "locked"].includes(row.status)).length < shoots.length && completedParticipants >= enrollments.length && enrollments.length > 0) alerts.push({ id: "awards", severity: "success", title: "Results may be ready", detail: "Scoring appears complete. Review and publish awards.", path: "/awards" })
  if (!alerts.length) alerts.push({ id: "clear", severity: "success", title: "Operations look healthy", detail: "No immediate action items were detected for this event.", path: "/" })

  const timeline: OperationsTimelineItem[] = [
    ...registrations.slice(-8).map((row) => ({ id: `reg-${row.id}`, time: row.created_at, title: row.checked_in ? "Participant checked in" : "Registration added", detail: row.checked_in ? "A participant is ready for competition." : "A participant was added to the event.", kind: row.checked_in ? "checkin" as const : "registration" as const })),
    ...scoreRows.slice(-12).map((row) => ({ id: `score-${row.id}`, time: row.updated_at ?? row.entered_at, title: "Score updated", detail: `Round ${row.round_number}: ${row.score}`, kind: "score" as const })),
    ...publications.filter((row) => row.published_at).map((row) => ({ id: `award-${row.id}`, time: row.published_at, title: "Awards published", detail: `${shootById.get(row.shoot_id)?.name ?? "Shoot"} results were published.`, kind: "award" as const })),
  ].sort((a, b) => (b.time ?? "").localeCompare(a.time ?? "")).slice(0, 12)

  return { organizationId, events, selectedEvent, shoots, registrations: registrations.length, checkedIn: registrations.filter((row) => row.checked_in).length, unpaid, expectedRevenue, amountPaid, enrollments: enrollments.length, assigned: memberRows.length, scoreEntries: scoreRows.length, expectedScoreEntries, completedParticipants, awardPublications: publications.filter((row) => ["published", "locked"].includes(row.status)).length, alerts, squads, timeline }
}
