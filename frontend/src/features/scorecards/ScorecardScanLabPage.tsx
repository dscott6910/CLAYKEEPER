import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  QrCode,
  RotateCcw,
  Save,
  ScanLine,
  Upload,
} from "lucide-react"
import { Link } from "react-router-dom"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  analyzeBubbleScorecard,
  detectRegistrationMarkers,
  warpUsingMarkerTemplate,
  type BubbleCellReading,
  type BubbleGridTemplate,
  type GridCellState,
  type RegistrationMarker,
} from "@/lib/scorecards/gridScorecardDetector"
import {
  loadDigitalScoring,
  saveDigitalScorecard,
  type DigitalScoringData,
} from "@/lib/services/digitalScoring"

const CARD_WIDTH = 5.5
const CARD_HEIGHT = 8.5
const TABLE_X = 0.16
const TABLE_Y = 1.22
const TABLE_WIDTH = CARD_WIDTH - 0.32
const STATION_WIDTH = 0.62
const TOTAL_WIDTH = 0.68
const RUNNING_WIDTH = 0.62
const ROW_HEIGHT = 0.34

type CardIdentity = {
  eventId: string
  shootId: string
  memberId: string
  courseId: string
  scoringUrl: string
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () =>
      reject(reader.error ?? new Error("The photo could not be read."))
    reader.readAsDataURL(file)
  })
}

function parseScorecardQr(value: string): CardIdentity {
  const url = new URL(value, window.location.origin)
  const match = url.pathname.match(/^\/events\/([^/]+)\/digital-scoring\/?$/)
  const eventId = match?.[1] ?? ""
  const shootId = url.searchParams.get("shootId") ?? ""
  const memberId = url.searchParams.get("memberId") ?? ""
  const courseId = url.searchParams.get("courseId") ?? ""
  if (!eventId || !shootId || !memberId || !courseId) {
    throw new Error(
      "This is not an assigned ClayKeeper scorecard. Generate a participant scorecard with its QR code and try again.",
    )
  }
  return { eventId, shootId, memberId, courseId, scoringUrl: url.toString() }
}

function participantName(data: DigitalScoringData, memberId: string) {
  const member = data.members.find((row) => row.id === memberId)
  const enrollment = data.enrollments.find(
    (row) => row.id === member?.registration_shoot_id,
  )
  const registration = data.registrations.find(
    (row) => row.id === enrollment?.registration_id,
  )
  const athlete = data.athletes.find(
    (row) => row.id === registration?.athlete_id,
  )
  const first =
    athlete?.preferred_name?.trim() || athlete?.first_name?.trim() || ""
  return (
    `${first} ${athlete?.last_name?.trim() || ""}`.trim() ||
    "Unknown participant"
  )
}

function buildTemplate(
  stations: DigitalScoringData["stations"],
): BubbleGridTemplate {
  return {
    stations: stations.map((station) => ({
      stationNumber: station.station_number,
      birdCount: station.bird_count,
    })),
    x: TABLE_X / CARD_WIDTH,
    y: TABLE_Y / CARD_HEIGHT,
    width: TABLE_WIDTH / CARD_WIDTH,
    stationColumnWidth: STATION_WIDTH / CARD_WIDTH,
    totalColumnWidth: TOTAL_WIDTH / CARD_WIDTH,
    runningColumnWidth: RUNNING_WIDTH / CARD_WIDTH,
    headerHeight: ROW_HEIGHT / CARD_HEIGHT,
    rowHeight: ROW_HEIGHT / CARD_HEIGHT,
    birdColumns: Math.min(
      14,
      Math.max(1, ...stations.map((station) => station.bird_count)),
    ),
  }
}

function markerCenters(stationCount: number) {
  const top = (TABLE_Y - 0.12) / CARD_HEIGHT
  const bottom = (TABLE_Y + ROW_HEIGHT * (stationCount + 1) + 0.1) / CARD_HEIGHT
  return [
    { x: 0.24 / CARD_WIDTH, y: top },
    { x: (CARD_WIDTH - 0.24) / CARD_WIDTH, y: top },
    { x: (CARD_WIDTH - 0.24) / CARD_WIDTH, y: bottom },
    { x: 0.24 / CARD_WIDTH, y: bottom },
  ] as const
}

export function ScorecardScanLabPage() {
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const correctedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const correctedImageRef = useRef<ImageData | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [identity, setIdentity] = useState<CardIdentity | null>(null)
  const [data, setData] = useState<DigitalScoringData | null>(null)
  const [markers, setMarkers] = useState<RegistrationMarker[]>([])
  const [readings, setReadings] = useState<BubbleCellReading[]>([])
  const [overrides, setOverrides] = useState<Record<string, GridCellState>>({})
  const [status, setStatus] = useState("Ready for an assigned scorecard photo")
  const [error, setError] = useState("")
  const [identifying, setIdentifying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const stations = useMemo(
    () =>
      data && identity
        ? data.stations
            .filter(
              (station) =>
                station.course_id === identity.courseId &&
                station.bird_count > 0,
            )
            .sort((a, b) => a.display_order - b.display_order)
        : [],
    [data, identity],
  )

  const cardDetails = useMemo(() => {
    if (!data || !identity) return null
    const member = data.members.find((row) => row.id === identity.memberId)
    const squad = data.squads.find((row) => row.id === member?.squad_id)
    return {
      participant: participantName(data, identity.memberId),
      squad: squad?.squad_number ?? "Unassigned",
      course:
        data.courses.find((row) => row.id === identity.courseId)?.name ??
        "Unknown course",
      shoot:
        data.shoots.find((row) => row.id === identity.shootId)?.name ??
        "Unknown shoot",
    }
  }, [data, identity])

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.")
      return
    }
    setMarkers([])
    setReadings([])
    setOverrides({})
    setIdentity(null)
    setData(null)
    setSaved(false)
    setError("")
    setIdentifying(true)
    correctedImageRef.current = null
    setStatus("Reading the scorecard QR code...")
    try {
      const nextUrl = await readFileAsDataUrl(file)
      setImageUrl(nextUrl)
      const { BrowserQRCodeReader } = await import("@zxing/browser")
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(nextUrl)
      const nextIdentity = parseScorecardQr(result.getText().trim())
      const nextData = await loadDigitalScoring(nextIdentity.eventId)
      if (!nextData.members.some((row) => row.id === nextIdentity.memberId))
        throw new Error(
          "The participant assignment in this QR code is no longer available.",
        )
      if (!nextData.shoots.some((row) => row.id === nextIdentity.shootId))
        throw new Error("The shoot in this QR code is no longer available.")
      if (!nextData.courses.some((row) => row.id === nextIdentity.courseId))
        throw new Error("The course in this QR code is no longer available.")
      setIdentity(nextIdentity)
      setData(nextData)
      setStatus("Scorecard identified - select Scan filled bubbles")
    } catch (caught) {
      setStatus("Scorecard could not be identified")
      setError(
        caught instanceof Error
          ? caught.message
          : "The QR code could not be read. Take a clear photo of the complete card.",
      )
    } finally {
      setIdentifying(false)
    }
  }

  function drawSource(nextMarkers = markers) {
    const canvas = sourceCanvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    const scale = Math.min(
      1,
      1400 / image.naturalWidth,
      1800 / image.naturalHeight,
    )
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext("2d")
    if (!context) return
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    nextMarkers.forEach((marker, index) => {
      context.strokeStyle = "#059669"
      context.lineWidth = 5
      context.strokeRect(
        marker.bounds.x,
        marker.bounds.y,
        marker.bounds.width,
        marker.bounds.height,
      )
      context.beginPath()
      context.arc(marker.center.x, marker.center.y, 12, 0, Math.PI * 2)
      context.fillStyle = "#059669"
      context.fill()
      context.fillStyle = "#ffffff"
      context.font = "bold 13px sans-serif"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(String(index + 1), marker.center.x, marker.center.y)
    })
  }

  function drawCorrected() {
    const canvas = correctedCanvasRef.current
    const corrected = correctedImageRef.current
    if (!canvas || !corrected) return
    canvas.width = corrected.width
    canvas.height = corrected.height
    canvas.getContext("2d")?.putImageData(corrected, 0, 0)
  }

  function scanScorecard() {
    const canvas = sourceCanvasRef.current
    if (!canvas || !imageRef.current || !identity || !data) {
      setError(
        "Upload an assigned scorecard and wait for its QR code to be identified first.",
      )
      return
    }
    if (stations.length === 0) {
      setError("This scorecard course has no active stations to scan.")
      return
    }
    const context = canvas.getContext("2d")
    if (!context) return
    drawSource([])
    const source = context.getImageData(0, 0, canvas.width, canvas.height)
    setStatus("Finding the four alignment markers...")
    const found = detectRegistrationMarkers(
      source,
      markerCenters(stations.length),
    )
    if (found.length !== 4) {
      setMarkers([])
      setReadings([])
      setStatus("Scan needs another photo")
      setError(
        "Could not find all four square markers. Keep the complete half-page card visible, use even light, and move a little closer.",
      )
      return
    }
    setMarkers(found)
    drawSource(found)
    try {
      setStatus("Straightening the scorecard...")
      const corrected = warpUsingMarkerTemplate(
        source,
        found.map((marker) => marker.center),
        markerCenters(stations.length),
        1100,
        1700,
      )
      correctedImageRef.current = corrected
      drawCorrected()
      setStatus("Reading filled bubbles...")
      setReadings(analyzeBubbleScorecard(corrected, buildTemplate(stations)))
      setOverrides({})
      setSaved(false)
      setError("")
      setStatus("Scan complete - review each station before importing")
    } catch (caught) {
      setStatus("Scan failed")
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to process this scorecard photo.",
      )
    }
  }

  function cycleReading(reading: BubbleCellReading) {
    const key = `${reading.station}-${reading.bird}`
    const current = overrides[key] ?? reading.state
    const next: GridCellState =
      current === "blank" ? "hit" : current === "hit" ? "review" : "blank"
    setOverrides((values) => ({ ...values, [key]: next }))
    setSaved(false)
  }

  function reset() {
    setImageUrl("")
    setIdentity(null)
    setData(null)
    setMarkers([])
    setReadings([])
    setOverrides({})
    setSaved(false)
    correctedImageRef.current = null
    imageRef.current = null
    setError("")
    setStatus("Ready for an assigned scorecard photo")
    const canvas = correctedCanvasRef.current
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }

  useEffect(() => {
    if (!imageUrl) return
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      drawSource([])
    }
    image.onerror = () => setError("The selected image could not be loaded.")
    image.src = imageUrl
  }, [imageUrl])
  useEffect(() => {
    drawSource()
  }, [markers])

  const interpretedReadings = useMemo(
    () =>
      readings.map((reading) => ({
        ...reading,
        state: overrides[`${reading.station}-${reading.bird}`] ?? reading.state,
      })),
    [readings, overrides],
  )

  const stationTotals = useMemo(
    () =>
      stations.map((station) => {
        const cells = interpretedReadings.filter(
          (reading) => reading.station === station.station_number,
        )
        return {
          station,
          hits: cells.filter((reading) => reading.state === "hit").length,
          review: cells.filter((reading) => reading.state === "review").length,
          cells,
        }
      }),
    [interpretedReadings, stations],
  )

  const summary = useMemo(
    () => ({
      hits: interpretedReadings.filter((reading) => reading.state === "hit")
        .length,
      review: interpretedReadings.filter(
        (reading) => reading.state === "review",
      ).length,
      total: interpretedReadings.length,
    }),
    [interpretedReadings],
  )

  async function importDraft() {
    if (!data || !identity || readings.length === 0 || summary.review > 0)
      return
    const scorecard = data.scorecards.find(
      (row) =>
        row.squad_member_id === identity.memberId &&
        row.course_id === identity.courseId,
    )
    if (scorecard?.status === "finalized") {
      setError(
        "This participant's scorecard is already finalized and cannot be replaced by a scan.",
      )
      return
    }
    setSaving(true)
    setSaved(false)
    setError("")
    try {
      const prior = new Map(
        data.stationScores
          .filter((row) => row.scorecard_id === scorecard?.id)
          .map((row) => [row.station_id, row]),
      )
      const importNote = `Imported from paper scorecard on ${new Date().toLocaleString()}.`
      await saveDigitalScorecard({
        organizationId: data.event.organization_id,
        eventId: identity.eventId,
        shootId: identity.shootId,
        squadMemberId: identity.memberId,
        courseId: identity.courseId,
        scorecardId: scorecard?.id,
        malfunctionCount: scorecard?.malfunction_count ?? 0,
        verifiedBy1: scorecard?.verified_by_1 ?? "",
        verifiedBy2: scorecard?.verified_by_2 ?? "",
        enteredByName: scorecard?.entered_by_name ?? "Paper scorecard scan",
        notes: scorecard?.notes
          ? `${scorecard.notes}\n${importNote}`
          : importNote,
        status: "draft",
        expectedUpdatedAt: scorecard?.updated_at ?? null,
        stationScores: stationTotals.map(({ station, hits }) => ({
          stationId: station.id,
          hits,
          targets: station.bird_count,
          notes: prior.get(station.id)?.notes ?? "",
        })),
      })
      setSaved(true)
      setStatus(
        "Draft imported - open the digital scorecard to verify and finalize it",
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "ClayKeeper could not import this scorecard draft.",
      )
    } finally {
      setSaving(false)
    }
  }

  const canImport =
    Boolean(identity && data) &&
    readings.length > 0 &&
    markers.length === 4 &&
    summary.review === 0 &&
    !saving

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader
        title="Paper Scorecard Import"
        description="Scan filled bubbles, review the result, and import a draft score"
      />
      <PageContainer>
        <div className="space-y-5">
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">
                  A person confirms every imported score
                </p>
                <p className="mt-1">
                  Filled bubbles count as dead targets. Empty bubbles count as
                  losses. Scans are saved as drafts and must be finalized from
                  Digital Scoring.
                </p>
              </div>
            </div>
          </section>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      Scorecard photo
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Photograph one complete half-page card with its QR code
                      and all four square markers visible.
                    </p>
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                    <Camera className="h-4 w-4" />
                    Take or upload photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={loadFile}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="mt-5 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2">
                  {imageUrl ? (
                    <canvas
                      ref={sourceCanvasRef}
                      className="mx-auto block h-auto max-w-full rounded-md bg-white"
                    />
                  ) : (
                    <div className="flex min-h-80 flex-col items-center justify-center text-center text-slate-500">
                      <Upload className="h-10 w-10" />
                      <p className="mt-3 font-semibold">
                        No scorecard photo selected
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Button
                    size="lg"
                    onClick={scanScorecard}
                    disabled={!identity || identifying || stations.length === 0}
                    className="h-11 bg-slate-950 font-bold text-white hover:bg-slate-800"
                  >
                    {identifying ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ScanLine />
                    )}
                    Scan filled bubbles
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={reset}
                    className="h-11 font-bold"
                  >
                    <RotateCcw />
                    Reset
                  </Button>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">
                  {status}
                </div>
                {error ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </section>

              {readings.length > 0 ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-950">
                    Station review
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Green is filled/dead. White is empty/loss. Amber needs a
                    decision. Tap any bubble to change it.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stationTotals.map(({ station, hits, review, cells }) => (
                      <div
                        key={station.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500">
                              Station {station.station_number}
                            </p>
                            <p className="mt-1 text-2xl font-black text-slate-950">
                              {hits} / {station.bird_count}
                            </p>
                          </div>
                          {review > 0 ? (
                            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                              {review} review
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {cells.map((reading) => (
                            <button
                              key={`${reading.station}-${reading.bird}`}
                              type="button"
                              onClick={() => cycleReading(reading)}
                              title={`Detection confidence ${Math.round(reading.score * 100)}%`}
                              aria-label={`Station ${reading.station}, target ${reading.bird}: ${reading.state}`}
                              className={
                                reading.state === "hit"
                                  ? "h-9 w-9 rounded-full border-2 border-emerald-700 bg-emerald-600 text-xs font-bold text-white"
                                  : reading.state === "review"
                                    ? "h-9 w-9 rounded-full border-2 border-amber-600 bg-amber-100 text-xs font-bold text-amber-900"
                                    : "h-9 w-9 rounded-full border-2 border-slate-300 bg-white text-xs font-bold text-slate-600"
                              }
                            >
                              {reading.bird}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section
                className={
                  correctedImageRef.current
                    ? "rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    : "hidden"
                }
              >
                <h2 className="text-lg font-bold text-slate-950">
                  Straightened scorecard
                </h2>
                <div className="mt-4 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2">
                  <canvas
                    ref={correctedCanvasRef}
                    className="mx-auto block h-auto max-w-full rounded-md bg-white"
                  />
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-emerald-600" />
                  <h2 className="font-bold text-slate-950">Assigned card</h2>
                </div>
                {cardDetails ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <SummaryRow
                      label="Participant"
                      value={cardDetails.participant}
                    />
                    <SummaryRow label="Shoot" value={cardDetails.shoot} />
                    <SummaryRow label="Course" value={cardDetails.course} />
                    <SummaryRow label="Squad" value={cardDetails.squad} />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    The card details appear after its QR code is read.
                  </p>
                )}
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-bold text-slate-950">Detected score</h2>
                <p className="mt-4 text-5xl font-black text-slate-950">
                  {summary.hits}
                  <span className="text-2xl text-slate-400">
                    {" "}
                    / {summary.total || "-"}
                  </span>
                </p>
                <div className="mt-5 space-y-3 text-sm">
                  <SummaryRow label="Markers" value={`${markers.length} / 4`} />
                  <SummaryRow label="Filled / dead" value={summary.hits} />
                  <SummaryRow label="Needs review" value={summary.review} />
                </div>
                {summary.review > 0 ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                    Resolve every amber bubble before importing.
                  </div>
                ) : null}
                <Button
                  size="lg"
                  onClick={() => void importDraft()}
                  disabled={!canImport}
                  className="mt-5 h-11 w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  Import as draft
                </Button>
              </section>
              {saved && identity ? (
                <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-bold">Draft imported</p>
                      <p className="mt-1">
                        Verify names, station totals, malfunctions, and
                        signatures before finalizing.
                      </p>
                      <Link
                        to={`${new URL(identity.scoringUrl).pathname}${new URL(identity.scoringUrl).search}`}
                        className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 text-sm font-bold text-emerald-950 hover:bg-emerald-100"
                      >
                        Open digital scorecard
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </section>
              ) : null}
            </aside>
          </section>
        </div>
      </PageContainer>
    </div>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <strong className="text-right text-slate-950">{value}</strong>
    </div>
  )
}
