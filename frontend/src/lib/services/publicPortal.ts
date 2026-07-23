import { supabase } from "@/lib/supabase"

export type PublicOrganization = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  website: string | null
}

export type PublicEvent = {
  id: string
  name: string
  description: string | null
  seriesName: string | null
  sponsorName: string | null
  startDate: string | null
  endDate: string | null
  status: string
}

export type PublicShoot = {
  id: string
  name: string
  discipline: string
  shootDate: string
  startTime: string | null
  status: string
  targetsPerRound: number
  numberOfRounds: number
  locationName: string | null
}

export type PublicEntry = {
  registrationShootId: string
  shootId: string
  shootName: string
  discipline: string
  participantName: string
  teamName: string
  classCode: string
  className: string
  squadNumber: string | null
  squadName: string | null
  houseNumber: string | null
  courseName: string | null
  stationName: string | null
  startTime: string | null
  post: number | null
  positionLabel: string | null
  checkedIn: boolean
  scoreRounds: number
  expectedRounds: number
  totalScore: number
  shootOffTotal: number
  resultNote: string | null
  awardPublished: boolean
}

export type PublicPortalPayload = {
  organization: PublicOrganization | null
  events: PublicEvent[]
  selectedEvent: PublicEvent | null
  shoots: PublicShoot[]
  entries: PublicEntry[]
  stats: {
    registeredParticipants?: number
    checkedInParticipants?: number
    totalSquads?: number
    completedSquads?: number
    publishedShoots?: number
  }
}

export async function loadPublicTournamentPortal(organizationSlug?: string, eventId?: string) {
  const { data, error } = await supabase.rpc("get_public_tournament_portal", {
    p_organization_slug: organizationSlug || null,
    p_event_id: eventId || null,
  })

  if (error) throw new Error(error.message)
  return data as PublicPortalPayload
}
