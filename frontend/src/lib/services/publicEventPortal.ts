import { supabase } from "@/lib/supabase"

export type PublicEventSettings = {
  id: string
  organization_id: string
  event_id: string
  is_public: boolean
  show_live_scores: boolean
  show_squads: boolean
  show_teams: boolean
  show_awards: boolean
  display_mode_enabled: boolean
  public_message: string | null
  opened_at: string | null
  closed_at: string | null
}

export type PublicEventPortalEntry = {
  registrationShootId: string
  shootId: string
  shootName: string
  discipline: string
  participantName: string
  teamName: string
  classCode: string
  className: string
  squadNumber: string | null
  courseName: string | null
  startTime: string | null
  post: number | null
  positionLabel: string | null
  checkedIn: boolean
  scoreStatus: "missing" | "draft" | "finalized" | "hidden"
  totalScore: number
  totalTargets: number
  updatedAt: string | null
  awardPublished: boolean
}

export type PublicEventPortalAward = {
  registrationShootId: string
  shootId: string
  shootName: string
  participantName: string
  teamName: string
  classCode: string
  awardGroup: "overall" | "class"
  awardKey: string
  placement: number
  title: string
  note: string | null
  totalScore: number
  shootOffScores: Array<{
    roundNumber: number
    score: number
  }>
  overridden: boolean
}

export type PublicEventPortalPayload = {
  available: boolean
  reason?: "not_found" | "not_public"
  organization?: { id: string; name: string; slug: string; logoUrl: string | null; website: string | null }
  event?: { id: string; name: string; description: string | null; seriesName: string | null; sponsorName: string | null; startDate: string | null; endDate: string | null; status: string }
  settings?: { showLiveScores: boolean; showSquads: boolean; showTeams: boolean; showAwards: boolean; displayModeEnabled: boolean; publicMessage: string | null }
  shoots?: Array<{ id: string; name: string; discipline: string; shootDate: string; startTime: string | null; status: string }>
  entries?: PublicEventPortalEntry[]
  awards?: PublicEventPortalAward[]
  stats?: { registered: number; checkedIn: number; assigned: number; started: number; finalized: number; publishedShoots: number; lastUpdatedAt: string | null }
}

function check(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadPublicEventPortal(eventId: string): Promise<PublicEventPortalPayload> {
  const { data, error } = await supabase.rpc("get_public_event_portal", { p_event_id: eventId })
  check(error)
  return data as PublicEventPortalPayload
}

export async function loadPublicEventSettings(eventId: string) {
  const eventResult = await supabase.from("events").select("id,organization_id,name,start_date,status").eq("id", eventId).single()
  check(eventResult.error)
  const settingsResult = await supabase.from("public_event_settings").select("*").eq("event_id", eventId).maybeSingle()
  check(settingsResult.error)
  return { event: eventResult.data, settings: settingsResult.data as PublicEventSettings | null }
}

export async function savePublicEventSettings(input: {
  organizationId: string
  eventId: string
  isPublic: boolean
  showLiveScores: boolean
  showSquads: boolean
  showTeams: boolean
  showAwards: boolean
  displayModeEnabled: boolean
  publicMessage: string
}) {
  const now = new Date().toISOString()
  const payload = {
    organization_id: input.organizationId,
    event_id: input.eventId,
    is_public: input.isPublic,
    show_live_scores: input.showLiveScores,
    show_squads: input.showSquads,
    show_teams: input.showTeams,
    show_awards: input.showAwards,
    display_mode_enabled: input.displayModeEnabled,
    public_message: input.publicMessage.trim() || null,
    opened_at: input.isPublic ? now : null,
    closed_at: input.isPublic ? null : now,
  }
  const { data, error } = await supabase.from("public_event_settings").upsert(payload, { onConflict: "event_id" }).select("*").single()
  check(error)
  return data as PublicEventSettings
}
