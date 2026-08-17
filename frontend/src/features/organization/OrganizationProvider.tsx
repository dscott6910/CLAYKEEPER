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
  getOrganizationMembershipOptions,
  selectCurrentOrganization,
  type OrganizationContext,
  type OrganizationMembershipOption,
} from "@/lib/services/organizationContext"
import { loadOrganizationSettings } from "@/lib/services/organizationSettings"

type OrganizationContextValue = {
  organization: OrganizationContext | null
  organizationId: string | null
  role: OrganizationContext["role"] | null
  memberships: OrganizationMembershipOption[]
  loading: boolean
  switching: boolean
  error: string | null
  refresh: () => Promise<void>
  switchOrganization: (organizationId: string) => Promise<void>
}

const OrganizationContextReact =
  createContext<OrganizationContextValue | undefined>(undefined)

export function OrganizationProvider({
  children,
}: PropsWithChildren) {
  const { session, loading: authLoading } = useAuth()

  const [organization, setOrganization] =
    useState<OrganizationContext | null>(null)

  const [memberships, setMemberships] =
    useState<OrganizationMembershipOption[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (!session) {
      setOrganization(null)
      setMemberships([])
      setError(null)
      saveBrandSettings(defaultBrandSettings)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [context, availableMemberships] = await Promise.all([
        getCurrentOrganizationContext(),
        getOrganizationMembershipOptions(),
      ])

      setOrganization(context)
      setMemberships(availableMemberships)

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

  async function switchOrganization(
    organizationId: string,
  ) {
    if (
      switching ||
      !organizationId ||
      organizationId === organization?.organizationId
    ) {
      return
    }

    setSwitching(true)
    setError(null)

    try {
      const context =
        await selectCurrentOrganization(organizationId)

      setOrganization(context)

      const availableMemberships =
        await getOrganizationMembershipOptions(context.userId)

      setMemberships(availableMemberships)

      const settings = await loadOrganizationSettings()
      saveBrandSettings(settings)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to switch organizations.",
      )

      throw caught
    } finally {
      setSwitching(false)
    }
  }

  const value = useMemo(
    () => ({
      organization,
      organizationId: organization?.organizationId ?? null,
      role: organization?.role ?? null,
      memberships,
      loading,
      switching,
      error,
      refresh,
      switchOrganization,
    }),
    [
      organization,
      memberships,
      loading,
      switching,
      error,
    ],
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
