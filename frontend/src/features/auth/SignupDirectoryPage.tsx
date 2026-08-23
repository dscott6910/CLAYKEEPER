import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  ChevronRight,
  Search,
} from "lucide-react"

import {
  APP_VERSION,
  CLAYKEEPER_LOGO,
} from "@/lib/branding"
import {
  loadSignupDirectory,
  type SignupDirectoryOrganization,
} from "@/lib/services/signupDirectory"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    return String(error.message)
  }

  return "Unable to load organizations."
}

export function SignupDirectoryPage() {
  const [organizations, setOrganizations] = useState<
    SignupDirectoryOrganization[]
  >([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError("")

      try {
        const next = await loadSignupDirectory()

        if (mounted) {
          setOrganizations(next)
        }
      } catch (nextError) {
        if (mounted) {
          setError(errorMessage(nextError))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return organizations

    return organizations.filter((organization) =>
      organization.organizationName
        .toLowerCase()
        .includes(query),
    )
  }, [organizations, search])

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/login">
            <img
              src={CLAYKEEPER_LOGO}
              alt="ClayKeeper TMK"
              className="h-20 w-48 object-contain object-left"
            />
          </Link>

          <Link
            to="/login"
            className="text-sm font-semibold text-slate-600 hover:text-emerald-700"
          >
            Back to sign in
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <Building2 className="h-7 w-7 text-emerald-700" />
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
              Find your organization
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Select your organization to sign in, register a
              youth shooter, or request coach, scorekeeper,
              admin, or volunteer access.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-xl">
            <label
              htmlFor="organization-search"
              className="text-sm font-semibold text-slate-700"
            >
              Find your organization
            </label>

            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />

              <input
                id="organization-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search organizations"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {loading ? (
              <div className="py-14 text-center">
                <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
                <p className="mt-4 text-sm text-slate-500">
                  Loading organizations...
                </p>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            ) : organizations.length === 0 ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="font-semibold text-slate-800">
                  No organizations are currently available.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Please contact your club or organization.
                </p>
              </div>
            ) : filteredOrganizations.length === 0 ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="font-semibold text-slate-800">
                  No matching organization found.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Try a different organization name.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                {filteredOrganizations.map(
                  (organization) => (
                    <Link
                      key={organization.organizationSlug}
                      to={`/signup/${encodeURIComponent(
                        organization.organizationSlug,
                      )}`}
                      className="flex min-h-16 items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        <Building2 className="h-5 w-5 text-slate-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-950">
                          {organization.organizationName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Open registration page
                        </p>
                      </div>

                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          ClayKeeper v{APP_VERSION}
        </p>
      </div>
    </main>
  )
}
