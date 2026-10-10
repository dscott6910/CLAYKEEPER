import { useEffect, useState } from "react"
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react"
import { Link, useLocation, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/useAuth"
import { APP_VERSION, CLAYKEEPER_LOGO } from "@/lib/branding"
import {
  getParticipantSeasonRegistrationStatus,
  type ParticipantSeasonRegistrationStatus,
} from "@/lib/services/participantSeasonRegistration"
import { loadParticipantSignupOrganization } from "@/lib/services/participantSignup"

const MAX_STATUS_CHECKS = 20

export function YouthRegistrationPaymentSuccessPage() {
  const { organizationSlug = "" } = useParams()
  const location = useLocation()
  const { session, loading: authLoading } = useAuth()
  const [status, setStatus] =
    useState<ParticipantSeasonRegistrationStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading || !session) {
      setChecking(false)
      return
    }

    let cancelled = false
    let timer: number | undefined

    async function checkPayment(attempt = 0) {
      try {
        const organization =
          await loadParticipantSignupOrganization(organizationSlug)

        if (!organization) {
          throw new Error("This organization registration page is unavailable.")
        }

        const nextStatus =
          await getParticipantSeasonRegistrationStatus(
            organization.organizationId,
          )

        if (cancelled) return
        setStatus(nextStatus)

        if (
          nextStatus?.paymentStatus === "paid" ||
          nextStatus?.paymentStatus === "waived" ||
          attempt >= MAX_STATUS_CHECKS - 1
        ) {
          setChecking(false)
          return
        }

        timer = window.setTimeout(
          () => void checkPayment(attempt + 1),
          1500,
        )
      } catch (caught) {
        if (cancelled) return
        setError(
          caught instanceof Error
            ? caught.message
            : "Payment status could not be verified.",
        )
        setChecking(false)
      }
    }

    setChecking(true)
    void checkPayment()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [authLoading, organizationSlug, session])

  const paid =
    status?.paymentStatus === "paid" ||
    status?.paymentStatus === "waived"

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl sm:p-10">
        <img
          src={CLAYKEEPER_LOGO}
          alt="ClayKeeper TMK"
          className="mx-auto h-28 w-56 object-contain"
        />

        {authLoading ? (
          <StatusMessage
            icon={<Clock3 className="h-8 w-8" />}
            title="Restoring your secure session…"
            description="Please keep this page open."
          />
        ) : !session ? (
          <StatusMessage
            icon={<ShieldCheck className="h-8 w-8" />}
            title="Sign in to verify your payment"
            description="Stripe returned you safely to ClayKeeper. Sign in with the account used for registration to view the receipt status."
          >
            <Link
              to="/login"
              state={{ from: `${location.pathname}${location.search}` }}
              className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Sign in
            </Link>
          </StatusMessage>
        ) : error ? (
          <StatusMessage
            icon={<Clock3 className="h-8 w-8" />}
            title="Payment verification is delayed"
            description={error}
          >
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Check again
            </Button>
          </StatusMessage>
        ) : paid ? (
          <StatusMessage
            icon={<CheckCircle2 className="h-8 w-8" />}
            title="Registration payment complete"
            description="Your season registration is complete and your payment has been recorded in ClayKeeper."
            success
          >
            {status?.participantNumber ? (
              <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Participant Number: <strong>{status.participantNumber}</strong>
              </p>
            ) : null}

            <Link
              to="/my-profile"
              className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Go to my profile
            </Link>
          </StatusMessage>
        ) : (
          <StatusMessage
            icon={<Clock3 className="h-8 w-8 animate-pulse" />}
            title={checking ? "Confirming your payment…" : "Payment is still processing"}
            description={
              checking
                ? "Stripe has returned you to ClayKeeper. This usually takes only a few seconds."
                : "Your registration is saved. Refresh this page shortly to check the payment again."
            }
          >
            {!checking ? (
              <Button className="mt-6" onClick={() => window.location.reload()}>
                Check again
              </Button>
            ) : null}
          </StatusMessage>
        )}

        <p className="mt-8 text-xs text-slate-400">
          ClayKeeper v{APP_VERSION}
        </p>
      </section>
    </main>
  )
}

function StatusMessage({
  icon,
  title,
  description,
  success = false,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  success?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="mt-4">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
          success
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {icon}
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
        {description}
      </p>
      {children}
    </div>
  )
}
