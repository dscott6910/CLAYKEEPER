import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/services/organizationContext"

export type GlobalSearchResult = {
  id: string
  type: "participant" | "team" | "event" | "shoot"
  title: string
  subtitle: string
  path: string
}

export async function globalSearch(query: string): Promise<GlobalSearchResult[]> {
  const term = query.trim()
  if (term.length < 2) return []

  const organizationId = await getCurrentOrganizationId()
  const pattern = `%${term.replace(/[%_]/g, "")}%`

  const [athletes, teams, events, shoots] = await Promise.all([
    supabase.from("athletes")
      .select("id,first_name,last_name,preferred_name,cyssa_number,email")
      .eq("organization_id", organizationId)
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},preferred_name.ilike.${pattern},cyssa_number.ilike.${pattern},email.ilike.${pattern}`)
      .limit(8),
    supabase.from("teams")
      .select("id,name,short_name")
      .eq("organization_id", organizationId)
      .or(`name.ilike.${pattern},short_name.ilike.${pattern}`)
      .limit(6),
    supabase.from("events")
      .select("id,name,start_date,status")
      .eq("organization_id", organizationId)
      .ilike("name", pattern)
      .limit(6),
    supabase.from("shoots")
      .select("id,event_id,name,shoot_date,discipline")
      .eq("organization_id", organizationId)
      .ilike("name", pattern)
      .limit(6),
  ])

  for (const result of [athletes, teams, events, shoots]) {
    if (result.error) throw result.error
  }

  return [
    ...((athletes.data ?? []).map((row) => ({
      id: row.id,
      type: "participant" as const,
      title: `${row.preferred_name || row.first_name} ${row.last_name}`,
      subtitle: row.cyssa_number ? `Participant · CYSSA ${row.cyssa_number}` : "Participant",
      path: "/participants",
    }))),
    ...((teams.data ?? []).map((row) => ({
      id: row.id,
      type: "team" as const,
      title: row.name,
      subtitle: row.short_name ? `Team · ${row.short_name}` : "Team",
      path: "/teams",
    }))),
    ...((events.data ?? []).map((row) => ({
      id: row.id,
      type: "event" as const,
      title: row.name,
      subtitle: `Event${row.start_date ? ` · ${row.start_date}` : ""} · ${row.status}`,
      path: `/events/${row.id}`,
    }))),
    ...((shoots.data ?? []).map((row) => ({
      id: row.id,
      type: "shoot" as const,
      title: row.name,
      subtitle: `Shoot · ${row.discipline.replaceAll("_", " ")}${row.shoot_date ? ` · ${row.shoot_date}` : ""}`,
      path: `/events/${row.event_id}/shoots`,
    }))),
  ]
}
