import { getCurrentOrganizationId } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type ParticipantProfile = {
  athlete: {
    id: string
    first_name: string
    last_name: string
    preferred_name: string | null
    class_id: string | null
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

  classRecord: {
    id: string
    code: string
    display_name: string
  } | null

  teamHistory: Array<{
    id: string
    team_id: string
    team_name: string
    is_primary: boolean
    start_date: string | null
    end_date: string | null
  }>

  registrations: Array<{
    id: string
    event_id: string
    event_name: string
    event_date: string | null
    checked_in: boolean
    payment_status: string
    status: string
  }>
}

function throwIfError(error: { message?: string } | null) {
  if (error) {
    throw new Error(error.message || "A database error occurred.")
  }
}

export async function loadParticipantProfile(
  athleteId: string,
): Promise<ParticipantProfile> {
  const organizationId = await getCurrentOrganizationId()

  const [athleteResult, assignmentsResult, registrationsResult] =
    await Promise.all([
      supabase
        .from("athletes")
        .select(
          "id, first_name, last_name, preferred_name, class_id, graduation_year, cyssa_number, ata_number, nssa_number, email, phone, emergency_contact_name, emergency_contact_phone, notes, active",
        )
        .eq("organization_id", organizationId)
        .eq("id", athleteId)
        .maybeSingle(),

      supabase
        .from("athlete_teams")
        .select("id, team_id, is_primary, start_date, end_date")
        .eq("organization_id", organizationId)
        .eq("athlete_id", athleteId)
        .order("start_date", { ascending: false }),

      supabase
        .from("registrations")
        .select(
          "id, event_id, checked_in, payment_status, status",
        )
        .eq("organization_id", organizationId)
        .eq("athlete_id", athleteId),
    ])

  throwIfError(athleteResult.error)
  throwIfError(assignmentsResult.error)
  throwIfError(registrationsResult.error)

  if (!athleteResult.data) {
    throw new Error("Participant not found.")
  }

  const athlete = athleteResult.data
  const assignments = assignmentsResult.data ?? []
  const registrationRows = registrationsResult.data ?? []

  const teamIds = Array.from(
    new Set(assignments.map((row) => row.team_id)),
  )

  const eventIds = Array.from(
    new Set(registrationRows.map((row) => row.event_id)),
  )

  const [classResult, teamsResult, eventsResult] =
    await Promise.all([
      athlete.class_id
        ? supabase
            .from("classes")
            .select("id, code, display_name")
            .eq("organization_id", organizationId)
            .eq("id", athlete.class_id)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),

      teamIds.length > 0
        ? supabase
            .from("teams")
            .select("id, name")
            .eq("organization_id", organizationId)
            .in("id", teamIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),

      eventIds.length > 0
        ? supabase
            .from("events")
            .select("id, name, start_date")
            .eq("organization_id", organizationId)
            .in("id", eventIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ])

  throwIfError(classResult.error)
  throwIfError(teamsResult.error)
  throwIfError(eventsResult.error)

  const teamById = new Map(
    (teamsResult.data ?? []).map((team) => [
      team.id,
      team,
    ]),
  )

  const eventById = new Map(
    (eventsResult.data ?? []).map((event) => [
      event.id,
      event,
    ]),
  )

  return {
    athlete,

    classRecord: classResult.data,

    teamHistory: assignments.map((assignment) => ({
      id: assignment.id,
      team_id: assignment.team_id,
      team_name:
        teamById.get(assignment.team_id)?.name ??
        "Unknown team",
      is_primary: assignment.is_primary,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
    })),

    registrations: registrationRows
      .map((registration) => {
        const event = eventById.get(
          registration.event_id,
        )

        return {
          id: registration.id,
          event_id: registration.event_id,
          event_name:
            event?.name ?? "Unknown event",
          event_date:
            event?.start_date ?? null,
          checked_in: registration.checked_in,
          payment_status:
            registration.payment_status,
          status: registration.status,
        }
      })
      .sort((left, right) =>
        (right.event_date ?? "").localeCompare(
          left.event_date ?? "",
        ),
      ),
  }
}