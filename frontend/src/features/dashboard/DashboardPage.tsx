import {
  CalendarDays,
  ClipboardList,
  Target,
  Trophy,
  Users,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { Button } from "@/components/ui/button"

const statistics = [
  {
    label: "Upcoming Shoots",
    value: "0",
    icon: Target,
  },
  {
    label: "Active Participants",
    value: "0",
    icon: Users,
  },
  {
    label: "Open Registrations",
    value: "0",
    icon: ClipboardList,
  },
  {
    label: "Scores Entered",
    value: "0",
    icon: Trophy,
  },
]

export function DashboardPage() {
  return (
    <div className="min-h-screen">
      <AppHeader
        title="Dashboard"
        description="Welcome back to ClayKeeper"
      />

      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-sm md:p-8">
          <p className="text-sm font-medium text-emerald-400">
            ClayKeeper Foundation
          </p>

          <h3 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
            Shooting event management, organized.
          </h3>

          <p className="mt-3 max-w-2xl text-slate-300">
            Manage participants, shoots, registration, squads, scoring,
            payments, and reports from one application.
          </p>

          <Button className="mt-6">
            <Target className="h-4 w-4" />
            Create first shoot
          </Button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statistics.map((statistic) => {
            const Icon = statistic.icon

            return (
              <article
                key={statistic.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {statistic.label}
                    </p>

                    <p className="mt-2 text-3xl font-bold">
                      {statistic.value}
                    </p>
                  </div>

                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-emerald-600" />

              <h3 className="text-lg font-semibold">
                Upcoming shoots
              </h3>
            </div>

            <div className="mt-8 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
              <p className="font-medium text-slate-700">
                No upcoming shoots
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create your first shoot to begin scheduling events.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-emerald-600" />

              <h3 className="text-lg font-semibold">
                Recent activity
              </h3>
            </div>

            <div className="mt-8 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
              <p className="font-medium text-slate-700">
                No activity yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                New registrations, payments, and scores will appear here.
              </p>
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}