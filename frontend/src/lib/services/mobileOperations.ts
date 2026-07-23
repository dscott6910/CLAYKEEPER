import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/services/organizationContext"

export type MobileEvent = { id: string; name: string; start_date: string | null; end_date: string | null }
export type MobileParticipant = {
  registrationId: string
  athleteId: string
  name: string
  team: string
  classCode: string
  checkedIn: boolean
  paymentStatus: string
  registrationNumber: string
  squads: Array<{ shootName: string; squadNumber: string; post: number | null; startTime: string | null; location: string }>
}

export type MobileOperationsData = {
  organizationId: string
  events: MobileEvent[]
  selectedEvent: MobileEvent | null
  participants: MobileParticipant[]
}

type QueuedCheckIn = { registrationId: string; checkedIn: boolean; queuedAt: string }
const QUEUE_KEY = "claykeeper-mobile-checkin-queue"

function getQueue(): QueuedCheckIn[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedCheckIn[] } catch { return [] }
}

function saveQueue(queue: QueuedCheckIn[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  window.dispatchEvent(new Event("claykeeper-queue-change"))
}

export function getQueuedCheckIns() { return getQueue() }

export function queueCheckIn(registrationId: string, checkedIn: boolean) {
  const queue = getQueue().filter((item) => item.registrationId !== registrationId)
  queue.push({ registrationId, checkedIn, queuedAt: new Date().toISOString() })
  saveQueue(queue)
}

export async function syncQueuedCheckIns() {
  const queue = getQueue()
  if (!queue.length) return 0
  let synced = 0
  const remaining: QueuedCheckIn[] = []
  for (const item of queue) {
    const result = await supabase.from("registrations").update({ checked_in: item.checkedIn }).eq("id", item.registrationId)
    if (result.error) remaining.push(item)
    else synced += 1
  }
  saveQueue(remaining)
  return synced
}

function chooseEvent(events: MobileEvent[], requested?: string) {
  if (requested) return events.find((event) => event.id === requested) ?? null
  const today = new Date().toISOString().slice(0, 10)
  return events.find((event) => (!event.start_date || event.start_date <= today) && (!event.end_date || event.end_date >= today))
    ?? events.find((event) => !event.start_date || event.start_date >= today)
    ?? events[0]
    ?? null
}

export async function updateCheckIn(registrationId: string, checkedIn: boolean) {
  if (!navigator.onLine) {
    queueCheckIn(registrationId, checkedIn)
    return { queued: true }
  }
  const result = await supabase.from("registrations").update({ checked_in: checkedIn }).eq("id", registrationId)
  if (result.error) {
    queueCheckIn(registrationId, checkedIn)
    return { queued: true }
  }
  return { queued: false }
}

export async function loadMobileOperations(requestedEventId?: string): Promise<MobileOperationsData> {
  const organizationId = await getCurrentOrganizationId()
  const eventsResult = await supabase.from("events").select("id, name, start_date, end_date").eq("organization_id", organizationId).order("start_date", { ascending: false })
  if (eventsResult.error) throw eventsResult.error
  const events = (eventsResult.data ?? []) as MobileEvent[]
  const selectedEvent = chooseEvent(events, requestedEventId)
  if (!selectedEvent) return { organizationId, events, selectedEvent: null, participants: [] }

  const [registrationsResult, athletesResult, teamsResult, classesResult, shootsResult] = await Promise.all([
    supabase.from("registrations").select("id, athlete_id, team_id, class_id, checked_in, payment_status, registration_number").eq("organization_id", organizationId).eq("event_id", selectedEvent.id).neq("status", "cancelled"),
    supabase.from("athletes").select("id, first_name, last_name, preferred_name").eq("organization_id", organizationId),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId),
    supabase.from("classes").select("id, code, display_name").eq("organization_id", organizationId),
    supabase.from("shoots").select("id, name").eq("organization_id", organizationId).eq("event_id", selectedEvent.id),
  ])
  for (const result of [registrationsResult, athletesResult, teamsResult, classesResult, shootsResult]) if (result.error) throw result.error

  const registrations = registrationsResult.data ?? []
  const shootIds = (shootsResult.data ?? []).map((row) => row.id)
  const registrationIds = registrations.map((row) => row.id)
  let enrollmentRows: any[] = []
  let squadMemberRows: any[] = []
  let squadRows: any[] = []
  if (registrationIds.length && shootIds.length) {
    const [enrollmentsResult, membersResult, squadsResult] = await Promise.all([
      supabase.from("registration_shoots").select("id, registration_id, shoot_id").in("registration_id", registrationIds),
      supabase.from("squad_members").select("registration_shoot_id, squad_id, position, position_label").in("shoot_id", shootIds).neq("status", "withdrawn"),
      supabase.from("squads").select("id, shoot_id, squad_number, start_time, course_name, station_name, house_number").in("shoot_id", shootIds),
    ])
    for (const result of [enrollmentsResult, membersResult, squadsResult]) if (result.error) throw result.error
    enrollmentRows = enrollmentsResult.data ?? []
    squadMemberRows = membersResult.data ?? []
    squadRows = squadsResult.data ?? []
  }

  const athleteById = new Map((athletesResult.data ?? []).map((row) => [row.id, row]))
  const teamById = new Map((teamsResult.data ?? []).map((row) => [row.id, row.name]))
  const classById = new Map((classesResult.data ?? []).map((row) => [row.id, row.code || row.display_name]))
  const shootById = new Map((shootsResult.data ?? []).map((row) => [row.id, row.name]))
  const enrollmentById = new Map(enrollmentRows.map((row) => [row.id, row]))
  const squadById = new Map(squadRows.map((row) => [row.id, row]))
  const queued = new Map(getQueue().map((item) => [item.registrationId, item.checkedIn]))

  const participants = registrations.map((registration): MobileParticipant => {
    const athlete = athleteById.get(registration.athlete_id)
    const first = athlete?.preferred_name?.trim() || athlete?.first_name?.trim() || ""
    const last = athlete?.last_name?.trim() || ""
    const squads = squadMemberRows.filter((member) => enrollmentById.get(member.registration_shoot_id)?.registration_id === registration.id).map((member) => {
      const enrollment = enrollmentById.get(member.registration_shoot_id)
      const squad = squadById.get(member.squad_id)
      const location = squad?.course_name || squad?.station_name || (squad?.house_number ? `House ${squad.house_number}` : "Not assigned")
      return { shootName: shootById.get(enrollment?.shoot_id) ?? "Shoot", squadNumber: String(squad?.squad_number ?? "—"), post: member.position ?? null, startTime: squad?.start_time ?? null, location }
    })
    return {
      registrationId: registration.id,
      athleteId: registration.athlete_id,
      name: `${first} ${last}`.trim() || "Unnamed participant",
      team: teamById.get(registration.team_id) ?? "No team",
      classCode: classById.get(registration.class_id) ?? "—",
      checkedIn: queued.has(registration.id) ? Boolean(queued.get(registration.id)) : Boolean(registration.checked_in),
      paymentStatus: registration.payment_status || "unpaid",
      registrationNumber: registration.registration_number || "—",
      squads,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return { organizationId, events, selectedEvent, participants }
}
