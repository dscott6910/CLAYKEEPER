import { useEffect, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  Mail,
  ShoppingCart,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  APP_VERSION,
  CLAYKEEPER_LOGO,
} from "@/lib/branding"
import {
  createParticipantAccount,
  loadParticipantSignupOrganization,
  loadPendingParticipantSignup,
  type ParticipantSignupOrganization,
  type ParticipantSignupProfile,
} from "@/lib/services/participantSignup"
import {
  YOUTH_SEASON_REGISTRATION_FEE,
  youthRegistrationSessionsByIds,
} from "@/lib/services/youthRegistrationSessions"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    return String(error.message)
  }

  return "Unable to complete registration. Please try again."
}

export function YouthRegistrationCartPage() {
  const { organizationSlug = "" } = useParams()
  const [searchParams] = useSearchParams()
  const [organization, setOrganization] =
    useState<ParticipantSignupOrganization | null>(null)
  const [profile, setProfile] =
    useState<ParticipantSignupProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [confirmationRequired, setConfirmationRequired] =
    useState(false)
  const [participantNumber, setParticipantNumber] =
    useState<string | null>(null)

  const selectedIds = useMemo(
    () =>
      (searchParams.get("session") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [searchParams],
  )

  const selectedSessions = useMemo(() => {
    const savedIds = profile?.selectedDisciplines?.length
      ? profile.selectedDisciplines
      : selectedIds

    return youthRegistrationSessionsByIds(savedIds)
  }, [profile, selectedIds])

  useEffect(() => {
    let mounted = true

    async function loadCart() {
      setLoading(true)
      setError("")

      try {
        const [organizationResult, pendingProfile] =
          await Promise.all([
            loadParticipantSignupOrganization(
              organizationSlug,
            ),
            Promise.resolve(loadPendingParticipantSignup()),
          ])

        if (!mounted) return

        setOrganization(organizationResult)
        setProfile(pendingProfile)
      } catch (loadError) {
        if (mounted) setError(errorMessage(loadError))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadCart()

    return () => {
      mounted = false
    }
  }, [organizationSlug])

  const sessionParam =
    profile?.selectedDisciplines?.join(",") ||
    selectedIds.join(",")

  const profilePath = `/signup/${encodeURIComponent(
    organizationSlug,
  )}/youth/profile${
    sessionParam
      ? `?session=${encodeURIComponent(sessionParam)}`
      : ""
  }`

  async function handleSubmit() {
    if (!profile) return

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
        profile.accountEmail || "",
        password,
        profile,
      )

      if (result.emailConfirmationRequired) {
        setConfirmationRequired(true)
        return
      }

      setParticipantNumber(result.participantNumber)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-semibold text-slate-600">
          Loading cart…
        </p>
      </main>
    )
  }

  if (participantNumber) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />

          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            Registration complete
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            The ClayKeeper account was created and the season
            registration was recorded.
          </p>

          <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Participant Number: {participantNumber}
          </p>

          <Link
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Sign in to ClayKeeper
          </Link>
        </section>
      </main>
    )
  }

  if (confirmationRequired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <Mail className="mx-auto h-12 w-12 text-emerald-600" />

          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            Check your email
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-slate-900">
              {profile?.accountEmail}
            </span>
            . After the email is confirmed, ClayKeeper will
            finish the participant account.
          </p>
        </section>
      </main>
    )
  }

  if (!organization || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <h1 className="mt-6 text-2xl font-bold text-slate-950">
            Cart unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            The registration draft could not be found. Please
            return to the registration form and continue to cart
            again.
          </p>

          <Link
            to={`/signup/${encodeURIComponent(
              organizationSlug,
            )}/youth`}
            className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to session selection
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <img
              src={CLAYKEEPER_LOGO}
              alt="ClayKeeper TMK"
              className="h-24 w-56 object-contain object-left"
            />

            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              {organization.organizationName}
            </p>
          </div>

          <Link
            to={profilePath}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to registration form
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <ShoppingCart className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                  Cart and account setup
                </h1>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Review the season registration, then create the
                  ClayKeeper login for this shooter.
                </p>
              </div>
            </div>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-bold text-slate-950">
                Registration summary
              </h2>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-950">
                      2026 - 2027 Youth Season Registration
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {profile.firstName} {profile.lastName}
                    </p>

                    <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                      {selectedSessions.map((session) => (
                        <p
                          key={session.id}
                          className="text-xs font-medium text-slate-600"
                        >
                          • {session.name.replace("2026 - 2027: ", "")}
                        </p>
                      ))}
                    </div>
                  </div>

                  <p className="text-lg font-bold text-slate-950">
                    ${YOUTH_SEASON_REGISTRATION_FEE.toFixed(2)}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-700" />

                <h2 className="text-lg font-bold text-slate-950">
                  Payment
                </h2>
              </div>

              <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                Payment collection will live here. For now,
                ClayKeeper records the $35 season registration
                and creates the account so the registration flow
                can be tested end-to-end.
              </p>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-950">
                ClayKeeper login
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                This is the login the shooter or parent will use
                after registration.
              </p>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Email address
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="email"
                      value={profile.accountEmail || ""}
                      readOnly
                      className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-3 text-slate-700 outline-none"
                    />
                  </div>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Password
                  <div className="relative mt-2">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      autoComplete="new-password"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Confirm password
                  <div className="relative mt-2">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                </label>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}

              <Button
                type="button"
                className="mt-6 h-11 w-full"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting
                  ? "Completing registration..."
                  : "Complete registration"}
              </Button>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Order total
              </h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Season registration</span>
                  <span>
                    ${YOUTH_SEASON_REGISTRATION_FEE.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-950">
                  <span>Total</span>
                  <span>
                    ${YOUTH_SEASON_REGISTRATION_FEE.toFixed(2)}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <LockKeyhole className="h-4 w-4" />
                Secure online registration
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Waivers and registration details are saved with
                the account after this step is completed.
              </p>
            </section>

            <p className="text-center text-xs text-slate-400">
              ClayKeeper v{APP_VERSION}
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}
