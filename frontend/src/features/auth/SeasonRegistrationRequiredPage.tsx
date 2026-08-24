import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react"
import {
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  WAIVER_FORMS,
  type WaiverKey,
} from "@/features/auth/ParticipantSignupPage"
import { useOrganization } from "@/features/organization/OrganizationProvider"
import {
  completeParticipantSeasonRegistration,
  getParticipantSeasonRegistrationStatus,
  type ParticipantSeasonRegistrationStatus,
} from "@/lib/services/participantSeasonRegistration"
import { YOUTH_REGISTRATION_SESSIONS } from "@/lib/services/youthRegistrationSessions"

const WAIVER_KEYS: WaiverKey[] = [
  "parentAthlete",
  "medicalConsent",
  "sportsmanship",
  "clayKeeperAgreement",
]

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "Unable to complete season registration."
}

export function SeasonRegistrationRequiredPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    organizationId,
    loading: organizationLoading,
    memberships,
    switching,
    switchOrganization,
  } = useOrganization()

  const [status, setStatus] =
    useState<ParticipantSeasonRegistrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [selectedDisciplines, setSelectedDisciplines] =
    useState<string[]>([])
  const [activeWaiver, setActiveWaiver] =
    useState<WaiverKey | null>(null)
  const [waiversRead, setWaiversRead] = useState<
    Record<WaiverKey, boolean>
  >({
    parentAthlete: false,
    medicalConsent: false,
    sportsmanship: false,
    clayKeeperAgreement: false,
  })
  const [waiversAccepted, setWaiversAccepted] = useState<
    Record<WaiverKey, boolean>
  >({
    parentAthlete: false,
    medicalConsent: false,
    sportsmanship: false,
    clayKeeperAgreement: false,
  })
  const [signatureMode, setSignatureMode] =
    useState<"drawn" | "typed">("drawn")
  const [drawnSignature, setDrawnSignature] = useState("")
  const [typedSignature, setTypedSignature] = useState("")
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)

  const requestedOrganizationSlug =
    searchParams.get("organization") || ""
  const verifiedReturningShooter =
    Boolean(requestedOrganizationSlug)

  useEffect(() => {
    let mounted = true

    async function loadStatus() {
      if (organizationLoading || switching || !organizationId) return

      setLoading(true)
      setError("")

      try {
        const result =
          await getParticipantSeasonRegistrationStatus(organizationId)

        if (!mounted) return
        setStatus(result)
      } catch (caught) {
        if (!mounted) return
        setError(errorMessage(caught))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadStatus()

    return () => {
      mounted = false
    }
  }, [organizationId, organizationLoading, switching])

  useEffect(() => {
    if (
      organizationLoading ||
      switching ||
      !requestedOrganizationSlug
    ) {
      return
    }

    const requestedMembership = memberships.find(
      (membership) =>
        membership.organizationSlug ===
        requestedOrganizationSlug,
    )

    if (
      !requestedMembership ||
      requestedMembership.organizationId === organizationId
    ) {
      return
    }

    void switchOrganization(
      requestedMembership.organizationId,
    )
  }, [
    memberships,
    organizationId,
    organizationLoading,
    requestedOrganizationSlug,
    switching,
    switchOrganization,
  ])

  function toggleDiscipline(id: string) {
    setSelectedDisciplines((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  function markWaiverRead(waiver: WaiverKey) {
    setWaiversRead((current) => ({
      ...current,
      [waiver]: true,
    }))
    setActiveWaiver(null)
  }

  function toggleWaiver(waiver: WaiverKey, checked: boolean) {
    setWaiversAccepted((current) => ({
      ...current,
      [waiver]: checked,
    }))
  }

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function beginSignature(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const point = getCanvasPoint(event)
    if (!canvas || !point) return

    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true

    const context = canvas.getContext("2d")
    if (!context) return

    context.lineWidth = 3
    context.lineCap = "round"
    context.lineJoin = "round"
    context.strokeStyle = "#0f172a"
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function drawSignature(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return

    const canvas = canvasRef.current
    const point = getCanvasPoint(event)
    if (!canvas || !point) return

    const context = canvas.getContext("2d")
    if (!context) return

    context.lineTo(point.x, point.y)
    context.stroke()
    setDrawnSignature(canvas.toDataURL("image/png"))
  }

  function endSignature(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)

    const canvas = canvasRef.current
    if (canvas) setDrawnSignature(canvas.toDataURL("image/png"))
  }

  function clearDrawnSignature() {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas
      .getContext("2d")
      ?.clearRect(0, 0, canvas.width, canvas.height)
    setDrawnSignature("")
  }

  async function handleSubmit() {
    if (!status?.organizationId) return

    setError("")

    if (selectedDisciplines.length === 0) {
      setError("Please select at least one discipline.")
      return
    }

    const allWaiversAccepted = WAIVER_KEYS.every(
      (waiver) => waiversAccepted[waiver],
    )

    if (!allWaiversAccepted) {
      setError("Please read and accept all waiver forms.")
      return
    }

    const signatureValue =
      signatureMode === "drawn"
        ? drawnSignature
        : typedSignature.trim()

    if (!signatureValue) {
      setError("Please complete the digital signature.")
      return
    }

    setSubmitting(true)

    try {
      await completeParticipantSeasonRegistration({
        organizationId: status.organizationId,
        selectedDisciplines,
        waiversAccepted,
        signatureType: signatureMode,
        signatureValue,
      })

      navigate("/my-profile", { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  if (organizationLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />

          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading season registration...
          </p>
        </div>
      </div>
    )
  }

  if (status && !status.registrationRequired) {
    return <Navigate to="/my-profile" replace />
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
          Season registration required
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Welcome back — confirm this season
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your shooter profile already exists, but registration is
          required for{" "}
          <strong>{status?.seasonName || "the active season"}</strong>.
          Confirm your profile, read the waivers, sign, and continue.
        </p>

        {verifiedReturningShooter ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            Email verified. Review the profile information on
            file, then complete this season&apos;s discipline
            selection, waivers, and signature.
          </div>
        ) : null}

        {status ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="font-bold text-slate-950">
              Shooter profile on file
            </h2>

            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-500">
                  Name
                </dt>
                <dd className="mt-1 text-slate-950">
                  {[status.firstName, status.lastName]
                    .filter(Boolean)
                    .join(" ") || "Not listed"}
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">
                  Participant Number
                </dt>
                <dd className="mt-1 text-slate-950">
                  {status.participantNumber || "Not assigned"}
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">
                  Email
                </dt>
                <dd className="mt-1 text-slate-950">
                  {status.email || "Not listed"}
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">
                  Phone
                </dt>
                <dd className="mt-1 text-slate-950">
                  {status.phone || "Not listed"}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="font-bold text-slate-950">
            Select disciplines
          </h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {YOUTH_REGISTRATION_SESSIONS.map((session) => (
              <label
                key={session.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedDisciplines.includes(session.id)}
                  onChange={() => toggleDiscipline(session.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />

                <span>
                  <span className="font-semibold text-slate-950">
                    {session.name.replace("2026 - 2027: ", "")}
                  </span>

                  <span className="mt-1 block text-xs text-slate-500">
                    {session.dates}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6 border-t border-slate-200 pt-6">
          <h2 className="font-bold text-slate-950">
            Waivers and agreements
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Each form must be opened and read before its checkbox
            can be selected.
          </p>

          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {WAIVER_KEYS.map((waiver) => (
              <label
                key={waiver}
                className="flex items-start gap-3 text-sm leading-6 text-slate-700"
              >
                <input
                  type="checkbox"
                  disabled={!waiversRead[waiver]}
                  checked={waiversAccepted[waiver]}
                  onChange={(event) =>
                    toggleWaiver(waiver, event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200"
                />

                <span>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setActiveWaiver(waiver)}
                    className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    {WAIVER_FORMS[waiver].title}
                  </button>
                  <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-medium text-slate-500">
                    {waiversRead[waiver] ? "Read" : "Read first"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6 border-t border-slate-200 pt-6">
          <h2 className="font-bold text-slate-950">
            Digital signature
          </h2>

          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={signatureMode === "drawn"}
                onChange={() => setSignatureMode("drawn")}
                className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Write your signature
            </label>

            {signatureMode === "drawn" ? (
              <div>
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={240}
                  onPointerDown={beginSignature}
                  onPointerMove={drawSignature}
                  onPointerUp={endSignature}
                  onPointerCancel={endSignature}
                  className="h-36 w-full touch-none rounded-lg border border-slate-300 bg-white"
                  aria-label="Draw your signature"
                />

                <button
                  type="button"
                  onClick={clearDrawnSignature}
                  className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Clear signature
                </button>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={signatureMode === "typed"}
                onChange={() => setSignatureMode("typed")}
                className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Type your signature
            </label>

            {signatureMode === "typed" ? (
              <input
                type="text"
                value={typedSignature}
                onChange={(event) =>
                  setTypedSignature(event.target.value)
                }
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="Type your legal signature"
              />
            ) : null}
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          className="mt-6 min-h-11 w-full"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? "Completing registration..."
            : "Complete season registration"}
        </Button>
      </div>

      {activeWaiver ? (
        <WaiverModal
          waiver={activeWaiver}
          onClose={() => setActiveWaiver(null)}
          onRead={() => markWaiverRead(activeWaiver)}
        />
      ) : null}
    </div>
  )
}

function WaiverModal({
  waiver,
  onClose,
  onRead,
}: {
  waiver: WaiverKey
  onClose: () => void
  onRead: () => void
}) {
  const form = WAIVER_FORMS[waiver]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-waiver-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              Waiver and agreement
            </p>

            <h2
              id="season-waiver-title"
              className="mt-1 text-2xl font-bold tracking-tight text-slate-950"
            >
              {form.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close waiver"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="whitespace-pre-line text-sm leading-7 text-slate-700">
            {form.body}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            Please review the full form before agreeing.
          </p>

          <Button
            type="button"
            className="min-h-11 px-6"
            onClick={onRead}
          >
            I have read this form
          </Button>
        </div>
      </div>
    </div>
  )
}
