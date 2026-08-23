import { supabase } from "@/lib/supabase"

export type ParticipantSeasonRegistrationStatus = {
  registrationRequired: boolean
  organizationId: string
  organizationSlug: string
  organizationName: string
  seasonId: string | null
  seasonName: string | null
  athleteId: string | null
  participantNumber: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  registrationId: string | null
  registrationStatus: string | null
  paymentStatus: string | null
}

type ParticipantSeasonRegistrationStatusRow = {
  registration_required: boolean
  organization_id: string
  organization_slug: string
  organization_name: string
  season_id: string | null
  season_name: string | null
  athlete_id: string | null
  participant_number: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  registration_id: string | null
  registration_status: string | null
  payment_status: string | null
}

function mapStatus(
  row: ParticipantSeasonRegistrationStatusRow,
): ParticipantSeasonRegistrationStatus {
  return {
    registrationRequired: Boolean(row.registration_required),
    organizationId: row.organization_id,
    organizationSlug: row.organization_slug,
    organizationName: row.organization_name,
    seasonId: row.season_id,
    seasonName: row.season_name,
    athleteId: row.athlete_id,
    participantNumber: row.participant_number,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    registrationId: row.registration_id,
    registrationStatus: row.registration_status,
    paymentStatus: row.payment_status,
  }
}

export async function getParticipantSeasonRegistrationStatus(
  organizationId?: string | null,
): Promise<ParticipantSeasonRegistrationStatus | null> {
  const { data, error } = await supabase.rpc(
    "get_participant_season_registration_status",
    {
      p_organization_id: organizationId || null,
    },
  )

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data

  if (!row) return null

  return mapStatus(row as ParticipantSeasonRegistrationStatusRow)
}

export async function completeParticipantSeasonRegistration(input: {
  organizationId: string
  selectedDisciplines: string[]
  waiversAccepted: Record<string, boolean>
  signatureType: "drawn" | "typed"
  signatureValue: string
}) {
  const { error } = await supabase.rpc(
    "complete_participant_season_registration",
    {
      p_organization_id: input.organizationId,
      p_selected_disciplines: input.selectedDisciplines,
      p_waivers_accepted: input.waiversAccepted,
      p_signature_type: input.signatureType,
      p_signature_value: input.signatureValue,
    },
  )

  if (error) throw error
}
