import { createContext, useContext } from "react"

type MobileNavigationContextValue = {
  openMobileNavigation: () => void
  closeMobileNavigation: () => void
}

export const MobileNavigationContext =
  createContext<MobileNavigationContextValue | null>(null)

export function useMobileNavigation() {
  const context = useContext(MobileNavigationContext)

  if (!context) {
    throw new Error(
      "useMobileNavigation must be used within MobileNavigationContext.Provider",
    )
  }

  return context
}
