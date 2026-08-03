import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import {
  Camera,
  CircleAlert,
  RotateCcw,
  ScanLine,
  Upload,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import {
  analyzeGridScorecard,
  detectRegistrationMarkers,
  warpUsingMarkerTemplate,
  type GridCellReading,
  type GridCellState,
  type RegistrationMarker,
} from "@/lib/scorecards/gridScorecardDetector"

const TEMPLATE = {
  markerCenters: [
    { x: 0.040, y: 0.060 },
    { x: 0.960, y: 0.060 },
    { x: 0.960, y: 0.940 },
    { x: 0.040, y: 0.940 },
  ] as const,
  blocks: [
    {
      stations: [1, 2, 3, 4, 5, 6, 7, 8],
      x: 0.055,
      y: 0.430,
      width: 0.435,
      height: 0.420,
      stationColumnWidth: 0.048,
      totalColumnWidth: 0.055,
      headerHeight: 0.043,
    },
    {
      stations: [9, 10, 11, 12, 13, 14, 15],
      x: 0.510,
      y: 0.430,
      width: 0.435,
      height: 0.420,
      stationColumnWidth: 0.048,
      totalColumnWidth: 0.055,
      headerHeight: 0.043,
    },
  ],
}

export function ScorecardScanLabPage() {
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const correctedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const correctedImageRef = useRef<ImageData | null>(null)

  const [imageUrl, setImageUrl] = useState("")
  const [markers, setMarkers] = useState<RegistrationMarker[]>([])
  const [readings, setReadings] = useState<GridCellReading[]>([])
  const [overrides, setOverrides] = useState<
    Record<string, GridCellState>
  >({})
  const [status, setStatus] = useState(
    "Ready for a V4 grid scorecard photo",
  )
  const [error, setError] = useState("")

  function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.")
      return
    }

    const nextUrl = URL.createObjectURL(file)

    setImageUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return nextUrl
    })

    setMarkers([])
    setReadings([])
    setOverrides({})
    correctedImageRef.current = null
    setStatus("Photo loaded - tap Scan Grid Scorecard")
    setError("")
  }

  function drawSource(nextMarkers = markers) {
    const canvas = sourceCanvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const maxWidth = 1400
    const scale = Math.min(1, maxWidth / image.naturalWidth)

    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)

    const context = canvas.getContext("2d")
    if (!context) return

    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    nextMarkers.forEach((marker, index) => {
      context.strokeStyle = "#10b981"
      context.lineWidth = 5
      context.strokeRect(
        marker.bounds.x,
        marker.bounds.y,
        marker.bounds.width,
        marker.bounds.height,
      )

      context.beginPath()
      context.arc(
        marker.center.x,
        marker.center.y,
        12,
        0,
        Math.PI * 2,
      )
      context.fillStyle = "#10b981"
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

    const context = canvas.getContext("2d")
    if (!context) return

    canvas.width = corrected.width
    canvas.height = corrected.height
    context.putImageData(corrected, 0, 0)
  }

  function scanScorecard() {
    const sourceCanvas = sourceCanvasRef.current
    const correctedCanvas = correctedCanvasRef.current

    if (!sourceCanvas || !correctedCanvas || !imageRef.current) {
      setError("Take or upload a V4 grid scorecard photo first.")
      return
    }

    const sourceContext = sourceCanvas.getContext("2d")
    if (!sourceContext) return

    drawSource([])

    const source = sourceContext.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    )

    setStatus("Finding registration markers...")

    const foundMarkers = detectRegistrationMarkers(source)

    if (foundMarkers.length !== 4) {
      setMarkers([])
      setReadings([])
      setStatus("Scan needs another photo")
      setError(
        "Could not find all four registration markers. Keep the complete half-card visible and photograph it a little closer.",
      )
      return
    }

    setMarkers(foundMarkers)
    drawSource(foundMarkers)

    try {
      setStatus("Aligning V4 grid template...")

      const corrected = warpUsingMarkerTemplate(
        source,
        foundMarkers.map((marker) => marker.center),
        TEMPLATE.markerCenters,
      )

      correctedImageRef.current = corrected
      correctedCanvas.width = corrected.width
      correctedCanvas.height = corrected.height
      correctedCanvas
        .getContext("2d")
        ?.putImageData(corrected, 0, 0)

      setStatus("Recognizing X marks...")

      const nextReadings = analyzeGridScorecard(corrected, TEMPLATE)

      setReadings(nextReadings)
      setOverrides({})
      setError("")
      setStatus("Scan complete - review the X marks")
    } catch (nextError) {
      setStatus("Scan failed")
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to process the grid scorecard.",
      )
    }
  }

  function cycleReading(reading: GridCellReading) {
    const key = `${reading.station}-${reading.bird}`
    const current = overrides[key] ?? reading.state
    const next: GridCellState =
      current === "blank"
        ? "hit"
        : current === "hit"
          ? "review"
          : "blank"

    setOverrides((currentOverrides) => ({
      ...currentOverrides,
      [key]: next,
    }))
  }

  function reset() {
    setMarkers([])
    setReadings([])
    setOverrides({})
    correctedImageRef.current = null
    setError("")
    setStatus("Ready for a V4 grid scorecard photo")

    const correctedCanvas = correctedCanvasRef.current
    if (correctedCanvas) {
      correctedCanvas.width = 0
      correctedCanvas.height = 0
    }
  }

  useEffect(() => {
    if (!imageUrl) return

    const image = new Image()

    image.onload = () => {
      imageRef.current = image
      drawSource([])
    }

    image.onerror = () => {
      setError("The selected image could not be loaded.")
    }

    image.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    drawSource()
  }, [markers])

  useEffect(() => {
    if (correctedImageRef.current) drawCorrected()
  }, [readings, overrides])

  const interpretedReadings = useMemo(
    () =>
      readings.map((reading) => {
        const key = `${reading.station}-${reading.bird}`

        return {
          ...reading,
          state: overrides[key] ?? reading.state,
        }
      }),
    [readings, overrides],
  )

  const summary = useMemo(() => {
    const hits = interpretedReadings.filter(
      (reading) => reading.state === "hit",
    ).length
    const review = interpretedReadings.filter(
      (reading) => reading.state === "review",
    ).length

    return {
      hits,
      review,
      total: interpretedReadings.length,
      percentage:
        interpretedReadings.length > 0
          ? (hits / interpretedReadings.length) * 100
          : 0,
    }
  }, [interpretedReadings])

  const stationTotals = useMemo(
    () =>
      Array.from({ length: 15 }, (_, index) => {
        const station = index + 1
        const cells = interpretedReadings.filter(
          (reading) => reading.station === station,
        )

        return {
          station,
          hits: cells.filter((reading) => reading.state === "hit")
            .length,
          review: cells.filter(
            (reading) => reading.state === "review",
          ).length,
          cells,
        }
      }),
    [interpretedReadings],
  )

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader
        title="Scorecard Grid Scan Lab"
        description="X-mark recognition - testing only"
      />

      <PageContainer>
        <div className="space-y-6">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">No official scores are saved</p>
                <p className="mt-1">
                  This test scanner counts a clear handwritten X as a hit
                  and leaves blank cells as misses.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      V4 Grid Scorecard Photo
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Photograph one complete half-page card with all four
                      finder markers visible.
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
                    <Camera className="h-4 w-4" />
                    Take or Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={loadFile}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="mt-5 overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-2">
                  {imageUrl ? (
                    <canvas
                      ref={sourceCanvasRef}
                      className="mx-auto block h-auto max-w-full rounded-xl bg-white"
                    />
                  ) : (
                    <div className="flex min-h-96 flex-col items-center justify-center text-center text-slate-500">
                      <Upload className="h-10 w-10" />
                      <p className="mt-3 font-semibold">
                        No grid scorecard photo selected
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <button
                    type="button"
                    onClick={scanScorecard}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
                  >
                    <ScanLine className="h-4 w-4" />
                    Scan Grid Scorecard
                  </button>

                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">
                  {status}
                </div>

                {error ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Straightened Scorecard
                </h2>

                <div className="mt-5 overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-2">
                  <canvas
                    ref={correctedCanvasRef}
                    className="mx-auto block h-auto max-w-full rounded-xl bg-white"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Station Review
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tap a numbered cell to cycle Blank - Hit - Review.
                </p>

                {readings.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    Scan a V4 scorecard to see station results.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stationTotals.map((station) => (
                      <div
                        key={station.station}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Station {station.station}
                            </p>
                            <p className="mt-1 text-2xl font-black text-slate-950">
                              {station.hits} / 6
                            </p>
                          </div>

                          {station.review > 0 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                              {station.review} review
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {station.cells.map((reading) => (
                            <button
                              key={`${reading.station}-${reading.bird}`}
                              type="button"
                              onClick={() => cycleReading(reading)}
                              title={`X score ${reading.score.toFixed(3)}`}
                              className={
                                reading.state === "hit"
                                  ? "h-9 w-9 rounded-md border-2 border-emerald-600 bg-emerald-100 text-xs font-bold text-emerald-800"
                                  : reading.state === "review"
                                    ? "h-9 w-9 rounded-md border-2 border-amber-500 bg-amber-100 text-xs font-bold text-amber-800"
                                    : "h-9 w-9 rounded-md border-2 border-slate-300 bg-white text-xs font-bold text-slate-600"
                              }
                            >
                              {reading.bird}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Test Score
                </h2>

                <p className="mt-5 text-5xl font-black text-slate-950">
                  {summary.hits}
                  <span className="text-2xl text-slate-400">
                    {" "}/ {summary.total || 90}
                  </span>
                </p>

                <p className="mt-2 text-lg font-bold text-emerald-700">
                  {summary.percentage.toFixed(1)}%
                </p>

                <div className="mt-5 space-y-3 text-sm">
                  <SummaryRow
                    label="Markers detected"
                    value={`${markers.length} / 4`}
                  />
                  <SummaryRow
                    label="Cells analyzed"
                    value={summary.total}
                  />
                  <SummaryRow label="X hits" value={summary.hits} />
                  <SummaryRow
                    label="Needs review"
                    value={summary.review}
                  />
                </div>
              </section>
            </div>
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
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <strong className="text-slate-950">{value}</strong>
    </div>
  )
}