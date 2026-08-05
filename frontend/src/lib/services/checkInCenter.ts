import { supabase } from "@/lib/supabase"
import type { AttendanceStatus, RefundStatus } from "@/types/database"

export type CheckInEvent = { id: string; organization_id: string; name: string; start_date: string | null }
export type CheckInAthlete = { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null; cyssa_number: string | null }
export type CheckInTeam = { id: string; name: string }
export type CheckInRegistration = {
  id: string; organization_id: string; event_id: string; athlete_id: string; team_id: string | null
  registration_number: string | null; payment_status: string | null; amount_paid: number | null
  checked_in: boolean | null; attendance_status: AttendanceStatus | null; attendance_notes: string | null
  refund_status: RefundStatus | null; refund_amount: number | null; refund_reason: string | null
  refund_notes: string | null; refund_processed_at: string | null
}
export type CheckInEnrollment = { id: string; registration_id: string; shoot_id: string }
export type CheckInSquad = { id: string; shoot_id: string; squad_number: string }
export type CheckInMember = { registration_shoot_id: string; squad_id: string; position: number; position_label: string | null }
export type CheckInData = {
  event: CheckInEvent; athletes: CheckInAthlete[]; teams: CheckInTeam[]; registrations: CheckInRegistration[]
  enrollments: CheckInEnrollment[]; squads: CheckInSquad[]; members: CheckInMember[]
}

function check(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Database request failed.")
}

export async function loadCheckInCenter(eventId: string): Promise<CheckInData> {
  const eventResult = await supabase.from("events").select("id,organization_id,name,start_date").eq("id", eventId).single()
  check(eventResult.error)
  const event = eventResult.data as CheckInEvent

  const [athletes, teams, registrations, enrollments, squads] = await Promise.all([
    supabase.from("athletes").select("id,first_name,last_name,preferred_name,cyssa_number").eq("organization_id", event.organization_id),
    supabase.from("teams").select("id,name").eq("organization_id", event.organization_id).eq("active", true).order("name"),
    supabase.from("registrations").select("id,organization_id,event_id,athlete_id,team_id,registration_number,payment_status,amount_paid,checked_in,attendance_status,attendance_notes,refund_status,refund_amount,refund_reason,refund_notes,refund_processed_at").eq("organization_id", event.organization_id).eq("event_id", eventId).neq("status", "cancelled"),
    supabase.from("registration_shoots").select("id,registration_id,shoot_id").eq("organization_id", event.organization_id).eq("event_id", eventId).eq("status", "registered"),
    supabase.from("squads").select("id,shoot_id,squad_number").eq("organization_id", event.organization_id),
  ])
  for (const result of [athletes, teams, registrations, enrollments, squads]) check(result.error)

  const enrollmentRows = (enrollments.data ?? []) as CheckInEnrollment[]
  const enrollmentIds = enrollmentRows.map((row) => row.id)
  const members = enrollmentIds.length > 0
    ? await supabase.from("squad_members").select("registration_shoot_id,squad_id,position,position_label").in("registration_shoot_id", enrollmentIds).neq("status", "withdrawn")
    : { data: [], error: null }
  check(members.error)

  return {
    event,
    athletes: (athletes.data ?? []) as CheckInAthlete[],
    teams: (teams.data ?? []) as CheckInTeam[],
    registrations: (registrations.data ?? []) as CheckInRegistration[],
    enrollments: enrollmentRows,
    squads: (squads.data ?? []) as CheckInSquad[],
    members: (members.data ?? []) as CheckInMember[],
  }
}

export async function updateAttendance(input: { registrationId: string; organizationId: string; attendanceStatus: AttendanceStatus; attendanceNotes?: string }) {
  const { data: { user }, error } = await supabase.auth.getUser()
  check(error)
  if (!user) throw new Error("Your login session has expired.")
  const checkedIn = input.attendanceStatus === "checked_in" || input.attendanceStatus === "late_arrival"
  const result = await supabase.from("registrations").update({
    attendance_status: input.attendanceStatus,
    attendance_notes: input.attendanceNotes?.trim() || null,
    checked_in: checkedIn,
    checked_in_at: checkedIn ? new Date().toISOString() : null,
    checked_in_by: checkedIn ? user.id : null,
  }).eq("id", input.registrationId).eq("organization_id", input.organizationId)
  check(result.error)
}

export async function updateRefund(input: { registrationId: string; organizationId: string; refundStatus: RefundStatus; refundAmount: number; refundReason?: string; refundNotes?: string }) {
  const { data: { user }, error } = await supabase.auth.getUser()
  check(error)
  if (!user) throw new Error("Your login session has expired.")
  const processed = input.refundStatus === "refunded" ? new Date().toISOString() : null
  const result = await supabase.from("registrations").update({
    refund_status: input.refundStatus,
    refund_amount: Math.max(0, input.refundAmount),
    refund_reason: input.refundReason?.trim() || null,
    refund_notes: input.refundNotes?.trim() || null,
    refund_processed_at: processed,
    refund_processed_by: processed ? user.id : null,
  }).eq("id", input.registrationId).eq("organization_id", input.organizationId)
  check(result.error)
}

export async function checkInSquad(input: { organizationId: string; registrationIds: string[] }) {
  if (input.registrationIds.length === 0) return
  const { data: { user }, error } = await supabase.auth.getUser()
  check(error)
  if (!user) throw new Error("Your login session has expired.")
  const result = await supabase.from("registrations").update({
    attendance_status: "checked_in",
    checked_in: true,
    checked_in_at: new Date().toISOString(),
    checked_in_by: user.id,
  }).eq("organization_id", input.organizationId).in("id", input.registrationIds)
  check(result.error)
}