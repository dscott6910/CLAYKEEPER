import { supabase } from "@/lib/supabase"

export type StaffSignupRole =
  | "coach"
  | "scorekeeper"
  | "admin"
  | "volunteer"

export type StaffSignupProfile = {
  organizationId: string
  organizationSlug: string
  requestedRole: StaffSignupRole
  firstName: string
  lastName: string
  phone?: string
  message?: string
  accountEmail?: string
}

export type StaffSignupResult = {
  emailConfirmationRequired: boolean
}

const PENDING_STAFF_SIGNUP_KEY =
  "claykeeper:pending-staff-signup"

function cleanErrorText(value: unknown) {
  const text = String(value ?? "").trim()

  if (
    !text ||
    text === "{}" ||
    text === "[]" ||
    text === "[object Object]"
  ) {
    return ""
  }

  return text
}

function serviceErrorMessage(
  fallback: string,
  error: unknown,
) {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    String(error.code) === "PGRST202"
  ) {
    return "The staff access request database update has not been applied yet. Ask an administrator to run the latest Supabase migrations, then try again."
  }

  if (error instanceof Error) {
    const message = cleanErrorText(error.message)

    if (message) return message
  }

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    const message = cleanErrorText(error.message)

    if (message) return message
  }

  if (typeof error === "string") {
    const message = cleanErrorText(error)

    if (message) return message
  }

  return fallback
}

function savePendingStaffSignup(profile: StaffSignupProfile) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    PENDING_STAFF_SIGNUP_KEY,
    JSON.stringify(profile),
  )
}

export function loadPendingStaffSignup():
  | StaffSignupProfile
  | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(
    PENDING_STAFF_SIGNUP_KEY,
  )

  if (!raw) return null

  try {
    return JSON.parse(raw) as StaffSignupProfile
  } catch {
    window.localStorage.removeItem(
      PENDING_STAFF_SIGNUP_KEY,
    )
    return null
  }
}

export function clearPendingStaffSignup() {
  if (typeof window === "undefined") return

  window.localStorage.removeItem(
    PENDING_STAFF_SIGNUP_KEY,
  )
}

export async function loadStaffSignupFromUserMetadata():
  Promise<StaffSignupProfile | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) throw error
  if (!user) return null

  const metadata = user.user_metadata?.staff_signup

  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const profile = metadata as StaffSignupProfile

  if (
    !profile.organizationId ||
    !profile.organizationSlug ||
    !profile.firstName ||
    !profile.lastName ||
    !profile.requestedRole
  ) {
    return null
  }

  return profile
}

export async function completeStaffSignupRequest(
  profile: StaffSignupProfile,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError

  if (!user) {
    throw new Error(
      "Please sign in to finish your access request.",
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
      `This request belongs to ${expectedEmail}. Sign out of ${authenticatedEmail || "the current account"} and sign in with the correct account.`,
    )
  }

  const { error } = await supabase.rpc(
    "request_organization_access",
    {
      p_organization_id: profile.organizationId,
      p_requested_role: profile.requestedRole,
      p_first_name: profile.firstName.trim(),
      p_last_name: profile.lastName.trim(),
      p_phone: profile.phone?.trim() || null,
      p_message: profile.message?.trim() || null,
    },
  )

  if (error) {
    throw new Error(
      serviceErrorMessage(
        "Your account was created, but ClayKeeper could not submit the access request. Please try signing in, then open this staff signup link again.",
        error,
      ),
    )
  }

  clearPendingStaffSignup()
}

export async function createStaffSignupAccount(
  email: string,
  password: string,
  profile: StaffSignupProfile,
): Promise<StaffSignupResult> {
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
      `You are currently signed in as ${signedInEmail}. Sign out before requesting staff access.`,
    )
  }

  const pendingProfile: StaffSignupProfile = {
    ...profile,
    accountEmail: cleanEmail,
  }

  savePendingStaffSignup(pendingProfile)

  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup/${encodeURIComponent(
          profile.organizationSlug,
        )}/staff`
      : undefined

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo,
      data: {
        staff_signup: pendingProfile,
      },
    },
  })

  if (error) {
    clearPendingStaffSignup()
    throw new Error(
      serviceErrorMessage(
        "ClayKeeper could not create this login. Please check the email and password, then try again.",
        error,
      ),
    )
  }

  if (data.session) {
    await completeStaffSignupRequest(pendingProfile)

    return {
      emailConfirmationRequired: false,
    }
  }

  return {
    emailConfirmationRequired: true,
  }
}
