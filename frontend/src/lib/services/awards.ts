import { supabase } from "@/lib/supabase"

export type AwardPublicationStatus = "draft" | "published" | "locked"

export type AwardPublication = {
  id: string
  organization_id: string
  event_id: string
  shoot_id: string
  status: AwardPublicationStatus
  settings: Record<string, unknown>
  published_at: string | null
  locked_at: string | null
}

export type AwardOverride = {
  id: string
  registration_shoot_id: string
  award_group: "overall" | "class" | "team" | "squad"
  award_key: string
  placement: number
  title: string | null
  note: string | null
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadAwardAdministration(shootId: string) {
  const [publicationResult, overridesResult] = await Promise.all([
    supabase.from("award_publications").select("id, organization_id, event_id, shoot_id, status, settings, published_at, locked_at").eq("shoot_id", shootId).maybeSingle(),
    supabase.from("award_overrides").select("id, registration_shoot_id, award_group, award_key, placement, title, note").eq("shoot_id", shootId).order("award_group").order("award_key").order("placement"),
  ])
  throwIfError(publicationResult.error)
  throwIfError(overridesResult.error)
  return {
    publication: publicationResult.data as AwardPublication | null,
    overrides: (overridesResult.data ?? []) as AwardOverride[],
  }
}

export async function saveAwardPublication(input: {
  organizationId: string
  eventId: string
  shootId: string
  status: AwardPublicationStatus
  settings: Record<string, unknown>
}) {
  const now = new Date().toISOString()
  const payload = {
    organization_id: input.organizationId,
    event_id: input.eventId,
    shoot_id: input.shootId,
    status: input.status,
    settings: input.settings,
    published_at: input.status === "published" || input.status === "locked" ? now : null,
    locked_at: input.status === "locked" ? now : null,
  }
  const { data, error } = await supabase.from("award_publications").upsert(payload, { onConflict: "shoot_id" }).select("id, organization_id, event_id, shoot_id, status, settings, published_at, locked_at").single()
  throwIfError(error)
  return data as AwardPublication
}

export async function saveAwardOverride(input: {
  organizationId: string
  eventId: string
  shootId: string
  registrationShootId: string
  awardGroup: "overall" | "class"
  awardKey: string
  placement: number
  title?: string
  note?: string
}) {
  const { data, error } = await supabase.from("award_overrides").upsert({
    organization_id: input.organizationId,
    event_id: input.eventId,
    shoot_id: input.shootId,
    registration_shoot_id: input.registrationShootId,
    award_group: input.awardGroup,
    award_key: input.awardKey,
    placement: input.placement,
    title: input.title?.trim() || null,
    note: input.note?.trim() || null,
  }, { onConflict: "shoot_id,award_group,award_key,placement" }).select("id, registration_shoot_id, award_group, award_key, placement, title, note").single()
  throwIfError(error)
  return data as AwardOverride
}

export async function deleteAwardOverride(id: string) {
  const { error } = await supabase.from("award_overrides").delete().eq("id", id)
  throwIfError(error)
}
