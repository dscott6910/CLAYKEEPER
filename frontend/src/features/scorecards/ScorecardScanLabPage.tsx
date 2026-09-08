import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react"
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
  RotateCcw,
  Save,
  ScanLine,
  Upload,
} from "lucide-react"
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs"
import pdfWorkerSource from "pdfjs-dist/build/pdf.worker.min.mjs?raw"
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
import {
  loadScoringBaseData,
  type ScoringEvent,
  type ScoringShoot,
} from "@/lib/services/scoring"

if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = URL.createObjectURL(
    new Blob([pdfWorkerSource], { type: "text/javascript" }),
  )
}

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

type ScanMode = "assigned" | "generic"

type BatchCard = {
  key: string
  label: string
  identity?: CardIdentity
  name?: string
  eventName?: string
  preview?: string
  stations: Array<{
    id: string
    number: number
    targets: number
    hits: number
    uncertain: boolean
  }>
  bubbles: Array<{
    station: number
    bird: number
    state: GridCellState
  }>
  reviewed: boolean
  imported: boolean
  error?: string
  blocked?: boolean
  existingId?: string
  existingUpdatedAt?: string
}

function batchError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "The card could not be read. Retry this page in the single-card scanner."
}

function updateBatchStation(
  card: BatchCard,
  stationNumber: number,
  update: (state: GridCellState, bubble: { station: number; bird: number; state: GridCellState }) => GridCellState,
) {
  const bubbles = card.bubbles.map((bubble) =>
    bubble.station === stationNumber
      ? { ...bubble, state: update(bubble.state, bubble) }
      : bubble,
  )
  return {
    bubbles,
    stations: card.stations.map((station) => ({
      ...station,
      hits: bubbles.filter(
        (bubble) => bubble.station === station.number && bubble.state === "hit",
      ).length,
      uncertain: bubbles.some(
        (bubble) => bubble.station === station.number && bubble.state === "review",
      ),
    })),
    reviewed: false,
  }
}

function BatchScorecardImport({ onBack }: { onBack: () => void }) {
  const [cards, setCards] = useState<BatchCard[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const cancelled = useRef(false)
  const running = useRef(false)
  useEffect(
    () => () => {
      cancelled.current = true
    },
    [],
  )
  const update = (key: string, patch: Partial<BatchCard>) =>
    setCards((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  const ready = cards.filter(
    (card) => card.reviewed && !card.imported && !card.blocked && card.identity,
  )
  const current = cards.find((card) => card.key === selected)

  function cycleBatchBubble(card: BatchCard, stationNumber: number, bird: number) {
    update(card.key, {
      ...updateBatchStation(card, stationNumber, (state, bubble) => {
        if (bubble.bird !== bird) return state
        return state === "blank" ? "hit" : state === "hit" ? "review" : "blank"
      }),
    })
  }

  function approveBatchStation(card: BatchCard, stationNumber: number) {
    update(card.key, {
      ...updateBatchStation(card, stationNumber, (state) =>
        state === "review" ? "hit" : state,
      ),
    })
  }

  async function loadBatch(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!files.length || running.current) return
    running.current = true
    cancelled.current = false
    setBusy(true)
    setError("")
    const seen = new Set(
      cards.flatMap((card) =>
        card.identity
          ? [`${card.identity.eventId}:${card.identity.memberId}`]
          : [],
      ),
    )
    const cache = new Map<string, DigitalScoringData>()
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser")
      for (const file of files) {
        if (cancelled.current) break
        let pdf: Awaited<ReturnType<typeof getDocument>["promise"]> | undefined
        try {
          pdf = await getDocument({ data: await file.arrayBuffer() }).promise
          for (let page = 1; page <= pdf.numPages; page++) {
            if (cancelled.current) break
            const card: BatchCard = {
              key: crypto.randomUUID(),
              label: `${file.name} - page ${page}`,
              stations: [],
              bubbles: [],
              reviewed: false,
              imported: false,
            }
            setProgress(
              `${file.name}: scanning page ${page} of ${pdf.numPages}`,
            )
            try {
              const url = await readPdfPageAsDataUrl(file, page, pdf)
              const image = new Image()
              image.src = url
              await image.decode()
              const canvas = document.createElement("canvas")
              const scale = Math.min(1, 1400 / image.width, 1800 / image.height)
              canvas.width = Math.round(image.width * scale)
              canvas.height = Math.round(image.height * scale)
              const context = canvas.getContext("2d")!
              context.drawImage(image, 0, 0, canvas.width, canvas.height)
              card.preview = canvas.toDataURL("image/jpeg", 0.65)
              const reader = new BrowserQRCodeReader()
              const result = await reader
                .decodeFromImageUrl(url)
                .catch(async () => {
                  // Registration squares can distract QR detection on a full
                  // page. Retry the footer where assigned cards print the QR.
                  const footer = document.createElement("canvas")
                  footer.width = Math.ceil(canvas.width * 0.6)
                  footer.height = Math.ceil(canvas.height * 0.45)
                  footer
                    .getContext("2d")!
                    .drawImage(
                      canvas,
                      canvas.width - footer.width,
                      canvas.height - footer.height,
                      footer.width,
                      footer.height,
                      0,
                      0,
                      footer.width,
                      footer.height,
                    )
                  return reader.decodeFromImageUrl(
                    footer.toDataURL("image/png"),
                  )
                })
              const identity = parseScorecardQr(result.getText().trim())
              card.identity = identity
              let data = cache.get(identity.eventId)
              if (!data) {
                data = await loadDigitalScoring(identity.eventId)
                cache.set(identity.eventId, data)
              }
              card.name = participantName(data, identity.memberId)
              card.eventName = data.event.name
              const member = data.members.find(
                (row) => row.id === identity.memberId,
              )
              const squad = data.squads.find(
                (row) => row.id === member?.squad_id,
              )
              if (
                !member ||
                squad?.shoot_id !== identity.shootId ||
                !data.courses.some((row) => row.id === identity.courseId)
              )
                throw new Error("The QR assignment is no longer valid.")
              const key = `${identity.eventId}:${identity.memberId}`
              if (seen.has(key))
                throw new Error(
                  "Duplicate participant scorecard in this batch.",
                )
              const existing = data.scorecards.find(
                (row) => row.squad_member_id === identity.memberId,
              )
              if (existing?.status === "finalized")
                throw new Error("This scorecard is already finalized.")
              card.existingId = existing?.id
              card.existingUpdatedAt = existing?.updated_at
              const stations = data.stations
                .filter(
                  (row) =>
                    row.course_id === identity.courseId && row.bird_count > 0,
                )
                .sort((a, b) => a.display_order - b.display_order)
              if (!stations.length)
                throw new Error("This course has no active stations.")
              const source = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              )
              const centers = markerCenters(stations.length)
              const markers = detectRegistrationMarkers(source, centers)
              if (markers.length !== 4)
                throw new Error(
                  "Corners need manual marking in the single-card scanner.",
                )
              const corrected = warpUsingMarkerTemplate(
                source,
                markers.map((row) => row.center),
                centers,
                1100,
                1700,
              )
              const readings = analyzeBubbleScorecard(
                corrected,
                buildTemplate(stations),
              )
              card.stations = stations.map((station) => ({
                id: station.id,
                number: station.station_number,
                targets: station.bird_count,
                hits: readings.filter(
                  (row) =>
                    row.station === station.station_number &&
                    row.state === "hit",
                ).length,
                uncertain: readings.some(
                  (row) =>
                    row.station === station.station_number &&
                    row.state === "review",
                ),
              }))
              card.bubbles = readings.map((reading) => ({
                station: reading.station,
                bird: reading.bird,
                state: reading.state,
              }))
              seen.add(key)
            } catch (caught) {
              card.error = batchError(caught)
              card.blocked = true
            }
            setCards((rows) => [...rows, card])
            // Release the renderer's page cache between cards in large documents.
            await pdf.cleanup()
            await new Promise((resolve) => setTimeout(resolve, 0))
          }
        } catch (caught) {
          setError(`${file.name}: ${batchError(caught)}`)
        } finally {
          await pdf?.destroy()
        }
      }
      setProgress(
        cancelled.current
          ? "Batch scan stopped. Completed pages are available below."
          : "Batch scan complete",
      )
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  async function importBatch() {
    if (running.current) return
    running.current = true
    cancelled.current = false
    setBusy(true)
    let imported = 0
    try {
      for (const card of ready) {
        if (cancelled.current) break
        const identity = card.identity!
        setProgress(
          `Importing ${card.name} (${imported + 1} of ${ready.length})`,
        )
        try {
          const data = await loadDigitalScoring(identity.eventId)
          const prior = data.scorecards.find(
            (row) => row.squad_member_id === identity.memberId,
          )
          if (prior?.status === "finalized")
            throw new Error("This scorecard is now finalized.")
          if (
            prior?.id !== card.existingId ||
            prior?.updated_at !== card.existingUpdatedAt
          )
            throw new Error(
              "This scorecard changed since scanning. Reload it before importing.",
            )
          const liveStations = data.stations.filter(
            (row) => row.course_id === identity.courseId && row.bird_count > 0,
          )
          if (
            liveStations.length !== card.stations.length ||
            card.stations.some(
              (station) =>
                !liveStations.some(
                  (live) =>
                    live.id === station.id &&
                    live.bird_count === station.targets,
                ),
            )
          )
            throw new Error(
              "The course changed since scanning. Scan this page again.",
            )
          await saveDigitalScorecard({
            organizationId: data.event.organization_id,
            eventId: identity.eventId,
            shootId: identity.shootId,
            squadMemberId: identity.memberId,
            courseId: identity.courseId,
            scorecardId: prior?.id,
            malfunctionCount: prior?.malfunction_count ?? 0,
            verifiedBy1: prior?.verified_by_1 ?? "",
            verifiedBy2: prior?.verified_by_2 ?? "",
            enteredByName: prior?.entered_by_name ?? "Paper scorecard scan",
            notes:
              `${prior?.notes ?? ""}\nImported from ${card.label} on ${new Date().toLocaleString()}.`.trim(),
            status: "draft",
            expectedUpdatedAt: prior?.updated_at ?? null,
            stationScores: card.stations.map((station) => ({
              stationId: station.id,
              hits: station.hits,
              targets: station.targets,
              notes:
                data.stationScores.find(
                  (row) =>
                    row.scorecard_id === prior?.id &&
                    row.station_id === station.id,
                )?.notes ?? "",
            })),
          })
          imported++
          update(card.key, { imported: true, error: undefined })
        } catch (caught) {
          update(card.key, { error: batchError(caught), reviewed: false })
        }
      }
      setProgress(
        `${imported} draft${imported === 1 ? "" : "s"} imported. Remaining pages stay in the batch.`,
      )
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title="Batch Paper Scorecard Import"
        description="Review scanned pages and import draft scores"
      />
      <PageContainer>
        <div className="space-y-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={onBack} disabled={busy}>
              <RotateCcw /> Single card
            </Button>
            <label
              className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md bg-emerald-600 px-4 text-sm font-bold text-white ${busy ? "opacity-50" : "cursor-pointer"}`}
            >
              <Upload className="h-4 w-4" /> Add PDFs
              <input
                aria-label="Add PDFs"
                className="sr-only"
                type="file"
                multiple
                accept=".pdf,application/pdf"
                disabled={busy}
                onChange={loadBatch}
              />
            </label>
            <Button disabled={busy || !ready.length} onClick={importBatch}>
              <Save /> Import reviewed ({ready.length})
            </Button>
            {busy && (
              <Button
                variant="outline"
                onClick={() => {
                  cancelled.current = true
                }}
              >
                <CircleAlert /> Stop after current page
              </Button>
            )}
          </div>
          <p className="text-sm text-slate-600">
            One assigned QR scorecard per page. Imported scores remain drafts
            until finalized in Digital Scoring.
          </p>
          <p role="status" className="text-sm font-semibold">
            {busy && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
            {progress || "No documents selected"}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Page</th>
                  <th className="p-3">Participant</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.key} className="border-b align-top">
                    <td className="max-w-64 break-words p-3">{card.label}</td>
                    <td className="p-3">
                      {card.name ?? "Unidentified"}
                      <div className="text-xs text-slate-500">
                        {card.eventName}
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-3">
                      {card.stations.length
                        ? `${card.stations.reduce((n, s) => n + s.hits, 0)} / ${card.stations.reduce((n, s) => n + s.targets, 0)}`
                        : "-"}
                    </td>
                    <td className="max-w-64 p-3">
                      {card.imported
                        ? "Imported"
                        : (card.error ??
                          (card.reviewed
                            ? "Reviewed"
                            : card.stations.some((s) => s.uncertain)
                              ? "Uncertain bubbles"
                              : "Awaiting review"))}
                      {card.existingId && !card.imported && (
                        <div className="text-xs text-amber-700">
                          Replaces existing draft
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setSelected(card.key)}
                      >
                        <FileText /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {current && (
            <section className="border-t pt-5">
              <h2 className="font-bold">
                {current.name ?? "Unidentified card"} - {current.label}
              </h2>
              <div className="mt-3 grid gap-5 lg:grid-cols-2">
                {current.preview && (
                  <img
                    src={current.preview}
                    alt={`Scanned ${current.label}`}
                    className="h-auto w-full"
                  />
                )}
                <div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {current.stations.map((station) => {
                      const bubbles = current.bubbles.filter(
                        (bubble) => bubble.station === station.number,
                      )
                      const review = bubbles.filter(
                        (bubble) => bubble.state === "review",
                      ).length
                      return (
                        <div
                          key={station.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold uppercase text-slate-500">
                                Station {station.number}
                              </p>
                              <p className="mt-1 text-2xl font-black text-slate-950">
                                {station.hits} / {station.targets}
                              </p>
                            </div>
                            {review > 0 && (
                              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                                {review} review
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {bubbles.map((bubble) => (
                              <button
                                key={`${bubble.station}-${bubble.bird}`}
                                type="button"
                                disabled={busy || current.imported}
                                onClick={() =>
                                  cycleBatchBubble(
                                    current,
                                    bubble.station,
                                    bubble.bird,
                                  )
                                }
                                aria-label={`Station ${bubble.station}, target ${bubble.bird}: ${bubble.state}`}
                                className={
                                  bubble.state === "hit"
                                    ? "h-9 w-9 rounded-full border-2 border-emerald-700 bg-emerald-600 text-xs font-bold text-white"
                                    : bubble.state === "review"
                                      ? "h-9 w-9 rounded-full border-2 border-amber-600 bg-amber-100 text-xs font-bold text-amber-900"
                                      : "h-9 w-9 rounded-full border-2 border-slate-300 bg-white text-xs font-bold text-slate-600"
                                }
                              >
                                {bubble.bird}
                              </button>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            className="mt-3 w-full whitespace-nowrap"
                            disabled={busy || current.imported || review === 0}
                            onClick={() =>
                              approveBatchStation(current, station.number)
                            }
                            title="Confirm orange bubbles as dead hits"
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            {review > 0 ? "Approve All" : "Reviewed"}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                  {!current.blocked && !current.imported && (
                    <label className="mt-5 flex items-start gap-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={current.reviewed}
                        disabled={busy}
                        onChange={(event) =>
                          update(current.key, {
                            reviewed: event.target.checked,
                          })
                        }
                      />
                      I checked the participant and every station score
                      {current.existingId
                        ? " and approve replacing the existing draft"
                        : ""}
                      .
                    </label>
                  )}
                  {current.error && (
                    <p className="mt-3 text-sm text-red-700">{current.error}</p>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </PageContainer>
    </div>
  )
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

async function readPdfPageAsDataUrl(
  file: File,
  pageNumber = 1,
  document?: Awaited<ReturnType<typeof getDocument>["promise"]>,
) {
  const pdf =
    document ?? (await getDocument({ data: await file.arrayBuffer() }).promise)
  try {
    if (pdf.numPages < 1) {
      throw new Error("The selected PDF does not contain a scorecard page.")
    }
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2.5 })
    const canvas = window.document.createElement("canvas")
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("The PDF page could not be rendered.")
    await page.render({ canvas, canvasContext: context, viewport }).promise
    if (canvas.width <= canvas.height * 1.1) {
      return canvas.toDataURL("image/png")
    }

    // Scorecard PDFs are landscape sheets with the scannable card on the
    // left half and print whitespace on the right. Crop that whitespace so
    // the marker geometry matches the same half-card used by photographs.
    const cardCanvas = window.document.createElement("canvas")
    cardCanvas.width = Math.ceil(canvas.width / 2)
    cardCanvas.height = canvas.height
    cardCanvas
      .getContext("2d")
      ?.drawImage(
        canvas,
        0,
        0,
        cardCanvas.width,
        cardCanvas.height,
        0,
        0,
        cardCanvas.width,
        cardCanvas.height,
      )
    return cardCanvas.toDataURL("image/png")
  } finally {
    if (!document) await pdf.destroy()
  }
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
  const subtotalRow = 1
  const bottom =
    (TABLE_Y + ROW_HEIGHT * (stationCount + 1 + subtotalRow) + 0.1) /
    CARD_HEIGHT
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
  const [mode, setMode] = useState<ScanMode>("assigned")
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
  const [events, setEvents] = useState<ScoringEvent[]>([])
  const [shoots, setShoots] = useState<ScoringShoot[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [genericEventId, setGenericEventId] = useState("")
  const [genericShootId, setGenericShootId] = useState("")
  const [genericCourseId, setGenericCourseId] = useState("")
  const [genericMemberId, setGenericMemberId] = useState("")
  const [manualMarking, setManualMarking] = useState(false)
  const [batchMode, setBatchMode] = useState(false)

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

  const genericParticipants = useMemo(() => {
    if (!data || !genericShootId) return []
    const enrollmentMap = new Map(data.enrollments.map((row) => [row.id, row]))
    const squadMap = new Map(data.squads.map((row) => [row.id, row]))

    return data.members
      .flatMap((member) => {
        const enrollment = enrollmentMap.get(member.registration_shoot_id)
        if (enrollment?.shoot_id !== genericShootId) return []
        const squad = squadMap.get(member.squad_id)
        return [
          {
            memberId: member.id,
            name: participantName(data, member.id),
            squad: squad?.squad_number ?? "Unassigned",
            position: member.position,
          },
        ]
      })
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) ||
          left.squad.localeCompare(right.squad, undefined, { numeric: true }) ||
          left.position - right.position,
      )
  }, [data, genericShootId])

  useEffect(() => {
    void (async () => {
      try {
        const base = await loadScoringBaseData()
        setEvents(base.events)
        setShoots(base.shoots)
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Events could not be loaded for generic scorecards.",
        )
      } finally {
        setLoadingEvents(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (mode !== "generic") return
    if (
      !data ||
      !genericEventId ||
      !genericShootId ||
      !genericCourseId ||
      !genericMemberId
    ) {
      setIdentity(null)
      return
    }

    const scoringUrl = new URL(
      `/events/${genericEventId}/digital-scoring`,
      window.location.origin,
    )
    scoringUrl.searchParams.set("shootId", genericShootId)
    scoringUrl.searchParams.set("memberId", genericMemberId)
    scoringUrl.searchParams.set("courseId", genericCourseId)
    setIdentity({
      eventId: genericEventId,
      shootId: genericShootId,
      memberId: genericMemberId,
      courseId: genericCourseId,
      scoringUrl: scoringUrl.toString(),
    })
  }, [
    data,
    genericCourseId,
    genericEventId,
    genericMemberId,
    genericShootId,
    mode,
  ])

  function clearScanResults() {
    setManualMarking(false)
    setMarkers([])
    setReadings([])
    setOverrides({})
    setSaved(false)
    correctedImageRef.current = null
    const canvas = correctedCanvasRef.current
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }

  function changeMode(nextMode: ScanMode) {
    setMode(nextMode)
    setImageUrl("")
    imageRef.current = null
    clearScanResults()
    setIdentity(null)
    setData(null)
    setGenericEventId("")
    setGenericShootId("")
    setGenericCourseId("")
    setGenericMemberId("")
    setError("")
    setStatus(
      nextMode === "assigned"
        ? "Ready for an assigned scorecard photo"
        : "Select the scorecard assignment, then take or upload a photo",
    )
  }

  async function selectGenericEvent(eventId: string) {
    setGenericEventId(eventId)
    setGenericShootId("")
    setGenericCourseId("")
    setGenericMemberId("")
    setIdentity(null)
    setData(null)
    clearScanResults()
    setError("")
    if (!eventId) return

    setIdentifying(true)
    setStatus("Loading the event scorecard assignments...")
    try {
      const nextData = await loadDigitalScoring(eventId)
      setData(nextData)
      setStatus("Select the shoot, course, and participant")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The selected event could not be loaded.",
      )
    } finally {
      setIdentifying(false)
    }
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    if (!file.type.startsWith("image/") && !isPdf) {
      setError("Please choose an image or PDF scorecard file.")
      return
    }
    clearScanResults()
    if (mode === "assigned") {
      setIdentity(null)
      setData(null)
    }
    setError("")
    setIdentifying(mode === "assigned")
    setStatus(
      mode === "assigned"
        ? "Reading the scorecard QR code..."
        : "Loading the generic scorecard file...",
    )
    try {
      const nextUrl = isPdf
        ? await readPdfPageAsDataUrl(file)
        : await readFileAsDataUrl(file)
      setImageUrl(nextUrl)
      if (mode === "generic") {
        setStatus(
          identity
            ? "File loaded - select Scan filled bubbles"
            : "File loaded - complete the scorecard assignment",
        )
        return
      }
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

  function scanScorecard(useMarkedCorners = false) {
    const canvas = sourceCanvasRef.current
    if (!canvas || !imageRef.current || !identity || !data) {
      setError(
        mode === "assigned"
          ? "Upload an assigned scorecard and wait for its QR code to be identified first."
          : "Select the event, shoot, course, and participant before scanning.",
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
    setStatus(
      useMarkedCorners
        ? "Using the four marked corners..."
        : "Finding the four alignment markers...",
    )
    const found = useMarkedCorners
      ? markers
      : detectRegistrationMarkers(source, markerCenters(stations.length))
    if (found.length !== 4) {
      setMarkers(found)
      setReadings([])
      drawSource(found)
      setStatus("Scan needs another photo")
      setError(
        `Found ${found.length} of 4 square markers. Try Mark corners manually below, or take another photo.`,
      )
      return
    }
    setManualMarking(false)
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

  function startManualMarking() {
    setManualMarking(true)
    setMarkers([])
    setReadings([])
    setOverrides({})
    setSaved(false)
    setError("")
    setStatus("Tap the top-left square marker")
    drawSource([])
  }

  function markCorner(event: MouseEvent<HTMLCanvasElement>) {
    if (!manualMarking || markers.length >= 4) return
    const canvas = sourceCanvasRef.current
    if (!canvas) return

    const bounds = canvas.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * canvas.width
    const y = ((event.clientY - bounds.top) / bounds.height) * canvas.height
    const size = Math.max(18, Math.min(canvas.width, canvas.height) * 0.025)
    const nextMarkers = [
      ...markers,
      {
        center: { x, y },
        bounds: {
          x: x - size / 2,
          y: y - size / 2,
          width: size,
          height: size,
        },
        score: 1,
      },
    ]
    const nextInstructions = [
      "Tap the top-right square marker",
      "Tap the bottom-right square marker",
      "Tap the bottom-left square marker",
      "All four corners marked - select Scan with marked corners",
    ]

    setMarkers(nextMarkers)
    setStatus(nextInstructions[nextMarkers.length - 1])
  }

  function cycleReading(reading: BubbleCellReading) {
    const key = `${reading.station}-${reading.bird}`
    const current = overrides[key] ?? reading.state
    const next: GridCellState =
      current === "blank" ? "hit" : current === "hit" ? "review" : "blank"
    setOverrides((values) => ({ ...values, [key]: next }))
    setSaved(false)
  }

  function approveStation(stationNumber: number) {
    setOverrides((values) => {
      const next = { ...values }
      for (const reading of readings) {
        const key = `${reading.station}-${reading.bird}`
        if (
          reading.station === stationNumber &&
          (values[key] ?? reading.state) === "review"
        ) {
          next[key] = "hit"
        }
      }
      return next
    })
    setSaved(false)
  }

  function reset() {
    setImageUrl("")
    imageRef.current = null
    clearScanResults()
    if (mode === "assigned") {
      setIdentity(null)
      setData(null)
    }
    setError("")
    setStatus(
      mode === "assigned"
        ? "Ready for an assigned scorecard photo"
        : identity
          ? "Assignment selected - take or upload a generic scorecard photo"
          : "Select the scorecard assignment, then take or upload a photo",
    )
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
      (row) => row.squad_member_id === identity.memberId,
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
      const importNote = `Imported from ${mode === "generic" ? "generic " : ""}paper scorecard on ${new Date().toLocaleString()}.`
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

  if (batchMode)
    return <BatchScorecardImport onBack={() => setBatchMode(false)} />

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

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-bold text-slate-950">Scorecard type</h2>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => setBatchMode(true)}
                  disabled={saving || identifying}
                >
                  <Upload /> Batch PDF import
                </Button>
                <p className="mt-1 text-sm text-slate-500">
                  Assigned cards identify the participant from the QR code.
                  Generic cards are assigned manually.
                </p>
              </div>
              <div className="grid min-w-72 grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => changeMode("assigned")}
                  className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold ${
                    mode === "assigned"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  Assigned QR
                </button>
                <button
                  type="button"
                  onClick={() => changeMode("generic")}
                  className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold ${
                    mode === "generic"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Generic card
                </button>
              </div>
            </div>

            {mode === "generic" ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-600">
                    Event
                  </span>
                  <select
                    value={genericEventId}
                    onChange={(event) =>
                      void selectGenericEvent(event.target.value)
                    }
                    disabled={loadingEvents || identifying}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">
                      {loadingEvents ? "Loading events..." : "Select event"}
                    </option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-600">
                    Shoot
                  </span>
                  <select
                    value={genericShootId}
                    onChange={(event) => {
                      setGenericShootId(event.target.value)
                      setGenericMemberId("")
                      setSaved(false)
                      setStatus("Select the course and participant")
                    }}
                    disabled={!data || identifying}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">Select shoot</option>
                    {shoots
                      .filter((shoot) => shoot.event_id === genericEventId)
                      .map((shoot) => (
                        <option key={shoot.id} value={shoot.id}>
                          {shoot.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-600">
                    Course
                  </span>
                  <select
                    value={genericCourseId}
                    onChange={(event) => {
                      setGenericCourseId(event.target.value)
                      clearScanResults()
                      setStatus("Select the participant, then scan the card")
                    }}
                    disabled={!data || identifying}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">Select course</option>
                    {data?.courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-600">
                    Participant
                  </span>
                  <select
                    value={genericMemberId}
                    onChange={(event) => {
                      setGenericMemberId(event.target.value)
                      setSaved(false)
                      setStatus(
                        imageUrl
                          ? "Assignment selected - scan the filled bubbles"
                          : "Assignment selected - take or upload the scorecard photo",
                      )
                    }}
                    disabled={
                      !genericShootId || genericParticipants.length === 0
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">
                      {genericShootId && genericParticipants.length === 0
                        ? "No assigned participants"
                        : "Select participant"}
                    </option>
                    {genericParticipants.map((participant) => (
                      <option
                        key={participant.memberId}
                        value={participant.memberId}
                      >
                        {participant.name} - Squad {participant.squad}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      Scorecard image or PDF
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Upload an image or PDF of one complete half-page card with
                      all four square markers visible
                      {mode === "assigned"
                        ? " and keep the QR code clear."
                        : "."}
                    </p>
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                    <Camera className="h-4 w-4" />
                    Take photo or upload file
                    <input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
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
                      onClick={markCorner}
                      className={`mx-auto block h-auto max-w-full rounded-md bg-white ${
                        manualMarking
                          ? "cursor-crosshair touch-manipulation"
                          : ""
                      }`}
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
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <Button
                    size="lg"
                    onClick={() => scanScorecard(false)}
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
                    onClick={() =>
                      manualMarking && markers.length === 4
                        ? scanScorecard(true)
                        : startManualMarking()
                    }
                    disabled={!imageUrl || !identity || identifying}
                    className="h-11 font-bold"
                  >
                    <ScanLine />
                    {manualMarking && markers.length === 4
                      ? "Scan with marked corners"
                      : manualMarking
                        ? "Restart corners"
                        : "Mark corners manually"}
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
                              disabled={saving}
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
                        <Button
                          variant="outline"
                          className="mt-3 w-full whitespace-nowrap"
                          disabled={saving || review === 0}
                          onClick={() => approveStation(station.station_number)}
                          aria-label={`Approve all pending bubbles as hits for station ${station.station_number}`}
                          title="Confirm orange bubbles as dead hits; keep green hits unchanged"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          {review > 0 ? "Approve All" : "Reviewed"}
                        </Button>
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
                  {mode === "assigned" ? (
                    <QrCode className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-emerald-600" />
                  )}
                  <h2 className="font-bold text-slate-950">
                    {mode === "assigned"
                      ? "Assigned card"
                      : "Manual assignment"}
                  </h2>
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
                    {mode === "assigned"
                      ? "The card details appear after its QR code is read."
                      : "Select the event, shoot, course, and participant above."}
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
