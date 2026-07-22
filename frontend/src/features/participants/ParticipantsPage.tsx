import { Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder"
import { PageContainer } from "@/components/layout/PageContainer"

export function ParticipantsPage() {
  return (
    <div className="min-h-screen">
      <AppHeader
        title="Participants"
        description="Manage members and event participants"
      />

      <PageContainer>
        <ModulePlaceholder
          title="Participant Management"
          description="Add, edit, search, categorize, and assign participants to teams."
          icon={Users}
        />
      </PageContainer>
    </div>
  )
}