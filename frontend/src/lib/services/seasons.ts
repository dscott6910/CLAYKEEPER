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
  const { organizationId, userId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("seasons")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.makeActive ? "planning" : "planning",
      created_by: userId,
    })
    .select("id")
    .single()
  if (error) throw error
  if (input.makeActive) {
    const { error: rpcError } = await supabase.rpc("activate_season", { p_season_id: data.id })
    if (rpcError) throw rpcError
  }
  return data.id as string
}

export async function activateSeason(id: string) {
  const { error } = await supabase.rpc("activate_season", { p_season_id: id })
  if (error) throw error
}

export async function closeSeason(id: string) {
  const { error } = await supabase.rpc("close_season", { p_season_id: id })
  if (error) throw error
}
