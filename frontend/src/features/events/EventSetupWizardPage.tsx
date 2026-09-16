import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileDown,
  Map,
  Target,
  Users,
  UserPlus,
} from "lucide-react"

import { PageContainer } from "@/components/layout/PageContainer"
import { getEventWorkspace } from "@/lib/services/eventWorkspace"
import { loadCourseBuilderData } from "@/lib/services/courseBuilder"

type SetupState = {
  eventName: string
  shoots: number
  registrations: number
  courses: number
  configuredCourses: number
}

const emptyState: SetupState = {
  eventName: "Event setup",
  shoots: 0,
  registrations: 0,
  courses: 0,
  configuredCourses: 0,
}

export function EventSetupWizardPage() {
  const { eventId } = useParams()
  const [setup, setSetup] = useState<SetupState>(emptyState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError("")
    try {
      const [workspace, courseData] = await Promise.all([
        getEventWorkspace(eventId),
        loadCourseBuilderData(eventId),
      ])
      const configuredCourses = courseData.courses.filter((course) =>
        courseData.stations.some((station) => station.course_id === course.id && station.bird_count > 0),
      ).length
      setSetup({
        eventName: workspace.event.name,
        shoots: workspace.shoots.length,
        registrations: workspace.registrations.length,
        courses: courseData.courses.length,
        configuredCourses,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load event setup.")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])

  const steps = useMemo(() => {
    if (!eventId) return []
    return [
      {
        title: "Event details",
        detail: "Review the date, venue, discipline, registration window, and fees.",
        done: true,
        href: `/events/${eventId}`,
        action: "Review event",
        icon: ClipboardList,
      },
      {
        title: "Create shoots",
        detail: setup.shoots ? `${setup.shoots} shoot${setup.shoots === 1 ? "" : "s"} configured.` : "Add the first competition shoot, format, targets, and squad size.",
        done: setup.shoots > 0,
        href: `/events/${eventId}/shoots`,
        action: setup.shoots ? "Manage shoots" : "Add shoot",
        icon: Target,
      },
      {
        title: "Build the course",
        detail: setup.configuredCourses ? `${setup.configuredCourses} course${setup.configuredCourses === 1 ? "" : "s"} has active station birds.` : "Set stations and birds for the scorecard layout.",
        done: setup.configuredCourses > 0,
        href: `/events/${eventId}/course`,
        action: setup.courses ? "Configure course" : "Create course",
        icon: Map,
      },
      {
        title: "Add participants",
        detail: setup.registrations ? `${setup.registrations} participant${setup.registrations === 1 ? "" : "s"} registered.` : "Add registrations or import the event roster.",
        done: setup.registrations > 0,
        href: "/registration",
        action: setup.registrations ? "Manage registrations" : "Add participants",
        icon: UserPlus,
      },
      {
        title: "Build squads",
        detail: "Assign registered participants to squads and posts for each shoot.",
        done: false,
        href: "/squads",
        action: "Open squadding",
        icon: Users,
      },
      {
        title: "Create scorecards",
        detail: "Print participant cards or configurable generic scorecards for the selected shoot.",
        done: false,
        href: `/events/${eventId}/scoring`,
        action: "Open scorecards",
        icon: FileDown,
      },
    ]
  }, [eventId, setup])

  if (loading) {
    return <PageContainer><div className="py-16 text-center text-sm text-slate-500">Loading setup wizard...</div></PageContainer>
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="border-b bg-white px-1 pb-6">
          <Link to={`/events/${eventId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> Event workspace
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-emerald-700">Guided Event Setup</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">{setup.eventName}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Complete each setup step in order. You can return here at any time to continue where you left off.</p>
            </div>
            <button type="button" onClick={() => void load()} className="min-h-10 rounded-lg border px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh progress</button>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <section className="border bg-white">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <article key={step.title} className="flex flex-col gap-4 border-b p-5 last:border-b-0 sm:flex-row sm:items-center">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${step.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {step.done ? <CheckCircle2 className="h-5 w-5" /> : <span className="font-bold">{index + 1}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-slate-500" /><h2 className="font-bold text-slate-950">{step.title}</h2></div>
                  <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
                </div>
                <Link to={step.href} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">{step.action}</Link>
              </article>
            )
          })}
        </section>
      </div>
    </PageContainer>
  )
}
