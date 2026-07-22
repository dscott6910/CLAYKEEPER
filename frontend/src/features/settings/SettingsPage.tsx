import { Settings } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder"
import { PageContainer } from "@/components/layout/PageContainer"

export function SettingsPage() {
  return (
    <div className="min-h-screen">
      <AppHeader
        title="Settings"
        description="Configure your ClayKeeper organization"
      />

      <PageContainer>
        <ModulePlaceholder
          title="Organization Settings"
          description="Manage organization details, categories, locations, sponsors, users, and application preferences."
          icon={Settings}
        />
      </PageContainer>
    </div>
  )
}