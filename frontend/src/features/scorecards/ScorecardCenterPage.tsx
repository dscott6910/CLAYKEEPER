import { useCallback, useEffect, useMemo, useState } from "react"
import { jsPDF } from "jspdf"
import QRCode from "qrcode"
import {
  ArrowLeft,
  FileDown,
  Loader2,
  Printer,
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

type PrintableCard = {
  registration: ScorecardRegistration
  athleteName: string
  teamName: string
  squadNumber: string
  postLabel: string
  shootName: string
}

function athleteName(
  athlete:
    | ScorecardCenterData["athletes"][number]
    | undefined,
) {
  if (!athlete) return "Unknown Athlete"
  const first =
    athlete.preferred_name?.trim() ||
    athlete.first_name?.trim() ||
    ""
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
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [teamFilter, setTeamFilter] = useState("")
  const [squadFilter, setSquadFilter] = useState("")
  const [athleteFilter, setAthleteFilter] = useState("")
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
          : next.courses[0]?.id ?? "",
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
      data?.courses.find((course) => course.id === selectedCourseId) ??
      null,
    [data?.courses, selectedCourseId],
  )

  const cards = useMemo<PrintableCard[]>(() => {
    if (!data) return []

    const athleteMap = new Map(data.athletes.map((row) => [row.id, row]))
    const teamMap = new Map(data.teams.map((row) => [row.id, row]))
    const shootMap = new Map(data.shoots.map((row) => [row.id, row]))
    const enrollmentByRegistration = new Map<string, typeof data.enrollments>()

    for (const enrollment of data.enrollments) {
      const rows = enrollmentByRegistration.get(enrollment.registration_id) ?? []
      rows.push(enrollment)
      enrollmentByRegistration.set(enrollment.registration_id, rows)
    }

    const memberByEnrollment = new Map(
      data.members.map((row) => [row.registration_shoot_id, row]),
    )
    const squadMap = new Map(data.squads.map((row) => [row.id, row]))

    return data.registrations
      .map((registration) => {
        const enrollments =
          enrollmentByRegistration.get(registration.id) ?? []
        const enrollment = enrollments[0]
        const member = enrollment
          ? memberByEnrollment.get(enrollment.id)
          : undefined
        const squad = member ? squadMap.get(member.squad_id) : undefined
        const shoot = enrollment
          ? shootMap.get(enrollment.shoot_id)
          : undefined

        return {
          registration,
          athleteName: athleteName(
            athleteMap.get(registration.athlete_id),
          ),
          teamName: registration.team_id
            ? teamMap.get(registration.team_id)?.name ?? "Unassigned"
            : "Unassigned",
          squadNumber: squad?.squad_number ?? "",
          postLabel:
            member?.position_label ??
            (member ? `Post ${member.position}` : ""),
          shootName: shoot?.name ?? "",
        }
      })
      .filter((card) => {
        if (teamFilter && card.registration.team_id !== teamFilter) {
          return false
        }
        if (squadFilter && card.squadNumber !== squadFilter) {
          return false
        }
        if (
          athleteFilter &&
          card.registration.athlete_id !== athleteFilter
        ) {
          return false
        }
        return true
      })
      .sort(
        (left, right) =>
          left.teamName.localeCompare(right.teamName) ||
          left.squadNumber.localeCompare(right.squadNumber, undefined, {
            numeric: true,
          }) ||
          left.athleteName.localeCompare(right.athleteName),
      )
  }, [athleteFilter, data, squadFilter, teamFilter])

  const availableSquads = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.squads ?? [])
            .map((squad) => squad.squad_number)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [data?.squads],
  )

  async function createPdf() {
    if (!data || !selectedCourse) {
      setError("Select a course before generating scorecards.")
      return
    }
    if (cards.length === 0) {
      setError("No eligible athletes match the selected filters.")
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

      const stations = data.stations
        .filter((station) => station.course_id === selectedCourse.id)
        .sort((a, b) => a.station_number - b.station_number)

      for (let index = 0; index < cards.length; index += 1) {
        const slot = index % 2
        if (index > 0 && slot === 0) pdf.addPage("letter", "landscape")

        const card = cards[index]
        const x = slot === 0 ? 0 : 5.5
        const y = 0
        await drawScorecard(
          pdf,
          x,
          y,
          data,
          selectedCourse,
          stations,
          card,
        )
      }

      pdf.save(
        `${data.event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-scorecards.pdf`,
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
                Scorecard Center
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">
                {data.event.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Generate two 5½ × 8½ scorecards on each landscape
                letter-size page.
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

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-semibold">
              Course
              <select
                value={selectedCourseId}
                onChange={(event) =>
                  setSelectedCourseId(event.target.value)
                }
                className="mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">Select a course</option>
                {data.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Team
              <select
                value={teamFilter}
                onChange={(event) => {
                  setTeamFilter(event.target.value)
                  setAthleteFilter("")
                }}
                className="mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">All teams</option>
                {data.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Squad
              <select
                value={squadFilter}
                onChange={(event) => setSquadFilter(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">All squads</option>
                {availableSquads.map((squad) => (
                  <option key={squad} value={squad}>
                    Squad {squad}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Athlete
              <select
                value={athleteFilter}
                onChange={(event) =>
                  setAthleteFilter(event.target.value)
                }
                className="mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">All athletes</option>
                {cards.map((card) => (
                  <option
                    key={card.registration.athlete_id}
                    value={card.registration.athlete_id}
                  >
                    {card.athleteName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-slate-950">
                {cards.length} scorecard{cards.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-slate-500">
                Only registered and paid/waived athletes are included.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void createPdf()}
                disabled={generating || !selectedCourseId}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Generate PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
                disabled={generating}
              >
                <Printer className="h-4 w-4" />
                Print Page
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-xl font-bold">Print Queue</h2>
          </div>
          <div className="divide-y">
            {cards.slice(0, 100).map((card) => (
              <div
                key={card.registration.id}
                className="grid gap-2 p-4 text-sm sm:grid-cols-5"
              >
                <span className="font-semibold">{card.athleteName}</span>
                <span>{card.teamName}</span>
                <span>
                  {card.squadNumber
                    ? `Squad ${card.squadNumber}`
                    : "No squad"}
                </span>
                <span>{card.postLabel || "No post"}</span>
                <span className="text-slate-500">
                  {card.shootName || "No shoot"}
                </span>
              </div>
            ))}
            {cards.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No athletes match the selected filters.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </PageContainer>
  )
}

async function drawScorecard(
  pdf: jsPDF,
  x: number,
  y: number,
  data: ScorecardCenterData,
  course: ScorecardCourse,
  stations: ScorecardCenterData["stations"],
  card: PrintableCard,
) {
  const width = 5.5
  const height = 8.5
  const margin = 0.16

  pdf.setDrawColor(20)
  pdf.setLineWidth(0.012)
  pdf.rect(x + 0.04, y + 0.04, width - 0.08, height - 0.08)

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  pdf.text("CYSSA SCORECARD", x + margin, y + 0.28)

  pdf.setFontSize(7)
  pdf.setFont("helvetica", "normal")
  pdf.text(data.event.name, x + margin, y + 0.46)
  pdf.text(
    `${formatDate(data.event.start_date)}  |  ${
      data.event.location_name ?? "Location not set"
    }`,
    x + margin,
    y + 0.60,
  )
  pdf.text(
    `Host: ${
      data.event.host_sponsor ??
      data.event.sponsor_name ??
      "Not set"
    }`,
    x + margin,
    y + 0.74,
  )
  pdf.text(
    `Course: ${course.name} (${course.course_side})`,
    x + margin,
    y + 0.88,
  )

  const qrPayload = JSON.stringify({
    v: 1,
    organizationId: data.event.organization_id,
    eventId: data.event.id,
    courseId: course.id,
    registrationId: card.registration.id,
    athleteId: card.registration.athlete_id,
    squad: card.squadNumber || null,
    post: card.postLabel || null,
    generatedAt: new Date().toISOString(),
  })
  const qr = await QRCode.toDataURL(qrPayload, {
    margin: 0,
    width: 256,
    errorCorrectionLevel: "M",
  })
  pdf.addImage(qr, "PNG", x + width - 0.95, y + 0.14, 0.74, 0.74)

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text(`Athlete: ${card.athleteName}`, x + margin, y + 1.08)
  pdf.text(`Team: ${card.teamName}`, x + margin, y + 1.24)
  pdf.text(
    `Squad: ${card.squadNumber || "—"}   ${card.postLabel || ""}`,
    x + 3.25,
    y + 1.24,
  )

  const tableX = x + margin
  const tableY = y + 1.42
  const rowH = 0.34
  const stationW = 0.44
  const birdW = 0.31
  const totalW = 0.48
  const runningW = 0.55

  pdf.setFontSize(5.8)
  pdf.setFont("helvetica", "bold")
  pdf.rect(
    tableX,
    tableY,
    stationW + birdW * 10 + totalW + runningW,
    rowH,
  )
  pdf.text("STN", tableX + 0.11, tableY + 0.21)
  for (let bird = 1; bird <= 10; bird += 1) {
    pdf.rect(
      tableX + stationW + (bird - 1) * birdW,
      tableY,
      birdW,
      rowH,
    )
    pdf.text(
      String(bird),
      tableX + stationW + (bird - 1) * birdW + 0.12,
      tableY + 0.21,
    )
  }
  const stationTotalX = tableX + stationW + birdW * 10
  pdf.rect(stationTotalX, tableY, totalW, rowH)
  pdf.rect(stationTotalX + totalW, tableY, runningW, rowH)
  pdf.text("ST", stationTotalX + 0.16, tableY + 0.21)
  pdf.text("RUN", stationTotalX + totalW + 0.16, tableY + 0.21)

  for (let row = 0; row < 15; row += 1) {
    const stationNumber = row + 1
    const station = stations.find(
      (item) => item.station_number === stationNumber,
    )
    const birdCount = station?.bird_count ?? 0
    const rowY = tableY + rowH * (row + 1)

    pdf.rect(
      tableX,
      rowY,
      stationW + birdW * 10 + totalW + runningW,
      rowH,
    )
    pdf.text(String(stationNumber), tableX + 0.15, rowY + 0.21)

    for (let bird = 1; bird <= 10; bird += 1) {
      const cellX = tableX + stationW + (bird - 1) * birdW
      pdf.rect(cellX, rowY, birdW, rowH)
      if (bird <= birdCount) {
        pdf.circle(cellX + birdW / 2, rowY + rowH / 2, 0.095)
      }
    }

    pdf.rect(stationTotalX, rowY, totalW, rowH)
    pdf.rect(stationTotalX + totalW, rowY, runningW, rowH)
  }

  const footerY = tableY + rowH * 16 + 0.18
  pdf.setFontSize(7)
  pdf.setFont("helvetica", "bold")
  pdf.text("MALFUNCTIONS", tableX, footerY)
  for (let i = 0; i < 3; i += 1) {
    pdf.rect(tableX + 0.95 + i * 0.24, footerY - 0.13, 0.18, 0.18)
  }
  pdf.text(
    "GRAND TOTAL: __________",
    x + width - 1.72,
    footerY,
  )

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6.4)
  pdf.text(
    "Verified by:  #1________________  #2________________    Entered by:________________",
    tableX,
    footerY + 0.34,
  )
}