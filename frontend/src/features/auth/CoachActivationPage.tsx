import {
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  createCoachAccount,
  loadPendingCoachActivationEmail,
  loadPendingCoachActivationToken,
  redeemCoachActivation,
  savePendingCoachActivationToken,
  signInCoachAccount,
} from "@/lib/services/coachActivation"
import { supabase } from "@/lib/supabase"

type Mode = "create" | "signin"

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Unable to activate this coach account."
}

export function CoachActivationPage() {
  const { token: routeToken = "" } = useParams()
  const navigate = useNavigate()

  const token = useMemo(
    () =>
      routeToken ||
      loadPendingCoachActivationToken(),
    [routeToken],
  )

  const [mode, setMode] =
    useState<Mode>("create")

  const [email, setEmail] = useState("")
  const [password, setPassword] =
    useState("")
  const [confirmPassword, setConfirmPassword] =
    useState("")

  const [busy, setBusy] = useState(false)
  const [checkingSession, setCheckingSession] =
    useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (token) {
      savePendingCoachActivationToken(token)
    }
  }, [token])

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      setCheckingSession(true)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const pendingEmail =
          loadPendingCoachActivationEmail()

        const sessionEmail =
          session?.user.email?.trim().toLowerCase() ?? ""

        if (
          !cancelled &&
          session &&
          token &&
          pendingEmail &&
          sessionEmail === pendingEmail
        ) {
          await redeemCoachActivation(token)

          if (!cancelled) {
            navigate("/coach", {
              replace: true,
            })
          }
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(errorMessage(nextError))
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false)
        }
      }
    }

    void checkSession()

    return () => {
      cancelled = true
    }
  }, [navigate, token])

  async function submitCreate() {
    if (!token) {
      setError(
        "This coach activation link is invalid.",
      )
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setBusy(true)
    setError("")
    setMessage("")

    try {
      const result = await createCoachAccount({
        email,
        password,
        token,
      })

      if (result.sessionCreated) {
        await redeemCoachActivation(token)

        navigate("/coach", {
          replace: true,
        })
        return
      }

      setMessage(
        "Account created. Check your email and confirm your address. After confirmation, ClayKeeper will return you here to finish coach activation.",
      )
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setBusy(false)
    }
  }

  async function submitSignIn() {
    if (!token) {
      setError(
        "This coach activation link is invalid.",
      )
      return
    }

    setBusy(true)
    setError("")
    setMessage("")

    try {
      await signInCoachAccount({
        email,
        password,
      })

      await redeemCoachActivation(token)

      navigate("/coach", {
        replace: true,
      })
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setBusy(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Checking coach activation…
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">
              ClayKeeper
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Activate Coach Account
            </h1>

            <p className="mt-3 text-sm text-slate-600">
              Use the email address associated
              with your coach profile.
            </p>
          </div>

          {!token ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              This coach activation link is
              invalid or incomplete.
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}

          <div className="mt-6 flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("create")
                setError("")
                setMessage("")
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === "create"
                  ? "bg-white shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Create Account
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signin")
                setError("")
                setMessage("")
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === "signin"
                  ? "bg-white shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Already Have an Account
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>

            <label className="block text-sm font-medium">
              Password
              <input
                type="password"
                autoComplete={
                  mode === "create"
                    ? "new-password"
                    : "current-password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>

            {mode === "create" ? (
              <label className="block text-sm font-medium">
                Confirm Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value,
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            ) : null}

            <Button
              className="w-full"
              disabled={
                busy ||
                !token ||
                !email.trim() ||
                !password
              }
              onClick={() =>
                void (
                  mode === "create"
                    ? submitCreate()
                    : submitSignIn()
                )
              }
            >
              {busy
                ? "Working…"
                : mode === "create"
                  ? "Create Coach Account"
                  : "Sign In & Activate"}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Coach access is granted only after
            ClayKeeper verifies this invitation
            and the matching account email.
          </p>

          <p className="mt-4 text-center text-sm">
            <Link
              to="/login"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Return to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
