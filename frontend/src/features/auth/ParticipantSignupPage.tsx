import { useEffect, useState } from "react"
import type { FormEvent, HTMLAttributes } from "react"
import { Link, useParams } from "react-router-dom"
import {
  CalendarDays,
  LockKeyhole,
  Mail,
  Phone,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/useAuth"
import {
  clearPendingParticipantSignup,
  completeParticipantSignup,
  createParticipantAccount,
  loadParticipantSignupOrganization,
  loadParticipantSignupFromUserMetadata,
  loadPendingParticipantSignup,
  type ParticipantSignupOrganization,
} from "@/lib/services/participantSignup"
import {
  APP_VERSION,
  CLAYKEEPER_LOGO,
} from "@/lib/branding"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    return String(error.message)
  }

  return "Unable to create the account. Please try again."
}

export function ParticipantSignupPage() {
  const { organizationSlug = "" } = useParams()
  const { session } = useAuth()

  const [organization, setOrganization] =
    useState<ParticipantSignupOrganization | null>(null)

  const [loadingOrganization, setLoadingOrganization] =
    useState(true)

  const [organizationError, setOrganizationError] =
    useState("")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [preferredName, setPreferredName] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [gender, setGender] = useState("")
  const [graduationYear, setGraduationYear] = useState("")
  const [cyssaNumber, setCyssaNumber] = useState("")
  const [ataNumber, setAtaNumber] = useState("")
  const [nssaNumber, setNssaNumber] = useState("")
  const [phone, setPhone] = useState("")
  const [emergencyContactName, setEmergencyContactName] = useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] =
    useState("")

  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState("")
  const [participantNumber, setParticipantNumber] =
    useState<string | null>(null)

  const [confirmationRequired, setConfirmationRequired] =
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
            "This participant signup link is not valid or the organization is not accepting access.",
          )
          return
        }

        setOrganization(result)
      } catch (loadError) {
        if (!mounted) return
        setOrganizationError(errorMessage(loadError))
      } finally {
        if (mounted) {
          setLoadingOrganization(false)
        }
      }
    }

    void loadOrganization()

    return () => {
      mounted = false
    }
  }, [organizationSlug])

  useEffect(() => {
    if (!session || !organization || participantNumber) {
      return
    }

    const signupOrganization = organization
    let mounted = true

    async function finishPendingSignup() {
      setFinishing(true)
      setError("")

      try {
        const localPending =
          loadPendingParticipantSignup()

        const metadataPending =
          localPending ??
          await loadParticipantSignupFromUserMetadata()

        if (!mounted) return

        if (
          !metadataPending ||
          metadataPending.organizationId !==
            signupOrganization.organizationId
        ) {
          setFinishing(false)
          return
        }

        const number =
          await completeParticipantSignup(metadataPending)

        if (!mounted) return

        setParticipantNumber(number)
        setConfirmationRequired(false)
      } catch (finishError) {
        if (!mounted) return
        setError(errorMessage(finishError))
      } finally {
        if (mounted) {
          setFinishing(false)
        }
      }
    }

    void finishPendingSignup()

    return () => {
      mounted = false
    }
  }, [session, organization, participantNumber])

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
      const result = await createParticipantAccount(
        email,
        password,
        {
          organizationId: organization.organizationId,
          organizationSlug: organization.organizationSlug,
          firstName,
          lastName,
          preferredName,
          birthDate,
          gender,
          graduationYear,
          cyssaNumber,
          ataNumber,
          nssaNumber,
          phone,
          emergencyContactName,
          emergencyContactPhone,
          notes,
        },
      )

      if (result.emailConfirmationRequired) {
        setConfirmationRequired(true)
        return
      }

      setParticipantNumber(result.participantNumber)
    } catch (signupError) {
      setError(errorMessage(signupError))
    } finally {
      setSubmitting(false)
    }
  }

  function cancelPendingSignup() {
    clearPendingParticipantSignup()
    setConfirmationRequired(false)
    setError("")
  }

  if (loadingOrganization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-semibold text-slate-600">
          Loading participant signup…
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
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Return to sign in
          </Link>
        </div>
      </main>
    )
  }

  if (participantNumber) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            {organization.organizationName}
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Account created
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your ClayKeeper participant account is ready.
          </p>

          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Participant Number
            </p>

            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {participantNumber}
            </p>
          </div>

          <a
            href="/"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continue to ClayKeeper
          </a>
        </div>
      </main>
    )
  }

  if (confirmationRequired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            {organization.organizationName}
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Check your email
          </h1>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            We sent a confirmation message to{" "}
            <strong>{email.trim()}</strong>. Confirm your email
            address to finish creating your participant account.
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            After confirmation, return to this signup link. Your
            Participant Number will be assigned automatically.
          </p>

          {finishing ? (
            <p className="mt-5 text-sm font-semibold text-emerald-700">
              Finishing your participant account…
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

          <button
            type="button"
            onClick={cancelPendingSignup}
            className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            Cancel this signup
          </button>
        </div>
      </main>
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
            Participant account
          </p>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            {organization.organizationName}
          </p>

          <h1 className="mt-5 text-5xl font-bold leading-tight">
            Create your ClayKeeper participant account.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Your organization-specific Participant Number will be
            assigned automatically when registration is complete.
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
              Youth shooter registration
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Create the shooter login, profile, emergency
              contact, and season registration record.
            </p>

            <form
              className="mt-7 space-y-5"
              onSubmit={handleSubmit}
            >
              <SignupSection
                title="Shooter information"
                description="Basic participant details used for rosters, squadding, scoring, and reports."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SignupInput
                  label="First name"
                  value={firstName}
                  onChange={setFirstName}
                  icon={User}
                  autoComplete="given-name"
                  required
                />

                <SignupInput
                  label="Last name"
                  value={lastName}
                  onChange={setLastName}
                  icon={User}
                  autoComplete="family-name"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <SignupInput
                  label="Preferred name"
                  value={preferredName}
                  onChange={setPreferredName}
                  icon={User}
                  autoComplete="nickname"
                />

                <SignupInput
                  label="Birth date"
                  type="date"
                  value={birthDate}
                  onChange={setBirthDate}
                  icon={CalendarDays}
                  autoComplete="bday"
                />

                <SignupInput
                  label="Graduation year"
                  type="number"
                  value={graduationYear}
                  onChange={setGraduationYear}
                  icon={CalendarDays}
                  autoComplete="off"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label
                  htmlFor="gender"
                  className="text-sm font-medium text-slate-700"
                >
                  Gender
                </label>

                <select
                  id="gender"
                  value={gender}
                  onChange={(event) =>
                    setGender(event.target.value)
                  }
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <SignupSection
                title="Contact and emergency contact"
                description="Used by organization staff for season communication and safety follow-up."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SignupInput
                  label="Shooter phone"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  icon={Phone}
                  autoComplete="tel"
                />

                <SignupInput
                  label="Emergency contact name"
                  value={emergencyContactName}
                  onChange={setEmergencyContactName}
                  icon={User}
                  autoComplete="name"
                />
              </div>

              <SignupInput
                label="Emergency contact phone"
                type="tel"
                value={emergencyContactPhone}
                onChange={setEmergencyContactPhone}
                icon={Phone}
                autoComplete="tel"
              />

              <SignupSection
                title="Membership numbers"
                description="Optional association numbers used for reporting and matching existing records."
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <SignupInput
                  label="CYSSA number"
                  value={cyssaNumber}
                  onChange={setCyssaNumber}
                  icon={User}
                  autoComplete="off"
                />

                <SignupInput
                  label="ATA number"
                  value={ataNumber}
                  onChange={setAtaNumber}
                  icon={User}
                  autoComplete="off"
                />

                <SignupInput
                  label="NSSA number"
                  value={nssaNumber}
                  onChange={setNssaNumber}
                  icon={User}
                  autoComplete="off"
                />
              </div>

              <SignupSection
                title="Login and payment"
                description="Payment collection will be connected to the organization's season and ClayKeeper subscription settings."
              />

              <SignupInput
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                icon={Mail}
                autoComplete="email"
                required
              />

              <SignupInput
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                icon={LockKeyhole}
                autoComplete="new-password"
                required
              />

              <SignupInput
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
                  htmlFor="registration-notes"
                  className="text-sm font-medium text-slate-700"
                >
                  Notes for the organization
                </label>

                <textarea
                  id="registration-notes"
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Optional medical, team, or registration notes"
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <strong>Payment step:</strong> this form is ready
                for season and ClayKeeper subscription checkout.
                The payment screen will appear here once pricing
                is configured for this organization.
              </div>

              <p className="text-xs leading-5 text-slate-500">
                Passwords must contain at least 8 characters.
                Your Participant Number is assigned automatically.
              </p>

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
                  ? "Creating account..."
                  : "Create Account"}
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

function SignupInput({
  label,
  value,
  onChange,
  icon: Icon,
  type = "text",
  autoComplete,
  required = false,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  icon: typeof User
  type?: string
  autoComplete?: string
  required?: boolean
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
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
          inputMode={inputMode}
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

function SignupSection({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-base font-bold text-slate-950">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  )
}
