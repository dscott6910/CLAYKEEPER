import { supabase } from "@/lib/supabase"

export type ParticipantSignupOrganization = {
  organizationId: string
  organizationName: string
  organizationSlug: string
}

export type ParticipantSignupProfile = {
  organizationId: string
  organizationSlug: string
  firstName: string
  lastName: string
  preferredName?: string
  birthDate?: string
  gender?: string
  graduationYear?: string
  cyssaNumber?: string
  ataNumber?: string
  nssaNumber?: string
  phone?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  notes?: string
  accountEmail?: string
}

export type ParticipantSignupResult = {
  emailConfirmationRequired: boolean
  participantNumber: string | null
}

const PENDING_SIGNUP_KEY =
  "claykeeper:pending-participant-signup"

export async function loadParticipantSignupOrganization(
  organizationSlug: string,
): Promise<ParticipantSignupOrganization | null> {
  const slug = organizationSlug.trim()

  if (!slug) return null

  const { data, error } = await supabase.rpc(
    "get_participant_signup_organization",
    {
      p_organization_slug: slug,
    },
  )

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data

  if (!row?.organization_id) return null

  return {
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name),
    organizationSlug: String(row.organization_slug),
  }
}

function savePendingSignup(
  profile: ParticipantSignupProfile,
) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    PENDING_SIGNUP_KEY,
    JSON.stringify(profile),
  )
}

export function loadPendingParticipantSignup():
  | ParticipantSignupProfile
  | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(
    PENDING_SIGNUP_KEY,
  )

  if (!raw) return null

  try {
    return JSON.parse(raw) as ParticipantSignupProfile
  } catch {
    window.localStorage.removeItem(
      PENDING_SIGNUP_KEY,
    )
    return null
  }
}

export function clearPendingParticipantSignup() {
  if (typeof window === "undefined") return

  window.localStorage.removeItem(
    PENDING_SIGNUP_KEY,
  )
}

export async function loadParticipantSignupFromUserMetadata():
  Promise<ParticipantSignupProfile | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) throw error
  if (!user) return null

  const metadata =
    user.user_metadata?.participant_signup

  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const profile =
    metadata as ParticipantSignupProfile

  if (
    !profile.organizationId ||
    !profile.organizationSlug ||
    !profile.firstName ||
    !profile.lastName
  ) {
    return null
  }

  return profile
}

export async function completeParticipantSignup(
  profile: ParticipantSignupProfile,
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError

  if (!user) {
    throw new Error(
      "Please sign in to finish creating your participant account.",
    )
  }

  const authenticatedEmail =
    user.email?.trim().toLowerCase() || ""

  const expectedEmail =
    profile.accountEmail?.trim().toLowerCase() || ""

  if (
    expectedEmail &&
    authenticatedEmail !== expectedEmail
  ) {
    throw new Error(
      `This signup belongs to ${expectedEmail}. Sign out of ${authenticatedEmail || "the current account"} and sign in with the correct account.`,
    )
  }

  const { data, error } = await supabase.rpc(
    "register_participant_account",
    {
      p_organization_id: profile.organizationId,
      p_first_name: profile.firstName.trim(),
      p_last_name: profile.lastName.trim(),
      p_preferred_name:
        profile.preferredName?.trim() || null,
      p_birth_date:
        profile.birthDate?.trim() || null,
      p_gender:
        profile.gender?.trim() || null,
      p_graduation_year:
        profile.graduationYear?.trim()
          ? Number(profile.graduationYear)
          : null,
      p_cyssa_number:
        profile.cyssaNumber?.trim() || null,
      p_ata_number:
        profile.ataNumber?.trim() || null,
      p_nssa_number:
        profile.nssaNumber?.trim() || null,
      p_phone:
        profile.phone?.trim() || null,
      p_emergency_contact_name:
        profile.emergencyContactName?.trim() || null,
      p_emergency_contact_phone:
        profile.emergencyContactPhone?.trim() || null,
      p_notes:
        profile.notes?.trim() || null,
    },
  )

  if (error) throw error

  const participant = Array.isArray(data)
    ? data[0]
    : data

  if (!participant?.participant_number) {
    throw new Error(
      "Your account was created, but the Participant Number could not be confirmed.",
    )
  }

  clearPendingParticipantSignup()

  return String(participant.participant_number)
}

export async function createParticipantAccount(
  email: string,
  password: string,
  profile: ParticipantSignupProfile,
): Promise<ParticipantSignupResult> {
  const cleanEmail = email.trim().toLowerCase()

  if (!cleanEmail) {
    throw new Error("Email address is required.")
  }

  if (password.length < 8) {
    throw new Error(
      "Password must contain at least 8 characters.",
    )
  }

  if (!profile.firstName.trim()) {
    throw new Error("First name is required.")
  }

  if (!profile.lastName.trim()) {
    throw new Error("Last name is required.")
  }

  const {
    data: { session: existingSession },
  } = await supabase.auth.getSession()

  if (existingSession?.user) {
    const signedInEmail =
      existingSession.user.email || "another ClayKeeper account"

    throw new Error(
      `You are currently signed in as ${signedInEmail}. Sign out before creating a new participant account.`,
    )
  }

  const pendingProfile: ParticipantSignupProfile = {
    ...profile,
    accountEmail: cleanEmail,
  }

  savePendingSignup(pendingProfile)

  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup/${encodeURIComponent(
          profile.organizationSlug,
        )}/youth/profile`
      : undefined

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo,
      data: {
        participant_signup: pendingProfile,
      },
    },
  })

  if (error) {
    clearPendingParticipantSignup()
    throw error
  }

  // When email confirmation is disabled, Supabase creates a
  // session immediately and we can finish registration now.
  if (data.session) {
    const participantNumber =
      await completeParticipantSignup(profile)

    return {
      emailConfirmationRequired: false,
      participantNumber,
    }
  }

  // When confirmation is required, the pending profile stays
  // in localStorage. After confirmation/login, the signup page
  // can finish participant creation using the authenticated RPC.
  return {
    emailConfirmationRequired: true,
    participantNumber: null,
  }
}
