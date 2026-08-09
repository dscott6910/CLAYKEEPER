import { ArrowLeft, Home } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

export function NotFoundPage() {
  const location = useLocation()

  return (
    <main className="flex min-h-[65vh] items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Page not found</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">That ClayKeeper page does not exist.</h1>
        <p className="mt-3 text-sm text-slate-600">
          The address may be outdated, incomplete, or no longer available. No tournament data was changed by opening this address.
        </p>
        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
          {location.pathname}
        </div>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  )
}
