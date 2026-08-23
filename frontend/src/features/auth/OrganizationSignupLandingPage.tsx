import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ClipboardCheck,
  LogIn,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react"

import {
  APP_VERSION,
  CLAYKEEPER_LOGO,
} from "@/lib/branding"
import {
  loadParticipantSignupOrganization,
  type ParticipantSignupOrganization,
} from "@/lib/services/participantSignup"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    return String(error.message)
  }

  return "Unable to load this organization."
}

export function OrganizationSignupLandingPage() {
  const { organizationSlug = "" } = useParams()
  const [organization, setOrganization] =
    useState<ParticipantSignupOrganization | null>(null)
  const [loading, setLoading] = useState(true)
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

        if (!result) {
          setError(
            "This organization registration page is not available.",
          )
          return
        }

        setOrganization(result)
      } catch (nextError) {
        if (mounted) setError(errorMessage(nextError))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadOrganization()

    return () => {
      mounted = false
    }
  }, [organizationSlug])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-semibold text-slate-600">
          Loading registration page…
        </p>
      </main>
    )
  }

  if (!organization || error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <h1 className="mt-6 text-2xl font-bold text-slate-950">
            Registration page unavailable
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
        </div>
      </main>
    )
  }

  const youthSignupPath = `/signup/${encodeURIComponent(
    organization.organizationSlug,
  )}/youth`

  const staffSignupPath = `/signup/${encodeURIComponent(
    organization.organizationSlug,
  )}/staff`

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-12 text-white lg:flex">
        <div>
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-44 w-72 object-contain object-left"
          />

          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Organization registration
          </p>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            {organization.organizationName}
          </p>

          <h1 className="mt-5 text-5xl font-bold leading-tight">
            Register, sign in, and get ready for the season.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Families can create shooter accounts, staff can
            request organization access, and returning users can
            sign in from one organization-specific page.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          ClayKeeper v{APP_VERSION}
        </p>
      </section>

      <section className="flex items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-6 lg:hidden">
            <img
              src={CLAYKEEPER_LOGO}
              alt="ClayKeeper TMK"
              className="h-24 w-48 object-contain object-left"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              {organization.organizationName}
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Choose how to continue
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Select the path that matches your role. Each
              organization has its own registration page and
              season setup.
            </p>

            <div className="mt-8 grid gap-4">
              <RegistrationChoice
                to="/login"
                icon={LogIn}
                title="Sign in"
                eyebrow="Already registered"
                description="Use this if you already have a ClayKeeper account for this organization."
              />

              <RegistrationChoice
                to={youthSignupPath}
                icon={UserRoundPlus}
                title="Sign up as a youth shooter"
                eyebrow="Player / participant"
                description="Create the shooter profile, emergency contact, season registration, and payment record."
                primary
              />

              <RegistrationChoice
                to={staffSignupPath}
                icon={ShieldCheck}
                title="Sign up as coach, scorekeeper, admin, or volunteer"
                eyebrow="Organization staff"
                description="Request role-based access. Organization owners can approve staff access before permissions are granted."
              />
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                <p className="text-sm leading-6 text-amber-900">
                  Season dues and ClayKeeper subscription checkout
                  will be shown during youth shooter registration
                  once pricing is configured for this organization.
                </p>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              Looking for a different club?{" "}
              <Link
                to="/signup"
                className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                Find another organization
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function RegistrationChoice({
  to,
  icon: Icon,
  title,
  eyebrow,
  description,
  primary = false,
}: {
  to: string
  icon: typeof LogIn
  title: string
  eyebrow: string
  description: string
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      className={`group flex gap-4 rounded-2xl border p-5 transition ${
        primary
          ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500 hover:bg-emerald-100"
          : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50"
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          primary
            ? "bg-emerald-600 text-white"
            : "bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-700"
        }`}
      >
        <Icon className="h-6 w-6" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          {eyebrow}
        </p>

        <h3 className="mt-1 text-lg font-bold text-slate-950">
          {title}
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
    </Link>
  )
}
