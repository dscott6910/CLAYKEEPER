import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CircleAlert,
  Image,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  checkInSquad,
  loadCheckInCenter,
  updateAttendance,
  updateRefund,
  type CheckInData,
  type CheckInRegistration,
} from "@/lib/services/checkInCenter"
import type { AttendanceStatus, RefundStatus } from "@/types/database"

const ATTENDANCE_OPTIONS: Array<{
  value: AttendanceStatus
  label: string
}> = [
  { value: "expected", label: "Expected" },
  { value: "checked_in", label: "Checked In" },
  { value: "late_arrival", label: "Late Arrival" },
  { value: "no_show", label: "No Show" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "disqualified", label: "Disqualified" },
]

const REFUND_OPTIONS: Array<{
  value: RefundStatus
  label: string
}> = [
  { value: "not_applicable", label: "Not Applicable" },
  { value: "pending_review", label: "Pending Review" },
  { value: "no_refund", label: "No Refund" },
  { value: "partial_refund", label: "Partial Refund" },
  { value: "full_refund_due", label: "Full Refund Due" },
  { value: "refunded", label: "Refunded" },
]

type ScanNotice = {
  kind: "success" | "warning" | "error"
  title: string
  message: string
  details?: string[]
}

type RegistrationRow = {
  registration: CheckInRegistration
  athleteName: string
  cyssa: string
  teamName: string
  squadNumber: string
  postLabel: string
}

function athleteName(athlete: CheckInData["athletes"][number] | undefined) {
  if (!athlete) return "Unknown Athlete"
  const first =
    athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim()
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0))
}

function buildRegistrationRows(data: CheckInData): RegistrationRow[] {
  const athleteMap = new Map(data.athletes.map((row) => [row.id, row]))
  const teamMap = new Map(data.teams.map((row) => [row.id, row]))
  const enrollmentMap = new Map(
    data.enrollments.map((row) => [row.registration_id, row]),
  )
  const memberMap = new Map(
    data.members.map((row) => [row.registration_shoot_id, row]),
  )
  const squadMap = new Map(data.squads.map((row) => [row.id, row]))

  return data.registrations.map((registration) => {
    const enrollment = enrollmentMap.get(registration.id)
    const member = enrollment ? memberMap.get(enrollment.id) : undefined
    const squad = member ? squadMap.get(member.squad_id) : undefined
    const athlete = athleteMap.get(registration.athlete_id)

    return {
      registration,
      athleteName: athleteName(athlete),
      cyssa: athlete?.cyssa_number ?? "",
      teamName: registration.team_id
        ? teamMap.get(registration.team_id)?.name ?? "Unassigned"
        : "Unassigned",
      squadNumber: squad?.squad_number ?? "",
      postLabel:
        member?.position_label ?? (member ? `Post ${member.position}` : ""),
    }
  })
}

export function CheckInCenterPage() {
  const { eventId } = useParams()
  const [data, setData] = useState<CheckInData | null>(null)
  const [search, setSearch] = useState("")
  const [teamFilter, setTeamFilter] = useState("")
  const [squadFilter, setSquadFilter] = useState("")
  const [attendanceFilter, setAttendanceFilter] = useState("")
  const [editing, setEditing] = useState<CheckInRegistration | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState("")
  const [error, setError] = useState("")
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanNotice, setScanNotice] = useState<ScanNotice | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError("")

    try {
      setData(await loadCheckInCenter(eventId))
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load check-in.",
      )
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!scanNotice) return
    const timer = window.setTimeout(() => setScanNotice(null), 6500)
    return () => window.clearTimeout(timer)
  }, [scanNotice])

  const allRows = useMemo(() => (data ? buildRegistrationRows(data) : []), [data])

  const rows = useMemo(() => {
    return allRows
      .filter((row) => {
        const query = search.trim().toLowerCase()
        if (
          query &&
          ![
            row.athleteName,
            row.cyssa,
            row.teamName,
            row.registration.registration_number,
            row.squadNumber,
            row.postLabel,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        ) {
          return false
        }

        if (teamFilter && row.registration.team_id !== teamFilter) return false
        if (squadFilter && row.squadNumber !== squadFilter) return false

        const attendance =
          row.registration.attendance_status ??
          (row.registration.checked_in ? "checked_in" : "expected")

        if (attendanceFilter && attendance !== attendanceFilter) return false
        return true
      })
      .sort(
        (left, right) =>
          left.squadNumber.localeCompare(right.squadNumber, undefined, {
            numeric: true,
          }) || left.athleteName.localeCompare(right.athleteName),
      )
  }, [allRows, attendanceFilter, search, squadFilter, teamFilter])

  const squads = useMemo(
    () =>
      Array.from(
        new Set(allRows.map((row) => row.squadNumber).filter(Boolean)),
      ).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      ),
    [allRows],
  )

  const stats = useMemo(() => {
    const registrations = data?.registrations ?? []
    const status = (row: CheckInRegistration) =>
      row.attendance_status ?? (row.checked_in ? "checked_in" : "expected")

    return {
      expected: registrations.filter((row) => status(row) === "expected")
        .length,
      checkedIn: registrations.filter((row) => status(row) === "checked_in")
        .length,
      late: registrations.filter((row) => status(row) === "late_arrival")
        .length,
      noShows: registrations.filter((row) => status(row) === "no_show")
        .length,
      refundsPending: registrations.filter(
        (row) =>
          row.refund_status === "pending_review" ||
          row.refund_status === "full_refund_due",
      ).length,
    }
  }, [data?.registrations])

  async function setAttendance(
    registration: CheckInRegistration,
    status: AttendanceStatus,
  ) {
    setSavingId(registration.id)
    setError("")

    try {
      await updateAttendance({
        registrationId: registration.id,
        organizationId: registration.organization_id,
        attendanceStatus: status,
      })
      await load()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Attendance could not be updated.",
      )
    } finally {
      setSavingId("")
    }
  }

  async function checkSelectedSquad() {
    if (!data || !squadFilter) return
    setSavingId("squad")

    try {
      await checkInSquad({
        organizationId: data.event.organization_id,
        registrationIds: allRows
          .filter((row) => row.squadNumber === squadFilter)
          .map((row) => row.registration.id),
      })
      await load()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Squad check-in failed.",
      )
    } finally {
      setSavingId("")
    }
  }

  async function handleQrPayload(rawValue: string) {
    if (!data || !eventId || scanBusy) return

    setScanBusy(true)
    setError("")
    setScanNotice(null)

    try {
      const trimmed = rawValue.trim()
      let registrationId = trimmed
      let payloadEventId: string | null = null

      try {
        const payload = JSON.parse(trimmed) as {
          eventId?: string
          registrationId?: string
        }
        registrationId = payload.registrationId ?? ""
        payloadEventId = payload.eventId ?? null
      } catch {
        // Plain registration IDs remain supported.
      }

      if (!registrationId) {
        throw new Error("This QR code does not contain a registration ID.")
      }

      if (payloadEventId && payloadEventId !== eventId) {
        setScanNotice({
          kind: "error",
          title: "Wrong Event",
          message: "This scorecard belongs to a different tournament.",
        })
        return
      }

      const row = allRows.find(
        (item) => item.registration.id === registrationId,
      )

      if (!row) {
        setScanNotice({
          kind: "error",
          title: "Registration Not Found",
          message:
            "This QR code is not assigned to a registered athlete in this event.",
        })
        return
      }

      const currentStatus =
        row.registration.attendance_status ??
        (row.registration.checked_in ? "checked_in" : "expected")
      const detailLines = [
        row.teamName,
        row.squadNumber ? `Squad ${row.squadNumber}` : "Unassigned squad",
        row.postLabel || "No post assigned",
      ]

      if (currentStatus === "checked_in" || currentStatus === "late_arrival") {
        setScanNotice({
          kind: "warning",
          title: "Already Checked In",
          message: row.athleteName,
          details: detailLines,
        })
        return
      }

      await updateAttendance({
        registrationId: row.registration.id,
        organizationId: row.registration.organization_id,
        attendanceStatus: "checked_in",
      })

      setScanNotice({
        kind: "success",
        title: "Athlete Checked In",
        message: row.athleteName,
        details: [...detailLines, "Checked in successfully"],
      })

      await load()
    } catch (caught) {
      setScanNotice({
        kind: "error",
        title: "QR Code Could Not Be Processed",
        message:
          caught instanceof Error
            ? caught.message
            : "The QR code could not be processed.",
      })
    } finally {
      setScanBusy(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading check-in center…
        </div>
      </PageContainer>
    )
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="rounded-xl border p-6">
          Check-in data is unavailable.
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
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Event Workspace
          </Link>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">
                Tournament Day
              </p>
              <h1 className="mt-1 text-3xl font-bold">Check-In Center</h1>
              <p className="mt-2 text-sm text-slate-600">{data.event.name}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setError("")
                  setScanNotice(null)
                  setScannerOpen(true)
                }}
                disabled={scanBusy}
              >
                <QrCode className="h-4 w-4" />
                Scan QR
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print Report
              </Button>
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {scanNotice ? (
          <ScanNoticeToast
            notice={scanNotice}
            close={() => setScanNotice(null)}
          />
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Expected" value={stats.expected} />
          <Stat label="Checked In" value={stats.checkedIn} />
          <Stat label="Late" value={stats.late} />
          <Stat label="No Shows" value={stats.noShows} />
          <Stat label="Refunds Pending" value={stats.refundsPending} />
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="relative">
              <span className="text-sm font-semibold">Search</span>
              <Search className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Participant, team, squad, participant number…"
                className="mt-1 min-h-11 w-full rounded-lg border pl-9 pr-3 text-sm"
              />
            </label>

            <label>
              <span className="text-sm font-semibold">Team</span>
              <select
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">All teams</option>
                {data.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold">Squad</span>
              <select
                value={squadFilter}
                onChange={(event) => setSquadFilter(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">All squads</option>
                {squads.map((squad) => (
                  <option key={squad} value={squad}>
                    Squad {squad}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold">Attendance</span>
              <select
                value={attendanceFilter}
                onChange={(event) => setAttendanceFilter(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">All statuses</option>
                {ATTENDANCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {squadFilter ? (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => void checkSelectedSquad()}
                disabled={savingId === "squad"}
              >
                {savingId === "squad" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                Check In Squad {squadFilter}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-4">Athlete</th>
                  <th className="p-4">Team</th>
                  <th className="p-4">Squad / Post</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Attendance</th>
                  <th className="p-4">Refund</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const attendance =
                    row.registration.attendance_status ??
                    (row.registration.checked_in
                      ? "checked_in"
                      : "expected")
                  const busy = savingId === row.registration.id

                  return (
                    <tr key={row.registration.id} className="align-top">
                      <td className="p-4">
                        <p className="font-semibold">{row.athleteName}</p>
                        <p className="text-xs text-slate-500">
                          {row.cyssa
                            ? `Participant # ${row.cyssa}`
                            : row.registration.registration_number ??
                              "No number"}
                        </p>
                      </td>
                      <td className="p-4">{row.teamName}</td>
                      <td className="p-4">
                        {row.squadNumber
                          ? `Squad ${row.squadNumber}`
                          : "Unassigned"}
                        <p className="text-xs text-slate-500">
                          {row.postLabel || "No post"}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold capitalize">
                          {row.registration.payment_status ?? "Unknown"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {money(row.registration.amount_paid)}
                        </p>
                      </td>
                      <td className="p-4">
                        <select
                          value={attendance}
                          onChange={(event) =>
                            void setAttendance(
                              row.registration,
                              event.target.value as AttendanceStatus,
                            )
                          }
                          disabled={busy}
                          className="min-h-10 rounded-lg border bg-white px-3"
                        >
                          {ATTENDANCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold">
                          {REFUND_OPTIONS.find(
                            (option) =>
                              option.value ===
                              (row.registration.refund_status ??
                                "not_applicable"),
                          )?.label ?? "Not Applicable"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {money(row.registration.refund_amount)}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              void setAttendance(
                                row.registration,
                                "checked_in",
                              )
                            }
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Check In
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(row.registration)}
                          >
                            <CircleAlert className="h-4 w-4" />
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No athletes match the selected filters.
            </div>
          ) : null}
        </section>
      </div>

      {scannerOpen ? (
        <QrScannerDialog
          close={() => setScannerOpen(false)}
          detected={(value) => {
            setScannerOpen(false)
            void handleQrPayload(value)
          }}
        />
      ) : null}

      {editing ? (
        <RefundDialog
          registration={editing}
          close={() => setEditing(null)}
          save={async (values) => {
            setSavingId(editing.id)
            try {
              await updateRefund({
                registrationId: editing.id,
                organizationId: editing.organization_id,
                ...values,
              })
              setEditing(null)
              await load()
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Refund details could not be saved.",
              )
            } finally {
              setSavingId("")
            }
          }}
        />
      ) : null}
    </PageContainer>
  )
}

function QrScannerDialog(props: {
  close: () => void
  detected: (value: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const processingRef = useRef(false)
  const mountedRef = useRef(true)
  const [cameraError, setCameraError] = useState("")
  const [starting, setStarting] = useState(true)

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop()
    } catch (caught) {
      console.warn("ClayKeeper scanner stop warning:", caught)
    }
    controlsRef.current = null

    const video = videoRef.current
    const stream = video?.srcObject

    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
    }

    if (video) {
      try {
        video.pause()
        video.srcObject = null
        video.removeAttribute("src")
        video.load()
      } catch (caught) {
        console.warn("ClayKeeper video cleanup warning:", caught)
      }
    }
  }, [])

  const finishScan = useCallback(
    (value: string) => {
      if (processingRef.current) return
      processingRef.current = true
      stopCamera()
      props.close()
      window.setTimeout(() => props.detected(value), 0)
    },
    [props, stopCamera],
  )

  useEffect(() => {
    mountedRef.current = true
    const video = videoRef.current
    if (!video) return

    let cancelled = false

    async function startCamera() {
      try {
        setStarting(true)
        setCameraError("")

        const { BrowserQRCodeReader } = await import("@zxing/browser")
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video ?? undefined,
          (result) => {
            if (result && !cancelled) finishScan(result.getText())
          },
        )

        if (cancelled || processingRef.current) {
          controls.stop()
          return
        }

        controlsRef.current = controls
      } catch (caught) {
        stopCamera()
        if (mountedRef.current) {
          setCameraError(
            caught instanceof Error
              ? caught.message
              : "Camera access could not be started.",
          )
        }
      } finally {
        if (mountedRef.current) setStarting(false)
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      mountedRef.current = false
      stopCamera()
    }
  }, [finishScan, stopCamera])

  async function scanImage(file: File | null) {
    if (!file) {
      setCameraError("No photo was selected.")
      return
    }

    stopCamera()
    setStarting(true)
    setCameraError(`Opening ${file.name}…`)

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result)
          else reject(new Error("The selected photo could not be read."))
        }
        reader.onerror = () =>
          reject(
            reader.error ?? new Error("The selected photo could not be read."),
          )
        reader.readAsDataURL(file)
      })

      setCameraError("Looking for a QR code in the selected photo…")
      const { BrowserQRCodeReader } = await import("@zxing/browser")
      const reader = new BrowserQRCodeReader()
      const result = await reader.decodeFromImageUrl(dataUrl)
      const decodedText = result.getText().trim()

      if (!decodedText) throw new Error("The QR code did not contain any data.")
      finishScan(decodedText)
    } catch (caught) {
      console.error("ClayKeeper photo QR scan error:", caught)
      setCameraError(
        `${
          caught instanceof Error && caught.message
            ? caught.message
            : "No readable QR code was found."
        } Try cropping the picture so the QR code fills most of the image.`,
      )
    } finally {
      if (mountedRef.current) setStarting(false)
    }
  }

  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.item(0) ?? null
    try {
      await scanImage(file)
    } finally {
      input.value = ""
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-4">
      <div className="mx-auto my-6 max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-xl font-bold">Scan Scorecard QR</h2>
            <p className="mt-1 text-sm text-slate-500">
              Point the camera at the QR code printed on the athlete scorecard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera()
              props.close()
            }}
            className="rounded-lg border p-2 text-slate-600"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            {starting ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Starting camera…
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-4 border-white/80" />
          </div>

          {cameraError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {cameraError}
            </div>
          ) : null}

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold hover:bg-slate-50">
            <Image className="h-4 w-4" />
            Scan QR from a photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handlePhotoSelection(event)}
            />
          </label>

          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <Camera className="mt-0.5 h-4 w-4 shrink-0" />
            The camera closes immediately after any QR code is read.
          </div>
        </div>
      </div>
    </div>
  )
}

function ScanNoticeToast(props: {
  notice: ScanNotice
  close: () => void
}) {
  const styles =
    props.notice.kind === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
      : props.notice.kind === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-red-300 bg-red-50 text-red-950"

  const iconStyles =
    props.notice.kind === "success"
      ? "bg-emerald-600"
      : props.notice.kind === "warning"
        ? "bg-amber-600"
        : "bg-red-600"

  return (
    <div className="fixed inset-x-4 top-5 z-[100] mx-auto max-w-md">
      <div
        role="status"
        aria-live="assertive"
        className={`rounded-2xl border p-5 shadow-2xl ${styles}`}
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 text-white ${iconStyles}`}>
            {props.notice.kind === "success" ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <CircleAlert className="h-6 w-6" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold">{props.notice.title}</h3>
            <p className="mt-1 text-sm font-semibold">
              {props.notice.message}
            </p>
            {props.notice.details?.length ? (
              <div className="mt-2 space-y-0.5 text-sm opacity-85">
                {props.notice.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={props.close}
            className="rounded-lg p-1 hover:bg-white/50"
            aria-label="Close scan message"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function RefundDialog(props: {
  registration: CheckInRegistration
  close: () => void
  save: (values: {
    refundStatus: RefundStatus
    refundAmount: number
    refundReason: string
    refundNotes: string
  }) => Promise<void>
}) {
  const [status, setStatus] = useState<RefundStatus>(
    props.registration.refund_status ?? "not_applicable",
  )
  const [amount, setAmount] = useState(
    String(props.registration.refund_amount ?? 0),
  )
  const [reason, setReason] = useState(
    props.registration.refund_reason ?? "",
  )
  const [notes, setNotes] = useState(props.registration.refund_notes ?? "")

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4">
      <div className="mx-auto my-8 max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="border-b p-5">
          <h2 className="text-xl font-bold">Refund Details</h2>
        </div>
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="text-sm font-semibold">Refund status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as RefundStatus)
              }
              className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"
            >
              {REFUND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Refund amount</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Reason</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 min-h-24 w-full rounded-lg border p-3"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t p-5">
          <Button variant="outline" onClick={props.close}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              void props.save({
                refundStatus: status,
                refundAmount: Number(amount || 0),
                refundReason: reason,
                refundNotes: notes,
              })
            }
          >
            Save Details
          </Button>
        </div>
      </div>
    </div>
  )
}

function Stat(props: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-black">{props.value}</p>
    </div>
  )
}