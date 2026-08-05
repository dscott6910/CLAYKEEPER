import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/services/organizationContext"

export type ScorecardTemplateOrientation = "portrait" | "landscape"
export type ScorecardTemplateSize = "letter_half" | "letter_full"

export type ScorecardTemplate = {
  id: string
  organization_id: string
  name: string
  description: string | null
  discipline: string | null
  orientation: ScorecardTemplateOrientation
  page_size: ScorecardTemplateSize
  cards_per_page: number
  show_qr_code: boolean
  show_event_name: boolean
  show_event_date: boolean
  show_location: boolean
  show_host_sponsor: boolean
  show_athlete_name: boolean
  show_team_name: boolean
  show_squad_number: boolean
  show_post_number: boolean
  show_cyssa_number: boolean
  show_station_total: boolean
  show_running_total: boolean
  show_malfunctions: boolean
  show_verification_fields: boolean
  bubble_diameter: number
  grid_columns: number
  station_limit: number
  primary_color: string
  title_text: string
  footer_text: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type ScorecardTemplatePayload = Omit<
  ScorecardTemplate,
  "id" | "organization_id" | "created_at" | "updated_at"
>

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadScorecardTemplates(): Promise<ScorecardTemplate[]> {
  const organizationId = await getCurrentOrganizationId()
  const result = await supabase
    .from("scorecard_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name")

  throwIfError(result.error)
  return (result.data ?? []) as ScorecardTemplate[]
}

export async function saveScorecardTemplate(
  templateId: string | null,
  payload: ScorecardTemplatePayload,
): Promise<string> {
  const organizationId = await getCurrentOrganizationId()
  const record = {
    organization_id: organizationId,
    ...payload,
  }

  if (templateId) {
    const result = await supabase
      .from("scorecard_templates")
      .update(record)
      .eq("id", templateId)
      .eq("organization_id", organizationId)
      .select("id")
      .single()

    throwIfError(result.error)
    if (!result.data?.id) throw new Error("No template ID was returned.")
    return result.data.id as string
  }

  const result = await supabase
    .from("scorecard_templates")
    .insert(record)
    .select("id")
    .single()

  throwIfError(result.error)
  if (!result.data?.id) throw new Error("No template ID was returned.")
  return result.data.id as string
}

export async function deleteScorecardTemplate(templateId: string) {
  const organizationId = await getCurrentOrganizationId()
  const result = await supabase
    .from("scorecard_templates")
    .delete()
    .eq("id", templateId)
    .eq("organization_id", organizationId)

  throwIfError(result.error)
}