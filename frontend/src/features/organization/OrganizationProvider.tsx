import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

import { useAuth } from "@/features/auth/useAuth"
import {
  defaultBrandSettings,
  saveBrandSettings,
} from "@/lib/branding"
import {
  getCurrentOrganizationContext,
  type OrganizationContext,
} from "@/lib/services/organizationContext"
import { loadOrganizationSettings } from "@/lib/services/organizationSettings"

type OrganizationContextValue = {
  organization: OrganizationContext | null
  organizationId: string | null
  role: OrganizationContext["role"] | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const OrganizationContextReact =
  createContext<OrganizationContextValue | undefined>(undefined)

export function OrganizationProvider({
  children,
}: PropsWithChildren) {
  const { session, loading: authLoading } = useAuth()

  const [organization, setOrganization] =
    useState<OrganizationContext | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (!session) {
      setOrganization(null)
      setError(null)
      saveBrandSettings(defaultBrandSettings)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const context = await getCurrentOrganizationContext()
      setOrganization(context)

      const settings = await loadOrganizationSettings()
      saveBrandSettings(settings)
    } catch (caught) {
      setOrganization(null)
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load organization access.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    void refresh()
  }, [session?.user.id, authLoading])

  const value = useMemo(
    () => ({
      organization,
      organizationId: organization?.organizationId ?? null,
      role: organization?.role ?? null,
      loading,
      error,
      refresh,
    }),
    [organization, loading, error],
  )

  return (
    <OrganizationContextReact.Provider value={value}>
      {children}
    </OrganizationContextReact.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContextReact)

  if (!context) {
    throw new Error(
      "useOrganization must be used inside OrganizationProvider",
    )
  }

  return context
}
