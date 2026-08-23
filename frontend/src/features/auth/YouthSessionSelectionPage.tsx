import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  CalendarDays,
  Check,
  ClipboardList,
  HelpCircle,
  Lock,
  MapPin,
  ShoppingCart,
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
import {
  YOUTH_SEASON_REGISTRATION_FEE,
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

  return "Unable to load session selection."
}

export function YouthSessionSelectionPage() {
  const { organizationSlug = "" } = useParams()
  const [organization, setOrganization] =
    useState<ParticipantSignupOrganization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [cartAdded, setCartAdded] = useState(false)

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

  const selectedSessions = useMemo(
    () => youthRegistrationSessionsByIds(selectedIds),
    [selectedIds],
  )

  const total =
    cartAdded && selectedSessions.length
      ? YOUTH_SEASON_REGISTRATION_FEE
      : 0

  function toggleSession(sessionId: string) {
    setSelectedIds((current) => {
      const next = current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId]

      if (next.length === 0) {
        setCartAdded(false)
      }

      return next
    })
  }

  function addRegistrationToCart() {
    if (!selectedSessions.length) return
    setCartAdded(true)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-semibold text-slate-600">
          Loading session selection…
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
            Session selection unavailable
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

  const registrationInfoPath = `/signup/${encodeURIComponent(
    organization.organizationSlug,
  )}/youth/registration?session=${encodeURIComponent(selectedIds.join(","))}`

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to={`/signup/${organization.organizationSlug}`}>
              <img
                src={CLAYKEEPER_LOGO}
                alt="ClayKeeper TMK"
                className="h-24 w-56 object-contain object-left"
              />
            </Link>

            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              {organization.organizationName}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
              Youth shooter registration
            </p>

            <p className="mt-1 text-sm text-slate-300">
              Select at least one discipline before entering
              participant information.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr_320px]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Filter by
              </h2>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Location
                </p>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-600" />

                    <p className="text-sm leading-5 text-slate-700">
                      {organization.organizationName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Registration type
                </p>

                <p className="mt-2 text-sm text-slate-700">
                  Youth shooter
                </p>
              </div>
            </section>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                  Session Selection
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Choose one or more season sessions. You can
                  choose multiple disciplines for one $35 season
                  registration.
                </p>
              </div>

              <Link
                to={`/signup/${organization.organizationSlug}`}
                className="text-sm font-semibold text-slate-500 hover:text-emerald-700"
              >
                Back
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {YOUTH_REGISTRATION_SESSIONS.map((session) => {
                const selected = selectedIds.includes(session.id)

                return (
                  <article
                    key={session.id}
                    className={`rounded-2xl border p-5 transition ${
                      selected
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-950">
                          {session.name}
                        </h2>

                        <button
                          type="button"
                          className="mt-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          View more details
                        </button>

                        <div className="mt-4 grid gap-2 text-sm text-slate-600">
                          <p className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-slate-400" />
                            {session.dates}
                          </p>

                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            {session.location}
                          </p>

                          <p className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-slate-400" />
                            {session.description}
                          </p>
                        </div>
                      </div>

                      <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 sm:w-48">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-700">
                            Discipline
                          </span>

                          <span className="font-bold text-slate-950">
                            Included
                          </span>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          Select at least one discipline before
                          adding the season registration to your
                          cart.
                        </p>

                        <Button
                          type="button"
                          variant={selected ? "outline" : "default"}
                          className="mt-4 h-10 w-full"
                          onClick={() =>
                            toggleSession(session.id)
                          }
                        >
                          {selected ? "Remove discipline" : "Select discipline"}
                        </Button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 rounded-t-2xl bg-slate-950 px-5 py-4 text-white">
                <ShoppingCart className="h-5 w-5" />

                <h2 className="text-lg font-bold">
                  Your shopping cart
                </h2>
              </div>

              <div className="p-5">
                {!cartAdded ? (
                  <p className="text-sm leading-6 text-slate-600">
                    Choose at least one discipline on the left,
                    then add the $35 season registration to your
                    cart.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-950">
                        2026 - 2027 Youth Season Registration
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Child — ${YOUTH_SEASON_REGISTRATION_FEE.toFixed(2)}
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

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm">
                      <span className="font-semibold text-slate-700">
                        Total
                      </span>

                      <span className="text-lg font-bold text-slate-950">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {!cartAdded ? (
                  <Button
                    type="button"
                    className="mt-5 h-11 w-full"
                    disabled={!selectedSessions.length}
                    onClick={addRegistrationToCart}
                  >
                    Add registration to cart
                  </Button>
                ) : null}

                <Link
                  to={cartAdded && selectedSessions.length ? registrationInfoPath : "#"}
                  aria-disabled={!cartAdded || !selectedSessions.length}
                  onClick={(event) => {
                    if (!cartAdded || !selectedSessions.length) {
                      event.preventDefault()
                    }
                  }}
                  className={`mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-5 text-sm font-semibold transition ${
                    cartAdded && selectedSessions.length
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "cursor-not-allowed bg-slate-200 text-slate-400"
                  }`}
                >
                  Continue
                </Link>

                <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Lock className="h-4 w-4" />
                  Secure online registration
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-slate-500" />

                <h2 className="text-lg font-bold text-slate-950">
                  Have questions?
                </h2>
              </div>

              <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-800">
                  Agency primary contact
                </p>

                <p>Contact your organization administrator.</p>
              </div>
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
