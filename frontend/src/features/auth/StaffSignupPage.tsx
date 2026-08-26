import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import {
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/useAuth"
import {
  loadParticipantSignupOrganization,
  type ParticipantSignupOrganization,
} from "@/lib/services/participantSignup"
import {
  clearPendingStaffSignup,
  completeStaffSignupRequest,
  createStaffSignupAccount,
  loadPendingStaffSignup,
  loadStaffSignupFromUserMetadata,
  type StaffSignupRole,
} from "@/lib/services/staffSignup"
import {
  APP_VERSION,
  CLAYKEEPER_LOGO,
} from "@/lib/branding"

function errorMessage(error: unknown) {
  const cleanText = (value: unknown) => {
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

  if (error instanceof Error) {
    const message = cleanText(error.message)

    if (message) return message
  }

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    const message = cleanText(error.message)

    if (message) return message
  }

  if (typeof error === "string") {
    const message = cleanText(error)

    if (message) return message
  }

  return "Unable to submit the access request. Please try again."
}

export function StaffSignupPage() {
  const { organizationSlug = "" } = useParams()
  const { session } = useAuth()

  const [organization, setOrganization] =
    useState<ParticipantSignupOrganization | null>(null)
  const [loadingOrganization, setLoadingOrganization] =
    useState(true)
  const [organizationError, setOrganizationError] =
    useState("")

  const [requestedRole, setRequestedRole] =
    useState<StaffSignupRole>("coach")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] =
    useState("")

  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState("")
  const [confirmationRequired, setConfirmationRequired] =
    useState(false)
  const [requestSubmitted, setRequestSubmitted] =
    useState(false)

  useEffect(() => {
    let mounted = true

    async function loadOrganization() {
      setLoadingOrganization(true)
      setOrganizationError("")

      try {
        const result =
          await loadParticipantSignupOrganization(
            organizationSlug,
          )

        if (!mounted) return

        if (!result) {
          setOrganizationError(
            "This organization registration page is not available.",
          )
          return
        }

        setOrganization(result)
      } catch (loadError) {
        if (mounted) setOrganizationError(errorMessage(loadError))
      } finally {
        if (mounted) setLoadingOrganization(false)
      }
    }

    void loadOrganization()

    return () => {
      mounted = false
    }
  }, [organizationSlug])

  useEffect(() => {
    if (!session || !organization || requestSubmitted) {
      return
    }

    const signupOrganization = organization
    let mounted = true

    async function finishPendingSignup() {
      setFinishing(true)
      setError("")

      try {
        const localPending = loadPendingStaffSignup()

        const metadataPending =
          localPending ??
          await loadStaffSignupFromUserMetadata()

        if (!mounted) return

        if (
          !metadataPending ||
          metadataPending.organizationId !==
            signupOrganization.organizationId
        ) {
          setFinishing(false)
          return
        }

        await completeStaffSignupRequest(metadataPending)

        if (!mounted) return

        setRequestSubmitted(true)
        setConfirmationRequired(false)
      } catch (finishError) {
        if (mounted) setError(errorMessage(finishError))
      } finally {
        if (mounted) setFinishing(false)
      }
    }

    void finishPendingSignup()

    return () => {
      mounted = false
    }
  }, [session, organization, requestSubmitted])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!organization) return

    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 8) {
      setError(
        "Password must contain at least 8 characters.",
      )
      return
    }

    setSubmitting(true)

    try {
      const result = await createStaffSignupAccount(
        email,
        password,
        {
          organizationId: organization.organizationId,
          organizationSlug: organization.organizationSlug,
          requestedRole,
          firstName,
          lastName,
          phone,
          message,
        },
      )

      if (result.emailConfirmationRequired) {
        setConfirmationRequired(true)
        return
      }

      setRequestSubmitted(true)
    } catch (signupError) {
      setError(errorMessage(signupError))
    } finally {
      setSubmitting(false)
    }
  }

  function cancelPendingSignup() {
    clearPendingStaffSignup()
    setConfirmationRequired(false)
    setError("")
  }

  if (loadingOrganization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-semibold text-slate-600">
          Loading staff signup…
        </p>
      </main>
    )
  }

  if (!organization || organizationError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <h1 className="mt-6 text-2xl font-bold text-slate-950">
            Signup link unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {organizationError ||
              "This organization could not be found."}
          </p>

          <Link
            to="/signup"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Find another organization
          </Link>
        </div>
      </main>
    )
  }

  if (requestSubmitted) {
    return (
      <StaffStatusCard
        organizationName={organization.organizationName}
        title="Request submitted"
        message="Your ClayKeeper account was created and your access request is pending organization approval. An owner or administrator must approve the requested role before permissions are granted."
        actionLabel="Continue to sign in"
        actionTo="/login"
      />
    )
  }

  if (confirmationRequired) {
    return (
      <StaffStatusCard
        organizationName={organization.organizationName}
        title="Check your email"
        message={`We sent a confirmation message to ${email.trim()}. Confirm your email address to finish sending your access request.`}
        actionLabel="Cancel this signup"
        actionTo=""
        onAction={cancelPendingSignup}
        busy={finishing}
        error={error}
      />
    )
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-12 text-white lg:flex">
        <div>
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-44 w-72 object-contain object-left"
          />

          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Staff access request
          </p>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            {organization.organizationName}
          </p>

          <h1 className="mt-5 text-5xl font-bold leading-tight">
            Request coach, scorekeeper, admin, or volunteer access.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Staff accounts are reviewed before permissions are
            granted, keeping organization data and scoring tools
            protected.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          ClayKeeper v{APP_VERSION}
        </p>
      </section>

      <section className="flex items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-xl">
          <div className="mb-6 lg:hidden">
            <img
              src={CLAYKEEPER_LOGO}
              alt="ClayKeeper TMK"
              className="h-24 w-48 object-contain object-left"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              {organization.organizationName}
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Staff / volunteer signup
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Create your login and request the role you need.
              Approval is required before access is granted.
            </p>

            <form
              className="mt-7 space-y-5"
              onSubmit={handleSubmit}
            >
              <div>
                <label
                  htmlFor="requested-role"
                  className="text-sm font-medium text-slate-700"
                >
                  Requested role
                </label>

                <div className="relative mt-2">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />

                  <select
                    id="requested-role"
                    value={requestedRole}
                    onChange={(event) =>
                      setRequestedRole(
                        event.target.value as StaffSignupRole,
                      )
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="coach">Coach</option>
                    <option value="scorekeeper">
                      Scorekeeper
                    </option>
                    <option value="admin">Admin</option>
                    <option value="volunteer">
                      Volunteer
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <StaffInput
                  label="First name"
                  value={firstName}
                  onChange={setFirstName}
                  icon={User}
                  autoComplete="given-name"
                  required
                />

                <StaffInput
                  label="Last name"
                  value={lastName}
                  onChange={setLastName}
                  icon={User}
                  autoComplete="family-name"
                  required
                />
              </div>

              <StaffInput
                label="Phone"
                type="tel"
                value={phone}
                onChange={setPhone}
                icon={Phone}
                autoComplete="tel"
              />

              <StaffInput
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                icon={Mail}
                autoComplete="email"
                required
              />

              <StaffInput
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                icon={LockKeyhole}
                autoComplete="new-password"
                required
              />

              <StaffInput
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                icon={LockKeyhole}
                autoComplete="new-password"
                required
              />

              <div>
                <label
                  htmlFor="staff-message"
                  className="text-sm font-medium text-slate-700"
                >
                  Message to organization
                </label>

                <textarea
                  id="staff-message"
                  value={message}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Tell the organization which team, event, or duty this access is for."
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Admin, coach, scorekeeper, and volunteer roles are
                not granted automatically. This request must be
                reviewed by an organization owner or administrator.
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full"
                disabled={submitting || finishing}
              >
                {submitting
                  ? "Submitting request..."
                  : "Submit access request"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function StaffInput({
  label,
  value,
  onChange,
  icon: Icon,
  type = "text",
  autoComplete,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  icon: typeof User
  type?: string
  autoComplete?: string
  required?: boolean
}) {
  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")

  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <div className="relative mt-2">
        <Icon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />

        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        />
      </div>
    </div>
  )
}

function StaffStatusCard({
  organizationName,
  title,
  message,
  actionLabel,
  actionTo,
  onAction,
  busy = false,
  error = "",
}: {
  organizationName: string
  title: string
  message: string
  actionLabel: string
  actionTo: string
  onAction?: () => void
  busy?: boolean
  error?: string
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <img
          src={CLAYKEEPER_LOGO}
          alt="ClayKeeper TMK"
          className="h-24 w-48 object-contain object-left"
        />

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
          {organizationName}
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          {message}
        </p>

        {busy ? (
          <p className="mt-5 text-sm font-semibold text-emerald-700">
            Finishing your access request…
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            {actionLabel}
          </button>
        ) : (
          <Link
            to={actionTo}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </main>
  )
}
