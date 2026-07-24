import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type EventMaintenanceRecord = {
  id: string
  name: string
  startDate: string | null
  status: string
  active: boolean
  externalId: string | null
  createdAt: string
  shootCount: number
  registrationCount: number
  scoreCount: number
  importCount: number
  importFileNames: string[]
  duplicateNameCount: number
  health: "linked-import" | "manual" | "orphan-candidate" | "duplicate"
}

function requireNoError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function loadEventMaintenanceRecords(): Promise<{
  role: string
  events: EventMaintenanceRecord[]
}> {
  const context = await getCurrentOrganizationContext()
  const organizationId = context.organizationId

  const [eventsResult, shootsResult, registrationsResult, importsResult, enrollmentsResult, membersResult, scoresResult] = await Promise.all([
    supabase
      .from("events")
      .select("id,name,start_date,status,active,external_id,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase.from("shoots").select("id,event_id").eq("organization_id", organizationId),
    supabase.from("registrations").select("id,event_id").eq("organization_id", organizationId),
    supabase.from("historical_imports").select("id,event_id,file_name,status").eq("organization_id", organizationId),
    supabase.from("registration_shoots").select("id,event_id").eq("organization_id", organizationId),
    supabase.from("squad_members").select("id,shoot_id").eq("organization_id", organizationId),
    supabase.from("score_entries").select("id,shoot_id").eq("organization_id", organizationId),
  ])

  for (const [result, fallback] of [
    [eventsResult, "Unable to load events."],
    [shootsResult, "Unable to load shoots."],
    [registrationsResult, "Unable to load registrations."],
    [importsResult, "Unable to load import history."],
    [enrollmentsResult, "Unable to load enrollment counts."],
    [membersResult, "Unable to load squad-member counts."],
    [scoresResult, "Unable to load score counts."],
  ] as const) {
    requireNoError(result.error, fallback)
  }

  const events = eventsResult.data ?? []
  const shoots = shootsResult.data ?? []
  const registrations = registrationsResult.data ?? []
  const imports = importsResult.data ?? []
  const scores = scoresResult.data ?? []

  const shootIdsByEvent = new Map<string, Set<string>>()
  for (const shoot of shoots) {
    const ids = shootIdsByEvent.get(shoot.event_id as string) ?? new Set<string>()
    ids.add(shoot.id as string)
    shootIdsByEvent.set(shoot.event_id as string, ids)
  }

  const normalizedNameCounts = new Map<string, number>()
  for (const event of events) {
    const key = String(event.name ?? "").trim().toLowerCase()
    normalizedNameCounts.set(key, (normalizedNameCounts.get(key) ?? 0) + 1)
  }

  return {
    role: context.role,
    events: events.map((event) => {
      const eventId = event.id as string
      const eventShoots = shootIdsByEvent.get(eventId) ?? new Set<string>()
      const eventImports = imports.filter((item) => item.event_id === eventId)
      const duplicateNameCount = normalizedNameCounts.get(String(event.name ?? "").trim().toLowerCase()) ?? 1
      const externalId = (event.external_id as string | null) ?? null
      const importStyleExternalId = Boolean(externalId && /^(trap-series|us-open|historical):/i.test(externalId))
      const orphanCandidate = eventImports.length === 0 && importStyleExternalId

      let health: EventMaintenanceRecord["health"] = "manual"
      if (duplicateNameCount > 1) health = "duplicate"
      else if (orphanCandidate) health = "orphan-candidate"
      else if (eventImports.length > 0) health = "linked-import"

      return {
        id: eventId,
        name: String(event.name ?? "Untitled event"),
        startDate: (event.start_date as string | null) ?? null,
        status: String(event.status ?? "unknown"),
        active: Boolean(event.active),
        externalId,
        createdAt: String(event.created_at ?? ""),
        shootCount: eventShoots.size,
        registrationCount: registrations.filter((item) => item.event_id === eventId).length,
        scoreCount: scores.filter((score) => eventShoots.has(score.shoot_id as string)).length,
        importCount: eventImports.length,
        importFileNames: eventImports.map((item) => String(item.file_name ?? "Unnamed import")),
        duplicateNameCount,
        health,
      }
    }),
  }
}

export async function deleteEventFromMaintenance(eventId: string) {
  const { data, error } = await supabase.rpc("delete_event_maintenance", {
    p_event_id: eventId,
  })
  if (error) {
    const missingFunction = /delete_event_maintenance|schema cache|function/i.test(error.message)
    if (missingFunction) {
      throw new Error(
        "Event deletion is not installed in Supabase yet. Run RUN_THIS_SQL_FIRST_event_maintenance_delete.sql, refresh ClayKeeper, and try again.",
      )
    }
    throw new Error(error.message || "The event could not be deleted.")
  }
  return data as {
    deleted?: boolean
    eventName?: string
    shootsDeleted?: number
    registrationsDeleted?: number
    importHistoryDeleted?: number
  } | null
}
