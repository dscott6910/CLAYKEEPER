import { Trophy } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder"
import { PageContainer } from "@/components/layout/PageContainer"

export function LiveScoringPage() {
  return (
    <div className="min-h-screen">
      <AppHeader
        title="Live Scoring"
        description="Enter competition scores and manage shoot-offs"
      />

      <PageContainer>
        <ModulePlaceholder
          title="Live Score Entry"
          description="Enter round scores, automatically save progress, manage shoot-offs, and view live standings."
          icon={Trophy}
        />
      </PageContainer>
    </div>
  )
}