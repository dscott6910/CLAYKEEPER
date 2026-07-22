import { Target } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder"
import { PageContainer } from "@/components/layout/PageContainer"

export function SquadsPage() {
  return (
    <div className="min-h-screen">
      <AppHeader
        title="Squadding"
        description="Build squads and assign participants to houses, stations, and posts"
      />

      <PageContainer>
        <ModulePlaceholder
          title="Squad Builder"
          description="Organize participants by team and category, assign squad numbers, and manage shooting positions."
          icon={Target}
        />
      </PageContainer>
    </div>
  )
}