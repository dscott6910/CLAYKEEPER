import { supabase } from "@/lib/supabase"

const PENDING_COACH_TOKEN_KEY =
  "claykeeper:pending-coach-activation-token"

const PENDING_COACH_EMAIL_KEY =
  "claykeeper:pending-coach-activation-email"

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded,
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, "0"),
    )
    .join("")
}

export function savePendingCoachActivationToken(
  token: string,
) {
  window.localStorage.setItem(
    PENDING_COACH_TOKEN_KEY,
    token,
  )
}

export function loadPendingCoachActivationToken() {
  return (
    window.localStorage.getItem(
      PENDING_COACH_TOKEN_KEY,
    ) ?? ""
  )
}

export function savePendingCoachActivationEmail(
  email: string,
) {
  window.localStorage.setItem(
    PENDING_COACH_EMAIL_KEY,
    email.trim().toLowerCase(),
  )
}

export function loadPendingCoachActivationEmail() {
  return (
    window.localStorage.getItem(
      PENDING_COACH_EMAIL_KEY,
    ) ?? ""
  )
}

export function clearPendingCoachActivationToken() {
  window.localStorage.removeItem(
    PENDING_COACH_TOKEN_KEY,
  )

  window.localStorage.removeItem(
    PENDING_COACH_EMAIL_KEY,
  )
}

export async function redeemCoachActivation(
  token: string,
) {
  if (!/^[0-9a-f]{64}$/.test(token)) {
    throw new Error(
      "This coach activation link is invalid.",
    )
  }

  const tokenHash = await sha256Hex(token)

  const { data, error } = await supabase.rpc(
    "redeem_coach_account_invitation",
    {
      p_token_hash: tokenHash,
    },
  )

  if (error) throw error

  clearPendingCoachActivationToken()

  return String(data || "")
}

export async function createCoachAccount(
  input: {
    email: string
    password: string
    token: string
  },
) {
  const email = input.email.trim().toLowerCase()

  if (!email) {
    throw new Error("Email is required.")
  }

  if (input.password.length < 8) {
    throw new Error(
      "Password must be at least 8 characters.",
    )
  }

  savePendingCoachActivationToken(input.token)
  savePendingCoachActivationEmail(email)

  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/coach-activate/${encodeURIComponent(
          input.token,
        )}`
      : undefined

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo,
      data: {
        coach_activation: true,
      },
    },
  })

  if (error) throw error

  return {
    confirmationRequired: !data.session,
    sessionCreated: Boolean(data.session),
  }
}

export async function signInCoachAccount(
  input: {
    email: string
    password: string
  },
) {
  const { error } =
    await supabase.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    })

  if (error) throw error
}
