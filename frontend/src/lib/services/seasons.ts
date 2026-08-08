import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"

export type Season = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: "planning" | "active" | "closed" | "archived"
  closed_at: string | null
  notes: string | null
  qualification_enabled: boolean
  qualification_min_events: number
  qualification_notes: string | null
}

async function getSeasonStatus(seasonId: string) {
  const { organizationId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("seasons")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("id", seasonId)
    .single()
  if (error) throw new Error(error.message)
  return data.status as Season["status"]
}

async function assertSeasonMutable(seasonId: string) {
  const status = await getSeasonStatus(seasonId)
  if (status === "archived") {
    throw new Error("This season has been finalized and archived. Its configuration is locked.")
  }
  return status
}

export async function listSeasons(): Promise<Season[]> {
  const { organizationId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("seasons")
    .select("id,name,start_date,end_date,status,closed_at,notes,qualification_enabled,qualification_min_events,qualification_notes")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false })
  if (error) throw error
  return (data ?? []) as Season[]
}

export async function createSeason(input: { name: string; startDate: string; endDate: string; makeActive: boolean }) {
  const name = input.name.trim()
  if (!name) throw new Error("Season name is required.")
  if (!input.startDate || !input.endDate) throw new Error("Season start and end dates are required.")
  if (input.endDate < input.startDate) throw new Error("Season end date must be on or after the start date.")

  const { organizationId, userId, role } = await getCurrentOrganizationContext()
  if (role !== "owner" && role !== "admin") {
    throw new Error(`Your organization role is '${role}'. Only an owner or administrator can create a season.`)
  }

  if (input.makeActive) {
    const { error: closeError } = await supabase
      .from("seasons")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: userId })
      .eq("organization_id", organizationId)
      .eq("status", "active")
    if (closeError) throw closeError
  }

  const { data, error } = await supabase
    .from("seasons")
    .insert({
      organization_id: organizationId,
      name,
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.makeActive ? "active" : "planning",
      created_by: userId,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") throw new Error(`A season named '${name}' already exists.`)
    throw new Error(`${error.message}${error.details ? ` — ${error.details}` : ""}`)
  }
  if (!data?.id) throw new Error("The season was not created. Supabase returned no season ID.")
  return data.id as string
}


export async function updateSeason(input: { id: string; name: string; startDate: string; endDate: string }) {
  const name = input.name.trim()
  if (!input.id) throw new Error("Season ID is required.")
  if (!name) throw new Error("Season name is required.")
  if (!input.startDate || !input.endDate) throw new Error("Season start and end dates are required.")
  if (input.endDate < input.startDate) throw new Error("Season end date must be on or after the start date.")

  await assertSeasonMutable(input.id)

  const { organizationId, role } = await getCurrentOrganizationContext()
  if (role !== "owner" && role !== "admin") {
    throw new Error(`Your organization role is '${role}'. Only an owner or administrator can edit a season.`)
  }

  const { data, error } = await supabase
    .from("seasons")
    .update({ name, start_date: input.startDate, end_date: input.endDate })
    .eq("organization_id", organizationId)
    .eq("id", input.id)
    .select("id,name,start_date,end_date,status,closed_at,notes,qualification_enabled,qualification_min_events,qualification_notes")
    .single()

  if (error) {
    if (error.code === "23505") throw new Error(`A season named '${name}' already exists.`)
    throw new Error(`${error.message}${error.details ? ` — ${error.details}` : ""}`)
  }
  return data as Season
}

export async function updateSeasonQualificationSettings(input: {
  seasonId: string
  enabled: boolean
  minEvents: number
  notes?: string
}) {
  if (!input.seasonId) throw new Error("Season ID is required.")
  if (!Number.isInteger(input.minEvents) || input.minEvents < 1 || input.minEvents > 100) {
    throw new Error("Minimum qualifying events must be a whole number between 1 and 100.")
  }

  await assertSeasonMutable(input.seasonId)

  const { organizationId, role } = await getCurrentOrganizationContext()
  if (role !== "owner" && role !== "admin") {
    throw new Error(`Your organization role is '${role}'. Only an owner or administrator can edit qualification rules.`)
  }

  const { data, error } = await supabase
    .from("seasons")
    .update({
      qualification_enabled: input.enabled,
      qualification_min_events: input.minEvents,
      qualification_notes: input.notes?.trim() || null,
    })
    .eq("organization_id", organizationId)
    .eq("id", input.seasonId)
    .select("id,name,start_date,end_date,status,closed_at,notes,qualification_enabled,qualification_min_events,qualification_notes")
    .single()

  if (error) throw new Error(error.message)
  return data as Season
}

export async function activateSeason(id: string) {
  const status = await assertSeasonMutable(id)
  if (status !== "planning") throw new Error("Only a planning season can be activated.")
  const { error } = await supabase.rpc("activate_season", { p_season_id: id })
  if (error) throw error
}

export async function closeSeason(id: string) {
  const { error } = await supabase.rpc("close_season", { p_season_id: id })
  if (error) throw error
}

export type SeasonCloseoutSummary = {
  events: number
  shoots: number
  registrations: number
  scores: number
  closedSeasonId: string
  nextSeasonId: string | null
}

export async function closeSeasonAndRollover(input: {
  seasonId: string
  createNext: boolean
  nextName?: string
  nextStartDate?: string
  nextEndDate?: string
}): Promise<SeasonCloseoutSummary> {
  const { data, error } = await supabase.rpc("close_season_and_rollover", {
    p_season_id: input.seasonId,
    p_create_next: input.createNext,
    p_next_name: input.nextName || null,
    p_next_start_date: input.nextStartDate || null,
    p_next_end_date: input.nextEndDate || null,
  })
  if (error) throw new Error(error.message)
  return data as SeasonCloseoutSummary
}


export type SeasonEvent = {
  id: string
  organization_id: string
  season_id: string | null
  name: string
  event_year: number | null
  discipline: string | null
  event_type: string | null
  location_name: string | null
  start_date: string | null
  status: string
  active: boolean
}

export async function listSeasonEvents(): Promise<SeasonEvent[]> {
  const { organizationId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("events")
    .select("id,organization_id,season_id,name,event_year,discipline,event_type,location_name,start_date,status,active")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as SeasonEvent[]
}

export async function assignEventToSeason(input: {
  eventId: string
  seasonId: string | null
}) {
  const { organizationId, role } = await getCurrentOrganizationContext()
  if (role !== "owner" && role !== "admin") {
    throw new Error(`Your organization role is '${role}'. Only an owner or administrator can assign events to seasons.`)
  }

  const { data: currentEvent, error: currentEventError } = await supabase
    .from("events")
    .select("season_id")
    .eq("organization_id", organizationId)
    .eq("id", input.eventId)
    .single()
  if (currentEventError) throw new Error(currentEventError.message)

  if (currentEvent.season_id) {
    const currentStatus = await getSeasonStatus(currentEvent.season_id)
    if (currentStatus === "archived") {
      throw new Error("This event belongs to a finalized season and cannot be reassigned.")
    }
  }

  if (input.seasonId) {
    const targetStatus = await getSeasonStatus(input.seasonId)
    if (targetStatus === "archived") {
      throw new Error("Events cannot be assigned to a finalized season.")
    }
  }

  if (input.seasonId) {
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", input.seasonId)
      .maybeSingle()

    if (seasonError) throw seasonError
    if (!season) throw new Error("The selected season could not be found for this organization.")
  }

  const { data, error } = await supabase
    .from("events")
    .update({ season_id: input.seasonId })
    .eq("organization_id", organizationId)
    .eq("id", input.eventId)
    .select("id,season_id")
    .single()

  if (error) throw error
  return data as { id: string; season_id: string | null }
}
