import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import {
  HelpCircle,
  Lock,
  Mail,
  PencilLine,
  Plus,
  UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  CLAYKEEPER_LOGO,
} from "@/lib/branding"
import {
  loadParticipantSignupOrganization,
  type ParticipantSignupOrganization,
} from "@/lib/services/participantSignup"
import {
  YOUTH_REGISTRATION_SESSIONS,
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

  return "Unable to load registration information."
}

export function YouthRegistrationInformationPage() {
  const { organizationSlug = "" } = useParams()
  const [searchParams] = useSearchParams()
  const [organization, setOrganization] =
    useState<ParticipantSignupOrganization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [consentModalOpen, setConsentModalOpen] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [participantFirstName, setParticipantFirstName] =
    useState("")
  const [participantLastName, setParticipantLastName] =
    useState("")
  const [participantDateOfBirth, setParticipantDateOfBirth] =
    useState("")
  const [participantGender, setParticipantGender] = useState("")
  const [participantConfirmed, setParticipantConfirmed] =
    useState(false)

  const selectedIds = useMemo(
    () =>
      (searchParams.get("session") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [searchParams],
  )

  const selectedSessions = useMemo(() => {
    const sessions = youthRegistrationSessionsByIds(selectedIds)

    if (sessions.length > 0) return sessions

    return [YOUTH_REGISTRATION_SESSIONS[0]]
  }, [selectedIds])

  const selectedSessionParam = selectedSessions
    .map((session) => session.id)
    .join(",")

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
      } catch (loadError) {
        if (mounted) setError(errorMessage(loadError))
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
          Loading registration information…
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
            Registration information unavailable
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

  const profileSearchParams = new URLSearchParams({
    session: selectedSessionParam,
  })

  if (email.trim()) {
    profileSearchParams.set("email", email.trim())
  }

  if (participantFirstName.trim()) {
    profileSearchParams.set(
      "firstName",
      participantFirstName.trim(),
    )
  }

  if (participantLastName.trim()) {
    profileSearchParams.set(
      "lastName",
      participantLastName.trim(),
    )
  }

  if (participantDateOfBirth) {
    profileSearchParams.set(
      "birthDate",
      participantDateOfBirth,
    )
  }

  if (participantGender) {
    profileSearchParams.set("gender", participantGender)
  }

  const profilePath = `/signup/${encodeURIComponent(
    organization.organizationSlug,
  )}/youth/profile?${profileSearchParams.toString()}`

  const sessionSelectionPath = `/signup/${encodeURIComponent(
    organization.organizationSlug,
  )}/youth`

  const currentRegistrationPath =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : `/signup/${encodeURIComponent(
          organization.organizationSlug,
        )}/youth/registration?session=${encodeURIComponent(selectedSessionParam)}`

  const termsPath = `/terms?returnTo=${encodeURIComponent(
    currentRegistrationPath,
  )}`

  const privacyPath = `/privacy?returnTo=${encodeURIComponent(
    currentRegistrationPath,
  )}`

  function handleEmailNext() {
    if (!email.trim()) return
    setConsentModalOpen(true)
  }

  function handleConsentNext() {
    if (!termsAccepted || !privacyAccepted) return
    setConsentModalOpen(false)
    setEmailConfirmed(true)
  }

  const participantReady =
    participantFirstName.trim() &&
    participantLastName.trim() &&
    participantDateOfBirth &&
    participantGender

  function handleParticipantContinue() {
    if (!participantReady) return
    setParticipantConfirmed(true)
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <img
              src={CLAYKEEPER_LOGO}
              alt="ClayKeeper TMK"
              className="mx-auto h-28 w-64 object-contain"
            />

            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              {organization.organizationName}
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                Registration Information
              </h1>

              <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Complete the following information to register
              </p>

              <div className="mt-6 space-y-4">
                <RegistrationPanel
                  step="1"
                  title="Enter your email address"
                  active={!emailConfirmed}
                  complete={emailConfirmed}
                >
                  {emailConfirmed ? (
                    <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600">
                          ✓
                        </span>

                        <span>{email}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEmailConfirmed(false)
                          setParticipantConfirmed(false)
                        }}
                        className="text-left text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline sm:text-right"
                      >
                        Change email address
                      </button>
                    </div>
                  ) : (
                    <>
                      <label
                        htmlFor="registration-email"
                        className="text-sm font-medium text-slate-700"
                      >
                        Email address{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <div className="relative mt-2">
                        <Mail className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />

                        <input
                          id="registration-email"
                          type="email"
                          required
                          value={email}
                          onChange={(event) =>
                            setEmail(event.target.value)
                          }
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        />
                      </div>

                      <Button
                        type="button"
                        className="mt-4 h-11 w-full"
                        onClick={handleEmailNext}
                        disabled={!email.trim()}
                      >
                        Next
                      </Button>
                    </>
                  )}
                </RegistrationPanel>

                <RegistrationPanel
                  step="2"
                  title="Participants & options"
                  active={emailConfirmed}
                  action={
                    <Link
                      to={sessionSelectionPath}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add sessions
                    </Link>
                  }
                >
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-950">
                            2026 - 2027 Youth Season Registration
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {selectedSessions[0]?.dates}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {organization.organizationName}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Child
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

                        <div className="text-right">
                          <Link
                            to={sessionSelectionPath}
                            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                          >
                            Change
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-5">
                      <h3 className="font-bold text-slate-800">
                        Who is attending?
                      </h3>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-slate-700">
                          <span>
                            Participant first name{" "}
                            <span className="text-amber-500">*</span>
                          </span>

                          <input
                            type="text"
                            value={participantFirstName}
                            onChange={(event) => {
                              setParticipantFirstName(
                                event.target.value,
                              )
                              setParticipantConfirmed(false)
                            }}
                            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          <span>
                            Participant last name{" "}
                            <span className="text-amber-500">*</span>
                          </span>

                          <input
                            type="text"
                            value={participantLastName}
                            onChange={(event) => {
                              setParticipantLastName(
                                event.target.value,
                              )
                              setParticipantConfirmed(false)
                            }}
                            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          <span>
                            Date of birth{" "}
                            <span className="text-amber-500">*</span>
                          </span>

                          <input
                            type="date"
                            value={participantDateOfBirth}
                            onChange={(event) => {
                              setParticipantDateOfBirth(
                                event.target.value,
                              )
                              setParticipantConfirmed(false)
                            }}
                            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          <span>
                            Gender{" "}
                            <span className="text-amber-500">*</span>
                          </span>

                          <select
                            value={participantGender}
                            onChange={(event) => {
                              setParticipantGender(
                                event.target.value,
                              )
                              setParticipantConfirmed(false)
                            }}
                            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          >
                            <option value="">Select one</option>
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="prefer-not-to-answer">
                              Prefer not to answer
                            </option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-5 flex justify-end">
                        <Button
                          type="button"
                          className="min-h-11 px-8"
                          disabled={!participantReady}
                          onClick={handleParticipantContinue}
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>
                </RegistrationPanel>

                <RegistrationPanel
                  step="3"
                  title="Registration forms"
                  active={participantConfirmed}
                >
                  <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <UserRound className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="font-bold text-slate-950">
                          Youth shooter profile
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Enter participant, emergency contact,
                          membership, and login details.
                        </p>
                      </div>
                    </div>

                    <Link
                      to={participantConfirmed ? profilePath : "#"}
                      onClick={(event) => {
                        if (!participantConfirmed)
                          event.preventDefault()
                      }}
                      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold ${
                        participantConfirmed
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "cursor-not-allowed bg-slate-200 text-slate-400"
                      }`}
                    >
                      <PencilLine className="h-4 w-4" />
                      Open form
                    </Link>
                  </div>

                </RegistrationPanel>
              </div>
            </div>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <Lock className="h-4 w-4" />
                  Secure online registration
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-slate-500" />

                  <h2 className="text-xl font-bold text-slate-950">
                    Have questions?
                  </h2>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
                  <p className="font-semibold text-slate-800">
                    {selectedSessions[0]?.name} contact
                  </p>

                  <p className="mt-2">
                    Contact your organization administrator.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>

      {consentModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-consent-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="signup-consent-title"
                  className="text-xl font-bold tracking-tight text-slate-950"
                >
                  Terms and privacy
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  You must accept ClayKeeper&apos;s Terms of Use
                  and acknowledge the Privacy Policy before
                  continuing with online registration.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConsentModalOpen(false)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close terms and privacy dialog"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) =>
                    setTermsAccepted(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />

                <span>
                  I have read and agree to ClayKeeper&apos;s{" "}
                  <a
                    href={termsPath}
                    className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Terms of Use
                  </a>
                  .
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) =>
                    setPrivacyAccepted(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />

                <span>
                  I have read and am aware of ClayKeeper&apos;s{" "}
                  <a
                    href={privacyPath}
                    className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            </div>

            <Button
              type="button"
              className="mt-6 h-11 w-full"
              disabled={!termsAccepted || !privacyAccepted}
              onClick={handleConsentNext}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function RegistrationPanel({
  step,
  title,
  active,
  complete = false,
  action,
  children,
}: {
  step: string
  title: string
  active: boolean
  complete?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border ${
        active
          ? "border-slate-950 bg-white shadow-sm"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-4 px-5 py-4 ${
          active
            ? "bg-slate-950 text-white"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center border-r pr-3 text-lg font-bold ${
              active
                ? "border-white/30 text-white"
                : "border-slate-300 text-slate-500"
            }`}
          >
            {complete ? "✓" : step}
          </span>

          <h2 className="text-lg font-bold uppercase">
            {title}
          </h2>
        </div>

        {action}
      </div>

      <div className="p-5">{children}</div>
    </section>
  )
}
