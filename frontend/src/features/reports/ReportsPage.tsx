import { BarChart3 } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder"
import { PageContainer } from "@/components/layout/PageContainer"

export function ReportsPage() {
  return (
    <div className="min-h-screen">
      <AppHeader
        title="Reports"
        description="View competition results, standings, budgets, and bookkeeping"
      />

      <PageContainer>
        <ModulePlaceholder
          title="Reports and Results"
          description="Generate individual, squad, team, category, financial, and bookkeeping reports."
          icon={BarChart3}
        />
      </PageContainer>
    </div>
  )
}