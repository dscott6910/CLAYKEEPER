import { School } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder"
import { PageContainer } from "@/components/layout/PageContainer"

export function TeamsPage() {
  return (
    <div className="min-h-screen">
      <AppHeader
        title="Teams"
        description="Manage teams, coaches, assistants, and divisions"
      />

      <PageContainer>
        <ModulePlaceholder
          title="Team Management"
          description="Create teams, assign categories, and maintain coach and assistant information."
          icon={School}
        />
      </PageContainer>
    </div>
  )
}