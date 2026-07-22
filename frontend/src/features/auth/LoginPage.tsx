import { useState } from "react"
import type { FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { LockKeyhole, Mail, Target } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/useAuth"

type LoginLocationState = {
  from?: string
}

export function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const locationState = location.state as LoginLocationState | null
  const destination = locationState?.from ?? "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  if (session) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage("")

    try {
      await signIn(email.trim(), password)
      navigate(destination, { replace: true })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500 p-2">
            <Target className="h-7 w-7" />
          </div>

          <span className="text-2xl font-bold">ClayKeeper</span>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Shooting event management
          </p>

          <h1 className="mt-5 text-5xl font-bold leading-tight">
            Manage every shoot from registration through results.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Participants, squads, payments, live scoring, shoot-offs,
            and reporting—all in one organized system.
          </p>
        </div>

        <p className="text-sm text-slate-500">ClayKeeper v0.1.0</p>
      </section>

      <section className="flex items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="rounded-xl bg-emerald-500 p-2 text-white">
              <Target className="h-6 w-6" />
            </div>

            <span className="text-2xl font-bold text-slate-950">
              ClayKeeper
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              Welcome back
            </h2>

            <p className="mt-2 text-slate-500">
              Sign in to continue to ClayKeeper.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-700"
                >
                  Email address
                </label>

                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
                >
                  Password
                </label>

                <div className="relative mt-2">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />

                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {errorMessage ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {errorMessage}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}