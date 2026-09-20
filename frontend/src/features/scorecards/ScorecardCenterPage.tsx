import { useCallback, useEffect, useMemo, useState } from "react"
import { jsPDF } from "jspdf"
import QRCode from "qrcode"
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadScorecardCenterData,
  type ScorecardCenterData,
  type ScorecardCourse,
  type ScorecardRegistration,
} from "@/lib/services/scorecardCenter"

type PrintMode = "event" | "team" | "squad" | "athlete" | "generic"
type WizardStep = 1 | 2 | 3 | 4 | 5
const SCORECARD_BIRD_COLUMNS = 20
// At the printed 2.55-inch size this provides roughly 118 DPI and about five
// source pixels per QR module for the longest scoring URLs. Keeping this
// compact is important: a full-event print embeds one unique QR per card.
const SCORECARD_QR_SIZE_PX = 300

type PrintableCard = {
  registration: ScorecardRegistration
  memberId: string
  shootId: string
  athleteName: string
  teamName: string
  squadNumber: string
  postLabel: string
  shootName: string
  courseName: string
}

type PrintableStation = {
  station_number: number
  bird_count: number
}

const STEPS: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: "Course" },
  { step: 2, label: "Shoot" },
  { step: 3, label: "Print Mode" },
  { step: 4, label: "Preview" },
  { step: 5, label: "Generate" },
]

function athleteName(
  athlete: ScorecardCenterData["athletes"][number] | undefined,
) {
  if (!athlete) return "Unknown Participant"
  const first =
    athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim()
}

function formatDate(value: string | null) {
  if (!value) return "Date not set"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

export function ScorecardCenterPage() {
  const { eventId } = useParams()
  const [data, setData] = useState<ScorecardCenterData | null>(null)
  const [step, setStep] = useState<WizardStep>(1)
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [selectedShootId, setSelectedShootId] = useState("")
  const [printMode, setPrintMode] = useState<PrintMode>("event")
  const [teamFilter, setTeamFilter] = useState("")
  const [squadFilter, setSquadFilter] = useState("")
  const [athleteFilter, setAthleteFilter] = useState("")
  const [genericCardCount, setGenericCardCount] = useState(2)
  const [genericStationCount, setGenericStationCount] = useState(10)
  const [genericBirdCount, setGenericBirdCount] = useState(10)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError("")
    try {
      const next = await loadScorecardCenterData(eventId)
      setData(next)
      setSelectedCourseId((current) =>
        current && next.courses.some((course) => course.id === current)
          ? current
          : (next.courses[0]?.id ?? ""),
      )
      setSelectedShootId((current) =>
        current && next.shoots.some((shoot) => shoot.id === current)
          ? current
          : (next.shoots[0]?.id ?? ""),
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the Scorecard Center.",
      )
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const selectedCourse = useMemo(
    () =>
      data?.courses.find((course) => course.id === selectedCourseId) ?? null,
    [data?.courses, selectedCourseId],
  )

  const selectedShoot = useMemo(
    () => data?.shoots.find((shoot) => shoot.id === selectedShootId) ?? null,
    [data?.shoots, selectedShootId],
  )

  const allCards = useMemo<PrintableCard[]>(() => {
    if (!data || !selectedShootId) return []

    const athleteMap = new Map(data.athletes.map((row) => [row.id, row]))
    const teamMap = new Map(data.teams.map((row) => [row.id, row]))
    const registrationMap = new Map(
      data.registrations.map((row) => [row.id, row]),
    )
    const squadMap = new Map(data.squads.map((row) => [row.id, row]))
    const memberByEnrollment = new Map(
      data.members.map((row) => [row.registration_shoot_id, row]),
    )

    return data.enrollments
      .filter((enrollment) => enrollment.shoot_id === selectedShootId)
      .map((enrollment) => {
        const registration = registrationMap.get(enrollment.registration_id)
        if (!registration) return null
        const member = memberByEnrollment.get(enrollment.id)
        if (!member) return null

        const squad = squadMap.get(member.squad_id)

        return {
          registration,
          memberId: member.id,
          shootId: selectedShootId,
          athleteName: athleteName(athleteMap.get(registration.athlete_id)),
          teamName: registration.team_id
            ? (teamMap.get(registration.team_id)?.name ?? "Unassigned")
            : "Unassigned",
          squadNumber: squad?.squad_number ?? "",
          postLabel:
            member?.position_label ?? (member ? `Post ${member.position}` : ""),
          shootName: selectedShoot?.name ?? "",
          courseName: squad?.course_name ?? "",
        }
      })
      .filter((card): card is PrintableCard => Boolean(card))
      .sort(
        (left, right) =>
          left.teamName.localeCompare(right.teamName) ||
          left.squadNumber.localeCompare(right.squadNumber, undefined, {
            numeric: true,
          }) ||
          left.athleteName.localeCompare(right.athleteName),
      )
  }, [data, selectedShoot?.name, selectedShootId])

  const courseCards = useMemo(() => {
    const selectedCourseName = selectedCourse?.name.trim().toLocaleLowerCase()
    if (!selectedCourseName) return []
    const assignedCards = allCards.filter(
      (card) => card.courseName.trim().toLocaleLowerCase() === selectedCourseName,
    )
    return assignedCards
  }, [allCards, selectedCourse?.name])

  const hasCourseAssignments = useMemo(
    () => allCards.some((card) => card.courseName.trim()),
    [allCards],
  )

  const availableTeams = useMemo(() => {
    if (!data) return []
    const ids = new Set(courseCards.map((card) => card.registration.team_id))
    return data.teams.filter((team) => ids.has(team.id))
  }, [courseCards, data])

  const availableSquads = useMemo(
    () =>
      Array.from(
        new Set(courseCards.map((card) => card.squadNumber).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [courseCards],
  )

  const cards = useMemo(() => {
    switch (printMode) {
      case "generic":
        return []
      case "team":
        return courseCards.filter(
          (card) => card.registration.team_id === teamFilter,
        )
      case "squad":
        return courseCards.filter((card) => card.squadNumber === squadFilter)
      case "athlete":
        return courseCards.filter(
          (card) => card.registration.athlete_id === athleteFilter,
        )
      default:
        return courseCards
    }
  }, [athleteFilter, courseCards, printMode, squadFilter, teamFilter])

  const genericStations = useMemo<PrintableStation[]>(
    () =>
      Array.from({ length: genericStationCount }, (_, index) => ({
        station_number: index + 1,
        bird_count: genericBirdCount,
      })),
    [genericBirdCount, genericStationCount],
  )

  function choosePrintMode(mode: PrintMode) {
    setPrintMode(mode)
    setTeamFilter("")
    setSquadFilter("")
    setAthleteFilter("")
  }

  function canContinue(currentStep: WizardStep) {
    if (currentStep === 1) return Boolean(selectedCourseId)
    if (currentStep === 2) return Boolean(selectedShootId)
    if (currentStep === 3) {
      if (printMode === "team") return Boolean(teamFilter)
      if (printMode === "squad") return Boolean(squadFilter)
      if (printMode === "athlete") return Boolean(athleteFilter)
      if (printMode === "generic") return genericCardCount > 0
      return true
    }
    if (printMode === "generic") return genericCardCount > 0
    return cards.length > 0
  }

  function nextStep() {
    if (!canContinue(step)) {
      setError("Complete this step before continuing.")
      return
    }
    setError("")
    setStep((current) => Math.min(5, current + 1) as WizardStep)
  }

  function previousStep() {
    setError("")
    setStep((current) => Math.max(1, current - 1) as WizardStep)
  }

  async function createPdf() {
    if (!data || !selectedCourse || !selectedShoot) {
      setError("Select a course and shoot before generating scorecards.")
      return
    }
    if (printMode !== "generic" && cards.length === 0) {
      setError("No eligible participants match the selected print mode.")
      return
    }

    setGenerating(true)
    setError("")

    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "in",
        format: "letter",
      })

      const stations =
        printMode === "generic"
          ? genericStations
          : data.stations
              .filter((station) => station.course_id === selectedCourse.id)
              .sort((a, b) => a.station_number - b.station_number)

      const totalCards =
        printMode === "generic" ? genericCardCount : cards.length

      for (let index = 0; index < totalCards; index += 1) {
        const slot = index % 2
        if (index > 0 && slot === 0) pdf.addPage("letter", "landscape")
        if (slot === 0) drawCutLine(pdf)

        await drawScorecard(
          pdf,
          slot === 0 ? 0 : 5.5,
          0,
          data,
          selectedCourse,
          stations,
          printMode === "generic" ? null : cards[index],
          selectedShoot.name,
        )
      }

      const scope =
        printMode === "event"
          ? "all"
          : printMode === "team"
            ? `team-${teamFilter}`
            : printMode === "squad"
              ? `squad-${squadFilter}`
              : printMode === "athlete"
                ? `athlete-${athleteFilter}`
                : "generic"

      pdf.save(
        `${data.event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${scope}-scorecards.pdf`,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The scorecard PDF could not be created.",
      )
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading Scorecard Center…
        </div>
      </PageContainer>
    )
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="rounded-xl border p-6">
          Scorecard data is unavailable.
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Event Workspace
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                Scorecard Print Wizard
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">
                {data.event.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Select the course, shoot, and print group before creating the
                final two-up landscape PDF.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={generating}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </header>

        <WizardProgress currentStep={step} />

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          {step === 1 ? (
            <StepCourse
              courses={data.courses}
              selectedCourseId={selectedCourseId}
              setSelectedCourseId={setSelectedCourseId}
            />
          ) : null}

          {step === 2 ? (
            <StepShoot
              shoots={data.shoots}
              selectedShootId={selectedShootId}
              setSelectedShootId={setSelectedShootId}
            />
          ) : null}

          {step === 3 ? (
            <StepPrintMode
              mode={printMode}
              chooseMode={choosePrintMode}
              teams={availableTeams}
              teamFilter={teamFilter}
              setTeamFilter={setTeamFilter}
              squads={availableSquads}
              squadFilter={squadFilter}
              setSquadFilter={setSquadFilter}
              cards={courseCards}
              selectedCourseName={selectedCourse?.name ?? ""}
              hasCourseAssignments={hasCourseAssignments}
              athleteFilter={athleteFilter}
              setAthleteFilter={setAthleteFilter}
              genericCardCount={genericCardCount}
              setGenericCardCount={setGenericCardCount}
              genericStationCount={genericStationCount}
              setGenericStationCount={setGenericStationCount}
              genericBirdCount={genericBirdCount}
              setGenericBirdCount={setGenericBirdCount}
            />
          ) : null}

          {step === 4 ? (
            <StepPreview
              cards={cards}
              printMode={printMode}
              genericCardCount={genericCardCount}
              course={selectedCourse}
              shootName={selectedShoot?.name ?? ""}
              genericStationCount={genericStationCount}
              genericBirdCount={genericBirdCount}
            />
          ) : null}

          {step === 5 ? (
            <StepGenerate
              count={printMode === "generic" ? genericCardCount : cards.length}
              generic={printMode === "generic"}
              courseName={selectedCourse?.name ?? ""}
              shootName={selectedShoot?.name ?? ""}
              generating={generating}
              createPdf={createPdf}
            />
          ) : null}

          <div className="mt-6 flex items-center justify-between border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={previousStep}
              disabled={step === 1 || generating}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {step < 5 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canContinue(step) || generating}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={generating}
              >
                Start Over
              </Button>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  )
}

function WizardProgress({ currentStep }: { currentStep: WizardStep }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {STEPS.map((item) => {
        const complete = item.step < currentStep
        const active = item.step === currentStep
        return (
          <li
            key={item.step}
            className={`rounded-xl border p-3 text-sm font-semibold ${
              active
                ? "border-slate-950 bg-slate-950 text-white"
                : complete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "bg-white text-slate-500"
            }`}
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs">
              {complete ? <Check className="h-3.5 w-3.5" /> : item.step}
            </span>
            {item.label}
          </li>
        )
      })}
    </ol>
  )
}

function StepCourse(props: {
  courses: ScorecardCenterData["courses"]
  selectedCourseId: string
  setSelectedCourseId: (value: string) => void
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">1. Select Course</h2>
      <p className="mt-1 text-sm text-slate-500">
        The saved station and bird layout will be printed on every card.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {props.courses.map((course) => (
          <button
            key={course.id}
            type="button"
            onClick={() => props.setSelectedCourseId(course.id)}
            className={`rounded-xl border p-4 text-left ${
              props.selectedCourseId === course.id
                ? "border-slate-950 bg-slate-950 text-white"
                : "hover:bg-slate-50"
            }`}
          >
            <p className="font-bold">{course.name}</p>
            <p className="mt-1 text-sm opacity-75">
              {course.discipline.replaceAll("_", " ")}
            </p>
          </button>
        ))}
      </div>
      {props.courses.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          Build and save a course before generating scorecards.
        </p>
      ) : null}
    </div>
  )
}

function StepShoot(props: {
  shoots: ScorecardCenterData["shoots"]
  selectedShootId: string
  setSelectedShootId: (value: string) => void
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">2. Select Shoot</h2>
      <p className="mt-1 text-sm text-slate-500">
        Only participants entered in this shoot will be included.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {props.shoots.map((shoot) => (
          <button
            key={shoot.id}
            type="button"
            onClick={() => props.setSelectedShootId(shoot.id)}
            className={`rounded-xl border p-4 text-left ${
              props.selectedShootId === shoot.id
                ? "border-slate-950 bg-slate-950 text-white"
                : "hover:bg-slate-50"
            }`}
          >
            <p className="font-bold">{shoot.name}</p>
            <p className="mt-1 text-sm opacity-75">
              {shoot.discipline.replaceAll("_", " ")}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepPrintMode(props: {
  mode: PrintMode
  chooseMode: (mode: PrintMode) => void
  teams: ScorecardCenterData["teams"]
  teamFilter: string
  setTeamFilter: (value: string) => void
  squads: string[]
  squadFilter: string
  setSquadFilter: (value: string) => void
  cards: PrintableCard[]
  selectedCourseName: string
  hasCourseAssignments: boolean
  athleteFilter: string
  setAthleteFilter: (value: string) => void
  genericCardCount: number
  setGenericCardCount: (value: number) => void
  genericStationCount: number
  setGenericStationCount: (value: number) => void
  genericBirdCount: number
  setGenericBirdCount: (value: number) => void
}) {
  const options: Array<{ value: PrintMode; title: string; detail: string }> = [
    {
      value: "event",
      title: "Entire Shoot",
      detail: "Print every participant assigned to the selected course",
    },
    { value: "team", title: "One Team", detail: "Print one selected team" },
    { value: "squad", title: "One Squad", detail: "Print one selected squad" },
    {
      value: "athlete",
      title: "One Participant",
      detail: "Print or reprint one card",
    },
    {
      value: "generic",
      title: "Generic Blank Cards",
      detail: "Print cards without assigned shooters",
    },
  ]
  return (
    <div>
      <h2 className="text-xl font-bold">3. Choose Print Mode</h2>
      <p className="mt-1 text-sm text-slate-500">
        {props.hasCourseAssignments
          ? `Participant cards are limited to squads assigned to Course ${props.selectedCourseName || "not selected"}.`
          : "No squads have a scorecard course assignment yet. Assign each squad to a course in Squadding before printing."}
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => props.chooseMode(option.value)}
            className={`rounded-xl border p-4 text-left ${
              props.mode === option.value
                ? "border-slate-950 bg-slate-950 text-white"
                : "hover:bg-slate-50"
            }`}
          >
            <p className="font-bold">{option.title}</p>
            <p className="mt-1 text-sm opacity-75">{option.detail}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 max-w-xl">
        {props.mode === "team" ? (
          <select
            value={props.teamFilter}
            onChange={(e) => props.setTeamFilter(e.target.value)}
            className="min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Select a team</option>
            {props.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        ) : null}
        {props.mode === "squad" ? (
          <select
            value={props.squadFilter}
            onChange={(e) => props.setSquadFilter(e.target.value)}
            className="min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Select a squad</option>
            {props.squads.map((squad) => (
              <option key={squad} value={squad}>
                Squad {squad}
              </option>
            ))}
          </select>
        ) : null}
        {props.mode === "athlete" ? (
          <select
            value={props.athleteFilter}
            onChange={(e) => props.setAthleteFilter(e.target.value)}
            className="min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Select a participant</option>
            {props.cards.map((card) => (
              <option
                key={card.registration.id}
                value={card.registration.athlete_id}
              >
                {card.athleteName} · {card.teamName}
              </option>
            ))}
          </select>
        ) : null}
        {props.mode === "generic" ? (
          <div className="grid gap-4 rounded-xl border bg-slate-50 p-4 sm:grid-cols-3">
            <NumberField
              label="Number of cards"
              value={props.genericCardCount}
              min={1}
              max={200}
              onChange={props.setGenericCardCount}
            />
            <NumberField
              label="Stations per card"
              value={props.genericStationCount}
              min={1}
              max={15}
              onChange={props.setGenericStationCount}
            />
            <NumberField
              label="Birds per station"
              value={props.genericBirdCount}
              min={1}
              max={20}
              onChange={props.setGenericBirdCount}
            />
            <p className="sm:col-span-3 text-xs leading-5 text-slate-500">
              Generic cards use this layout instead of the saved course. They
              include the selected event and shoot details, but leave the
              participant fields blank and do not include a QR code.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StepPreview(props: {
  cards: PrintableCard[]
  printMode: PrintMode
  genericCardCount: number
  course: ScorecardCourse | null
  shootName: string
  genericStationCount: number
  genericBirdCount: number
}) {
  const generic = props.printMode === "generic"

  return (
    <div>
      <h2 className="text-xl font-bold">4. Preview Print Queue</h2>
      <p className="mt-1 text-sm text-slate-500">
        {generic ? props.genericCardCount : props.cards.length} scorecard
        {(generic ? props.genericCardCount : props.cards.length) === 1
          ? ""
          : "s"}{" "}
        ·{" "}
        {generic
          ? `${props.genericStationCount} stations · ${props.genericBirdCount} birds each`
          : (props.course?.name ?? "No course")}{" "}
        · {props.shootName}
      </p>
      <div className="mt-5 max-h-[520px] divide-y overflow-y-auto rounded-xl border">
        {generic ? (
          <div className="grid gap-2 p-4 text-sm sm:grid-cols-5">
            <span className="font-semibold">Generic scorecard</span>
            <span>{props.genericStationCount} stations</span>
            <span>{props.genericBirdCount} birds each</span>
            <span>Participant fields blank</span>
            <span className="text-slate-500">{props.shootName}</span>
          </div>
        ) : null}
        {!generic
          ? props.cards.slice(0, 200).map((card) => (
              <div
                key={card.registration.id}
                className="grid gap-2 p-4 text-sm sm:grid-cols-5"
              >
                <span className="font-semibold">{card.athleteName}</span>
                <span>{card.teamName}</span>
                <span>
                  {card.squadNumber ? `Squad ${card.squadNumber}` : "No squad"}
                </span>
                <span>{card.postLabel || "No post"}</span>
                <span className="text-slate-500">{card.shootName}</span>
              </div>
            ))
          : null}
        {!generic && props.cards.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No scorecards are available for this selection.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function NumberField(props: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <input
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(event) =>
          props.onChange(
            Math.max(
              props.min,
              Math.min(props.max, Number(event.target.value) || props.min),
            ),
          )
        }
        className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
      />
    </label>
  )
}

function StepGenerate(props: {
  count: number
  generic: boolean
  courseName: string
  shootName: string
  generating: boolean
  createPdf: () => Promise<void>
}) {
  return (
    <div className="py-6 text-center">
      <FileDown className="mx-auto h-12 w-12 text-emerald-600" />
      <h2 className="mt-4 text-2xl font-bold">5. Generate Scorecards</h2>
      <p className="mt-2 text-slate-500">
        {props.count} {props.generic ? "generic " : ""}cards ·{" "}
        {Math.ceil(props.count / 2)} landscape pages
        <br />
        {props.courseName} · {props.shootName}
      </p>
      <Button
        className="mt-6"
        onClick={() => void props.createPdf()}
        disabled={props.generating || props.count === 0}
      >
        {props.generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        Generate PDF
      </Button>
    </div>
  )
}

function drawCutLine(pdf: jsPDF) {
  const centerX = 5.5

  pdf.setDrawColor(45)
  pdf.setLineWidth(0.014)
  pdf.setLineDashPattern([0.1, 0.045], 0)
  pdf.line(centerX, 0.18, centerX, 8.32)
  pdf.setLineDashPattern([], 0)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(12)
  pdf.text("✂", centerX, 0.13, { align: "center" })
  pdf.text("✂", centerX, 8.46, { align: "center" })
}

async function drawScorecard(
  pdf: jsPDF,
  x: number,
  y: number,
  data: ScorecardCenterData,
  course: ScorecardCourse,
  stations: PrintableStation[],
  card: PrintableCard | null,
  shootName: string,
) {
  const width = 5.5
  const margin = 0.3
  // Keep every grid/marker coordinate affine-equivalent to existing printed cards.
  const gridScaleX = (width - margin * 2) / (width - 0.16 * 2)
  const gridScaleY = 0.86

  pdf.setDrawColor(20)
  pdf.setLineWidth(0.012)

  pdf.setFont("helvetica", "bold")
  const scorecardTitle = data.event.name
  const scorecardTitleWidth = width - margin * 2
  let scorecardTitleSize = 11.2
  pdf.setFontSize(scorecardTitleSize)
  while (
    scorecardTitleSize > 9 &&
    pdf.getTextWidth(scorecardTitle) > scorecardTitleWidth
  ) {
    scorecardTitleSize -= 0.2
    pdf.setFontSize(scorecardTitleSize)
  }
  pdf.text(scorecardTitle, x + width / 2, y + 0.3, { align: "center" })
  pdf.setFontSize(8.8)
  pdf.setFont("helvetica", "normal")
  pdf.text(
    `${formatDate(data.event.start_date)}  |  ${
      data.event.location_name ?? "Location not set"
    }`,
    x + margin,
    y + 0.5,
    { maxWidth: scorecardTitleWidth },
  )
  pdf.text(
    `Host: ${data.event.host_sponsor ?? data.event.sponsor_name ?? "Not set"}`,
    x + margin,
    y + 0.68,
    { maxWidth: scorecardTitleWidth },
  )
  pdf.text(`Course: ${course.name}`, x + margin, y + 0.86, {
    maxWidth: scorecardTitleWidth,
  })
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(9.4)
  const instructionX = x + margin
  const instructionY = y + 0.94
  const instructionW = width - margin * 2
  const instructionH = 0.34
  pdf.setFillColor("#000000")
  pdf.rect(instructionX, instructionY, instructionW, instructionH, "F")
  pdf.setTextColor("#ffffff")
  pdf.text("INSTRUCTIONS: DEAD = BUBBLE FILL", x + width / 2, y + 1.09, {
    align: "center",
  })
  pdf.text("LOSS = BUBBLE EMPTY", x + width / 2, y + 1.27, {
    align: "center",
  })
  pdf.setTextColor("#141414")

  if (!card) {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text("GENERIC", x + width - 0.82, y + 0.28, {
      align: "center",
    })
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(5.4)
    pdf.text("No assigned shooter", x + width - 0.82, y + 0.44, {
      align: "center",
    })
  }

  const tableX = x + margin
  const tableY = y + 1.34
  const rowH = 0.34 * gridScaleY
  const stationW = 0.62 * gridScaleX
  const totalW = 0.68 * gridScaleX
  const runningW = 0.62 * gridScaleX
  const activeStations = stations.filter((station) => station.bird_count > 0)
  const printableStations =
    activeStations.length > 0 ? activeStations : stations.slice(0, 1)
  const birdColumns = Math.min(
    SCORECARD_BIRD_COLUMNS,
    Math.max(1, ...printableStations.map((station) => station.bird_count)),
  )
  const birdW =
    (width - margin * 2 - stationW - totalW - runningW) / birdColumns
  const tableW = stationW + birdW * birdColumns + totalW + runningW

  pdf.setFont("helvetica", "bold")
  pdf.rect(tableX, tableY, tableW, rowH)
  pdf.setFontSize(6.5)
  pdf.text("STATION", tableX + stationW / 2, tableY + 0.22, {
    align: "center",
  })
  for (let bird = 1; bird <= birdColumns; bird += 2) {
    const pairBirds = Math.min(2, birdColumns - bird + 1)
    pdf.rect(
      tableX + stationW + (bird - 1) * birdW,
      tableY,
      birdW * pairBirds,
      rowH,
    )
  }
  pdf.setFontSize(7.4)
  for (let bird = 1; bird <= birdColumns; bird += 1) {
    pdf.text(
      String(bird),
      tableX + stationW + (bird - 1) * birdW + birdW / 2,
      tableY + 0.21,
      { align: "center" },
    )
  }
  const stationTotalX = tableX + stationW + birdW * birdColumns
  pdf.rect(stationTotalX, tableY, totalW, rowH)
  pdf.rect(stationTotalX + totalW, tableY, runningW, rowH)
  pdf.setFontSize(5.9)
  pdf.text("STATION", stationTotalX + totalW / 2, tableY + 0.16, {
    align: "center",
  })
  pdf.text("SCORE", stationTotalX + totalW / 2, tableY + 0.27, {
    align: "center",
  })
  pdf.text("RUN", stationTotalX + totalW + runningW / 2, tableY + 0.16, {
    align: "center",
  })
  pdf.text("SCORE", stationTotalX + totalW + runningW / 2, tableY + 0.27, {
    align: "center",
  })

  for (const [row, station] of printableStations.entries()) {
    const stationNumber = station.station_number
    const birdCount = station.bird_count
    const rowY = tableY + rowH * (row + 1)

    pdf.rect(tableX, rowY, tableW, rowH)
    pdf.setFontSize(7.4)
    pdf.text(String(stationNumber), tableX + stationW / 2, rowY + 0.22, {
      align: "center",
    })

    for (let bird = 1; bird <= birdColumns; bird += 2) {
      const pairBirds = Math.min(2, birdColumns - bird + 1)
      pdf.rect(
        tableX + stationW + (bird - 1) * birdW,
        rowY,
        birdW * pairBirds,
        rowH,
      )
    }

    for (let bird = 1; bird <= birdColumns; bird += 1) {
      const cellX = tableX + stationW + (bird - 1) * birdW
      if (bird <= birdCount) {
        pdf.ellipse(
          cellX + birdW / 2,
          rowY + rowH / 2,
          0.08 * gridScaleX,
          0.08 * gridScaleY,
        )
      }
    }

    pdf.rect(stationTotalX, rowY, totalW, rowH)
    pdf.rect(stationTotalX + totalW, rowY, runningW, rowH)
  }

  const subtotalY = tableY + rowH * (printableStations.length + 1)
  const totalRowH = rowH * 1.35
  pdf.rect(tableX, subtotalY, tableW, totalRowH)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("SUB", tableX + 0.44, subtotalY + totalRowH * 0.38, {
    align: "center",
  })
  pdf.text("TOTAL", tableX + 0.44, subtotalY + totalRowH * 0.78, {
    align: "center",
  })
  pdf.rect(stationTotalX, subtotalY, totalW, totalRowH)
  pdf.rect(stationTotalX + totalW, subtotalY, runningW, totalRowH)
  pdf.text("GRAND", stationTotalX + totalW / 2, subtotalY + totalRowH * 0.38, {
    align: "center",
  })
  pdf.text("TOTAL", stationTotalX + totalW / 2, subtotalY + totalRowH * 0.78, {
    align: "center",
  })

  const footerY = subtotalY + totalRowH + 0.18 * gridScaleY
  pdf.setFontSize(7.6)
  pdf.setFont("helvetica", "bold")
  pdf.text("MALFUNCTIONS", tableX + 0.34, footerY)
  for (let i = 0; i < 3; i += 1) {
    pdf.rect(tableX + 1.21 + i * 0.24, footerY - 0.13, 0.18, 0.18)
  }
  pdf.line(
    stationTotalX + totalW + 0.05,
    footerY + 0.13,
    stationTotalX + totalW + runningW - 0.05,
    footerY + 0.13,
  )

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7.1)
  pdf.text(
    "Verified by:  #1____________  #2____________",
    tableX,
    footerY + 0.34,
  )
  pdf.text("Entered by:________________", tableX, footerY + 0.52)

  const participantLabel = card?.athleteName ?? "____________________________"
  const teamLabel = card?.teamName ?? "________________"
  const shootLabel = card?.shootName ?? shootName
  const squadLabel = card?.squadNumber || "____"
  const postLabel = card?.postLabel?.replace(/^Post\s*/i, "") || "____"

  const qrY = footerY + 0.22
  const qrSize = card ? Math.min(1.8, 8.2 - qrY) : 0
  const qrX = x + width - qrSize - margin
  const identityWidth = qrX - tableX - 0.14

  function drawIdentityLine(
    label: string,
    value: string,
    yPosition: number,
    preferredSize: number,
  ) {
    const text = `${label}: ${value}`
    let fontSize = preferredSize
    pdf.setFontSize(fontSize)
    while (fontSize > 10.5 && pdf.getTextWidth(text) > identityWidth) {
      fontSize -= 0.2
      pdf.setFontSize(fontSize)
    }
    const lines = pdf.splitTextToSize(text, identityWidth)
    pdf.text(lines, tableX, yPosition, { lineHeightFactor: 1.45 })
    return yPosition + (lines.length * fontSize * 1.45) / 72 + 0.1
  }

  pdf.setFont("helvetica", "bold")
  let identityY = footerY + 0.86
  identityY = drawIdentityLine("Shoot", shootLabel, identityY, 12.8)
  identityY = drawIdentityLine("Participant", participantLabel, identityY, 12.8)
  identityY = drawIdentityLine("Team", teamLabel, identityY, 12.8)
  pdf.setFontSize(12.8)
  pdf.text(`Squad: ${squadLabel}`, tableX, identityY)
  pdf.text(`Post: ${postLabel}`, tableX + 1.5, identityY)

  if (card) {
    const scoringUrl = new URL(
      `/events/${data.event.id}/digital-scoring`,
      window.location.origin,
    )

    scoringUrl.searchParams.set("shootId", card.shootId)
    scoringUrl.searchParams.set("memberId", card.memberId)
    scoringUrl.searchParams.set("courseId", course.id)

    const qr = await QRCode.toDataURL(scoringUrl.toString(), {
      margin: 2,
      width: SCORECARD_QR_SIZE_PX,
      errorCorrectionLevel: "M",
    })
    pdf.addImage(qr, "PNG", qrX, qrY, qrSize, qrSize)
  }
}
