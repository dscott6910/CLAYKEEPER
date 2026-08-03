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
  analyzeOmrTemplate,
  detectRegistrationMarkers,
  warpUsingMarkerTemplate,
  type BubbleReading,
  type BubbleState,
  type RegistrationMarker,
} from "@/lib/scorecards/omrAutoDetector"

/*
 * These values are measured from the V3 half-page card.
 * Finder centers and bubble centers are normalized to the complete card.
 */
const MARKER_TEMPLATE = {
  topLeft: { x: 0.058, y: 0.092 },
  topRight: { x: 0.942, y: 0.092 },
  bottomRight: { x: 0.942, y: 0.905 },
  bottomLeft: { x: 0.058, y: 0.905 },
}

const TEMPLATE = {
  stationCount: 15,
  birdsPerStation: 6,
  firstBubbleX: 0.283,
  lastBubbleX: 0.706,
  firstBubbleY: 0.272,
  lastBubbleY: 0.806,
  sampleRadius: 0.007,
  backgroundRadius: 0.017,
}

export function ScorecardScanLabPage() {
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const correctedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const correctedImageRef = useRef<ImageData | null>(null)

  const [imageUrl, setImageUrl] = useState("")
  const [markers, setMarkers] = useState<RegistrationMarker[]>([])
  const [readings, setReadings] = useState<BubbleReading[]>([])
  const [overrides, setOverrides] = useState<Record<string, BubbleState>>({})
  const [threshold, setThreshold] = useState(0)
  const [band, setBand] = useState(0)
  const [status, setStatus] = useState("Ready for a scorecard photo")
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
    setStatus("Photo loaded — tap Scan Scorecard")
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
      context.arc(marker.center.x, marker.center.y, 12, 0, Math.PI * 2)
      context.fillStyle = "#10b981"
      context.fill()
      context.fillStyle = "#ffffff"
      context.font = "bold 13px sans-serif"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(String(index + 1), marker.center.x, marker.center.y)
    })
  }

  function drawCorrected(nextReadings = readings) {
    const canvas = correctedCanvasRef.current
    const corrected = correctedImageRef.current
    if (!canvas || !corrected) return

    const context = canvas.getContext("2d")
    if (!context) return

    canvas.width = corrected.width
    canvas.height = corrected.height
    context.putImageData(corrected, 0, 0)

    for (const reading of nextReadings) {
      const key = `${reading.stationIndex}-${reading.birdIndex}`
      const state = overrides[key] ?? reading.state

      context.beginPath()
      context.arc(
        reading.x * canvas.width,
        reading.y * canvas.height,
        11,
        0,
        Math.PI * 2,
      )

      if (state === "filled") {
        context.strokeStyle = "#059669"
        context.fillStyle = "rgba(16, 185, 129, 0.20)"
      } else if (state === "uncertain") {
        context.strokeStyle = "#d97706"
        context.fillStyle = "rgba(245, 158, 11, 0.22)"
      } else {
        context.strokeStyle = "#64748b"
        context.fillStyle = "rgba(255,255,255,0.03)"
      }

      context.lineWidth = 3
      context.fill()
      context.stroke()
    }
  }

  function scanScorecard() {
    const sourceCanvas = sourceCanvasRef.current
    const correctedCanvas = correctedCanvasRef.current

    if (!sourceCanvas || !correctedCanvas || !imageRef.current) {
      setError("Take or upload a scorecard photo first.")
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

    setStatus("Finding registration markers…")

    const foundMarkers = detectRegistrationMarkers(source)

    if (foundMarkers.length !== 4) {
      setMarkers([])
      setReadings([])
      setStatus("Scan needs another photo")
      setError(
        "Could not find all four registration markers. Keep the complete card visible and photograph it a little closer.",
      )
      return
    }

    setMarkers(foundMarkers)
    drawSource(foundMarkers)

    try {
      setStatus("Aligning scorecard template…")

      const corrected = warpUsingMarkerTemplate(
        source,
        foundMarkers.map((marker) => marker.center),
        MARKER_TEMPLATE,
      )

      correctedImageRef.current = corrected
      correctedCanvas.width = corrected.width
      correctedCanvas.height = corrected.height
      correctedCanvas
        .getContext("2d")
        ?.putImageData(corrected, 0, 0)

      setStatus("Reading bubbles…")

      const result = analyzeOmrTemplate(corrected, TEMPLATE)

      setReadings(result.readings)
      setThreshold(result.threshold)
      setBand(result.band)
      setOverrides({})
      setError("")
      setStatus("Scan complete — review the result")
    } catch (nextError) {
      setStatus("Scan failed")
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to process the scorecard.",
      )
    }
  }

  function cycleReading(reading: BubbleReading) {
    const key = `${reading.stationIndex}-${reading.birdIndex}`
    const current = overrides[key] ?? reading.state
    const next: BubbleState =
      current === "empty"
        ? "filled"
        : current === "filled"
          ? "uncertain"
          : "empty"

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
    setThreshold(0)
    setBand(0)
    setError("")
    setStatus("Ready for a scorecard photo")

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
    if (readings.length > 0) drawCorrected()
  }, [readings, overrides])

  const interpretedReadings = useMemo(
    () =>
      readings.map((reading) => {
        const key = `${reading.stationIndex}-${reading.birdIndex}`

        return {
          ...reading,
          state: overrides[key] ?? reading.state,
        }
      }),
    [readings, overrides],
  )

  const summary = useMemo(() => {
    const filled = interpretedReadings.filter(
      (reading) => reading.state === "filled",
    ).length
    const uncertain = interpretedReadings.filter(
      (reading) => reading.state === "uncertain",
    ).length

    return {
      filled,
      uncertain,
      total: interpretedReadings.length,
      percentage:
        interpretedReadings.length > 0
          ? (filled / interpretedReadings.length) * 100
          : 0,
    }
  }, [interpretedReadings])

  const stationTotals = useMemo(
    () =>
      Array.from(
        { length: TEMPLATE.stationCount },
        (_, stationIndex) => {
          const stationReadings = interpretedReadings.filter(
            (reading) => reading.stationIndex === stationIndex,
          )

          return {
            station: stationIndex + 1,
            hits: stationReadings.filter(
              (reading) => reading.state === "filled",
            ).length,
            uncertain: stationReadings.filter(
              (reading) => reading.state === "uncertain",
            ).length,
            readings: stationReadings,
          }
        },
      ),
    [interpretedReadings],
  )

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader
        title="Scorecard Auto-Scan Lab"
        description="Automatic marker alignment — testing only"
      />

      <PageContainer>
        <div className="space-y-6">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">No official scores are saved</p>
                <p className="mt-1">
                  This version aligns the known V3 card template from the
                  four finder centers before reading the fixed bubble grid.
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
                      Scorecard Photo
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Keep all four finder markers visible and fill most of
                      the camera frame with the scorecard.
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
                        No scorecard photo selected
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
                    Scan Scorecard
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
                  Corrected OMR Image
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

                {readings.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    Scan a scorecard to see station results.
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
                              {station.hits} / {TEMPLATE.birdsPerStation}
                            </p>
                          </div>

                          {station.uncertain > 0 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                              {station.uncertain} review
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {station.readings.map((reading) => (
                            <button
                              key={`${reading.stationIndex}-${reading.birdIndex}`}
                              type="button"
                              onClick={() => cycleReading(reading)}
                              title={`OMR ${reading.rawScore.toFixed(3)}`}
                              className={
                                reading.state === "filled"
                                  ? "h-9 w-9 rounded-full border-2 border-emerald-600 bg-emerald-100 text-xs font-bold text-emerald-800"
                                  : reading.state === "uncertain"
                                    ? "h-9 w-9 rounded-full border-2 border-amber-500 bg-amber-100 text-xs font-bold text-amber-800"
                                    : "h-9 w-9 rounded-full border-2 border-slate-300 bg-white text-xs font-bold text-slate-600"
                              }
                            >
                              {reading.birdIndex + 1}
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
                  {summary.filled}
                  <span className="text-2xl text-slate-400">
                    {" "}
                    / {summary.total || 90}
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
                    label="Bubbles analyzed"
                    value={summary.total}
                  />
                  <SummaryRow
                    label="Filled bubbles"
                    value={summary.filled}
                  />
                  <SummaryRow
                    label="Uncertain bubbles"
                    value={summary.uncertain}
                  />
                  <SummaryRow
                    label="Adaptive threshold"
                    value={threshold.toFixed(3)}
                  />
                  <SummaryRow
                    label="Uncertainty band"
                    value={band.toFixed(3)}
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