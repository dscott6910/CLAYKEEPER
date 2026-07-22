import { supabase } from "@/lib/supabase"
import type {
  AthleteRecord,
  ClassRecord,
  EventRecord,
  EventWorkspaceData,
  LocationRecord,
  RegistrationRecord,
  ShootRecord,
  TeamRecord,
} from "@/types/database"

function throwIfError(result: { error: { message: string } | null }) {
  if (result.error) throw result.error
}

export async function getEventWorkspace(eventId: string): Promise<EventWorkspaceData> {
  const eventResult = await supabase
    .from("events")
    .select("id,organization_id,name,description,series_name,sponsor_name,start_date,end_date,status")
    .eq("id", eventId)
    .single()

  throwIfError(eventResult)
  const event = eventResult.data as EventRecord

  const [shootResult, locationResult, registrationResult, athleteResult, teamResult, classResult] =
    await Promise.all([
      supabase.from("shoots").select("*").eq("event_id", eventId).order("shoot_date").order("start_time"),
      supabase
        .from("locations")
        .select("id,name")
        .eq("organization_id", event.organization_id)
        .eq("active", true)
        .order("name"),
      supabase
        .from("registrations")
        .select("id,athlete_id,team_id,class_id,registration_number,status,payment_status,checked_in,amount_paid")
        .eq("event_id", eventId)
        .order("registered_at"),
      supabase
        .from("athletes")
        .select("id,first_name,last_name,preferred_name,cyssa_number")
        .eq("organization_id", event.organization_id),
      supabase.from("teams").select("id,name").eq("organization_id", event.organization_id),
      supabase
        .from("classes")
        .select("id,code,display_name")
        .eq("organization_id", event.organization_id)
        .order("display_order"),
    ])

  for (const result of [
    shootResult,
    locationResult,
    registrationResult,
    athleteResult,
    teamResult,
    classResult,
  ]) {
    throwIfError(result)
  }

  return {
    event,
    shoots: (shootResult.data ?? []) as ShootRecord[],
    locations: (locationResult.data ?? []) as LocationRecord[],
    registrations: (registrationResult.data ?? []) as RegistrationRecord[],
    athletes: (athleteResult.data ?? []) as AthleteRecord[],
    teams: (teamResult.data ?? []) as TeamRecord[],
    classes: (classResult.data ?? []) as ClassRecord[],
  }
}
