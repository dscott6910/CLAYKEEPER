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
}

export async function listSeasons(): Promise<Season[]> {
  const { organizationId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("seasons")
    .select("id,name,start_date,end_date,status,closed_at,notes")
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

  const { data, error } = await supabase.rpc("create_season", {
    p_name: name,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_make_active: input.makeActive,
  })
  if (error) throw error
  if (!data) throw new Error("The season was not created. Supabase returned no season ID.")
  return data as string
}

export async function activateSeason(id: string) {
  const { error } = await supabase.rpc("activate_season", { p_season_id: id })
  if (error) throw error
}

export async function closeSeason(id: string) {
  const { error } = await supabase.rpc("close_season", { p_season_id: id })
  if (error) throw error
}
