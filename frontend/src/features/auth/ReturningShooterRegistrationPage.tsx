import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  APP_VERSION,
  CLAYKEEPER_LOGO,
} from "@/lib/branding"
import {
  loadParticipantSignupOrganization,
  type ParticipantSignupOrganization,
} from "@/lib/services/participantSignup"
import { supabase } from "@/lib/supabase"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    return String(error.message)
  }

  return "Unable to send the verification email."
}

export function ReturningShooterRegistrationPage() {
  const { organizationSlug = "" } = useParams()
  const [organization, setOrganization] =
    useState<ParticipantSignupOrganization | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadOrganization() {
      setLoading(true)
      setError("")

      try {
        const result =
          await loadParticipantSignupOrganization(
            organizationSlug,
          )

        if (!mounted) return
        setOrganization(result)

        if (!result) {
          setError(
            "This organization registration page is not available.",
          )
        }
      } catch (caught) {
        if (mounted) setError(errorMessage(caught))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadOrganization()

    return () => {
      mounted = false
    }
  }, [organizationSlug])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!organization) return

    setSubmitting(true)
    setError("")

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/season-registration?organization=${encodeURIComponent(
              organization.organizationSlug,
            )}`
          : undefined

      const { error: otpError } =
        await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            shouldCreateUser: false,
            emailRedirectTo: redirectTo,
            data: {
              returning_shooter_registration: {
                organization_slug:
                  organization.organizationSlug,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
              },
            },
          },
        })

      if (otpError) throw otpError

      setSent(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-semibold text-slate-600">
          Loading returning shooter registration…
        </p>
      </main>
    )
  }

  if (!organization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <h1 className="mt-6 text-2xl font-bold text-slate-950">
            Returning registration unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error || "This organization could not be found."}
          </p>

          <Link
            to="/signup"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Find another organization
          </Link>
        </section>
      </main>
    )
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
          <Mail className="mx-auto h-14 w-14 text-emerald-600" />

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
            Check your email
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            If{" "}
            <span className="font-semibold text-slate-900">
              {email.trim()}
            </span>{" "}
            is tied to an existing ClayKeeper shooter account, a
            verification link was sent. Open that email to
            confirm the shooter and continue season registration.
          </p>

          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            After verification, ClayKeeper will show the shooter
            profile on file and require the current season
            waivers, discipline selection, and signature.
          </p>

          <Link
            to={`/signup/${organization.organizationSlug}`}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to sign in choices
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-12 text-white lg:flex">
        <div>
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-44 w-72 object-contain object-left"
          />

          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Returning shooter verification
          </p>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            {organization.organizationName}
          </p>

          <h1 className="mt-5 text-5xl font-bold leading-tight">
            Verify the returning shooter before opening season
            registration.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            ClayKeeper sends a secure email link first. Once the
            email owner is verified, their existing profile can be
            shown for confirmation.
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

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <Link
              to={`/signup/${organization.organizationSlug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to choices
            </Link>

            <div className="mt-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <RefreshCw className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
                  {organization.organizationName}
                </p>

                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  Returning Shooter Registration
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Enter the shooter name and account email. We’ll
                  send a verification link before opening the
                  season registration forms.
                </p>
              </div>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Shooter first name
                  <div className="relative mt-2">
                    <User className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(event) =>
                        setFirstName(event.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Shooter last name
                  <div className="relative mt-2">
                    <User className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(event) =>
                        setLastName(event.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Account email address
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    placeholder="name@example.com"
                  />
                </div>
              </label>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                  <p className="text-sm leading-6 text-emerald-900">
                    The profile is only shown after the email link
                    is verified. Returning shooters will still
                    have to read and agree to all current season
                    forms.
                  </p>
                </div>
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
                disabled={submitting}
              >
                {submitting
                  ? "Sending verification..."
                  : "Send verification email"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
