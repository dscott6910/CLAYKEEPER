import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  isDigitalScorecardConflictError,
  loadDigitalScoring,
  saveDigitalScorecard,
  type DigitalScoringData,
} from "@/lib/services/digitalScoring"

function nameOf(athlete: DigitalScoringData["athletes"][number] | undefined) {
  if (!athlete) return "Unknown Athlete"
  const first =
    athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim()
}

type OfflineDraft = {
  scores: Record<string, string>
  malfunctions: number
  verified1: string
  verified2: string
  enteredBy: string
  notes: string
  savedAt: string
  baseUpdatedAt: string | null
}

type SyncConflict = {
  draft: OfflineDraft
  serverUpdatedAt: string | null
}

function offlineDraftKey(eventId: string, memberId: string, courseId: string) {
  return `claykeeper:scoring-draft:${eventId}:${memberId}:${courseId}`
}

function formatSavedTime(value: Date | null) {
  if (!value) return "Not saved yet"
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value)
}

function formatConflictTime(value: string | null) {
  if (!value) return "No previous server save"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

export function LiveScoringPage() {
  const { eventId } = useParams()
  const [data, setData] = useState<DigitalScoringData | null>(null)
  const [shootId, setShootId] = useState("")
  const [squadId, setSquadId] = useState("")
  const [memberId, setMemberId] = useState("")
  const [courseId, setCourseId] = useState("")
  const [scores, setScores] = useState<Record<string, string>>({})
  const [malfunctions, setMalfunctions] = useState(0)
  const [verified1, setVerified1] = useState("")
  const [verified2, setVerified2] = useState("")
  const [enteredBy, setEnteredBy] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [pendingSync, setPendingSync] = useState(false)
  const [localDraftSavedAt, setLocalDraftSavedAt] = useState<Date | null>(null)
  const [syncConflict, setSyncConflict] = useState<SyncConflict | null>(null)
  const scoreInputRefs = useRef<Array<HTMLInputElement | null>>([])

  const load = useCallback(async () => {
    if (!eventId) {
      setError("Choose an event before opening live scoring.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      const next = await loadDigitalScoring(eventId)
      setData(next)
      setShootId((current) => current || next.shoots[0]?.id || "")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Scoring could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", warnBeforeLeaving)
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
  }, [dirty])

  const squads = useMemo(
    () => data?.squads.filter((row) => row.shoot_id === shootId) ?? [],
    [data, shootId],
  )

  useEffect(() => {
    setSquadId((current) =>
      squads.some((row) => row.id === current)
        ? current
        : squads[0]?.id || "",
    )
  }, [squads])

  const members = useMemo(
    () => data?.members.filter((row) => row.squad_id === squadId) ?? [],
    [data, squadId],
  )

  useEffect(() => {
    setMemberId((current) =>
      members.some((row) => row.id === current)
        ? current
        : members[0]?.id || "",
    )
  }, [members])

  const selectedSquad = data?.squads.find((row) => row.id === squadId)
  const suggestedCourse =
    data?.courses.find((row) => row.name === selectedSquad?.course_name) ??
    data?.courses[0]

  useEffect(() => {
    setCourseId(suggestedCourse?.id || "")
  }, [suggestedCourse?.id])

  const stations = useMemo(
    () =>
      data?.stations
        .filter((row) => row.course_id === courseId && row.bird_count > 0)
        .sort((a, b) => a.display_order - b.display_order) ?? [],
    [data, courseId],
  )

  const scorecard = data?.scorecards.find(
    (row) => row.squad_member_id === memberId,
  )
  const locked = scorecard?.status === "finalized"

  useEffect(() => {
    if (!data || !memberId) return

    const stationMap = new Map(
      data.stationScores
        .filter((row) => row.scorecard_id === scorecard?.id)
        .map((row) => [row.station_id, String(row.hits)]),
    )

    setScores(
      Object.fromEntries(
        stations.map((station) => [
          station.id,
          stationMap.get(station.id) ?? "",
        ]),
      ),
    )
    setMalfunctions(scorecard?.malfunction_count ?? 0)
    setVerified1(scorecard?.verified_by_1 ?? "")
    setVerified2(scorecard?.verified_by_2 ?? "")
    setEnteredBy(scorecard?.entered_by_name ?? "")
    setNotes(scorecard?.notes ?? "")

    const key = eventId && courseId
      ? offlineDraftKey(eventId, memberId, courseId)
      : ""
    const stored = key ? window.localStorage.getItem(key) : null
    if (stored && !locked) {
      try {
        const draft = JSON.parse(stored) as OfflineDraft
        const serverUpdatedAt = scorecard?.updated_at ?? null
        const baseUpdatedAt = draft.baseUpdatedAt ?? null
        const serverIsNewer = Boolean(
          serverUpdatedAt &&
            baseUpdatedAt &&
            new Date(serverUpdatedAt).getTime() >
              new Date(baseUpdatedAt).getTime(),
        )
        const serverAppearedAfterOfflineWork = Boolean(
          serverUpdatedAt && !baseUpdatedAt,
        )

        if (serverIsNewer || serverAppearedAfterOfflineWork) {
          setSyncConflict({ draft, serverUpdatedAt })
          setLocalDraftSavedAt(new Date(draft.savedAt))
          setPendingSync(false)
          setDirty(false)
          return
        }

        setSyncConflict(null)
        setScores((current) => ({ ...current, ...draft.scores }))
        setMalfunctions(draft.malfunctions)
        setVerified1(draft.verified1)
        setVerified2(draft.verified2)
        setEnteredBy(draft.enteredBy)
        setNotes(draft.notes)
        setLocalDraftSavedAt(new Date(draft.savedAt))
        setPendingSync(true)
        setDirty(true)
        return
      } catch {
        window.localStorage.removeItem(key)
      }
    }

    setSyncConflict(null)
    setPendingSync(false)
    setLocalDraftSavedAt(null)
    setDirty(false)
  }, [courseId, data, eventId, locked, memberId, scorecard?.id, stations])

  useEffect(() => {
    if (!dirty || locked || !eventId || !memberId || !courseId) return

    const draft: OfflineDraft = {
      scores,
      malfunctions,
      verified1,
      verified2,
      enteredBy,
      notes,
      savedAt: new Date().toISOString(),
      baseUpdatedAt: scorecard?.updated_at ?? null,
    }
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        offlineDraftKey(eventId, memberId, courseId),
        JSON.stringify(draft),
      )
      setLocalDraftSavedAt(new Date(draft.savedAt))
      setPendingSync(true)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [courseId, dirty, enteredBy, eventId, locked, malfunctions, memberId, notes, scorecard?.updated_at, scores, verified1, verified2])

  const participant = useMemo(() => {
    if (!data || !memberId) return null

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
    const team = data.teams.find((row) => row.id === registration?.team_id)

    return { member, athlete, team, registration }
  }, [data, memberId])

  const stationRows = stations.map((station) => {
    const raw = scores[station.id] ?? ""
    const parsed = raw === "" ? null : Number(raw)
    return { station, raw, parsed }
  })

  const enteredCount = stationRows.filter((row) => row.parsed !== null).length
  const totalScore = stationRows.reduce(
    (sum, row) => sum + (row.parsed ?? 0),
    0,
  )
  const totalTargets = stations.reduce(
    (sum, row) => sum + row.bird_count,
    0,
  )
  const progress = stations.length
    ? Math.round((enteredCount / stations.length) * 100)
    : 0
  const invalid = stationRows.filter(
    (row) =>
      row.parsed !== null &&
      (!Number.isInteger(row.parsed) ||
        row.parsed < 0 ||
        row.parsed > row.station.bird_count),
  )

  const currentMemberIndex = members.findIndex((row) => row.id === memberId)
  const previousMember =
    currentMemberIndex > 0 ? members[currentMemberIndex - 1] : undefined
  const nextMember =
    currentMemberIndex >= 0 && currentMemberIndex < members.length - 1
      ? members[currentMemberIndex + 1]
      : undefined

  const save = useCallback(
    async (
      status: "draft" | "finalized",
      options: { silent?: boolean } = {},
    ): Promise<boolean> => {
      if (!data || !eventId || !shootId || !memberId || !courseId) return false
      if (locked) {
        if (!options.silent) toast.error("This scorecard is finalized and locked.")
        return false
      }
      if (invalid.length) {
        if (!options.silent) {
          toast.error("Correct the highlighted station scores before saving.")
        }
        return false
      }
      if (status === "finalized" && enteredCount !== stations.length) {
        toast.error("Enter a score for every active station before finalizing.")
        return false
      }
      if (status === "finalized" && !enteredBy.trim()) {
        toast.error("Entered by is required before finalizing.")
        return false
      }

      if (dirty) {
        const protectedDraft: OfflineDraft = {
          scores,
          malfunctions,
          verified1,
          verified2,
          enteredBy,
          notes,
          savedAt: new Date().toISOString(),
          baseUpdatedAt: scorecard?.updated_at ?? null,
        }
        window.localStorage.setItem(
          offlineDraftKey(eventId, memberId, courseId),
          JSON.stringify(protectedDraft),
        )
        setLocalDraftSavedAt(new Date(protectedDraft.savedAt))
      }

      setSaving(true)

      try {
        await saveDigitalScorecard({
          organizationId: data.event.organization_id,
          eventId,
          shootId,
          squadMemberId: memberId,
          courseId,
          scorecardId: scorecard?.id,
          malfunctionCount: malfunctions,
          verifiedBy1: verified1,
          verifiedBy2: verified2,
          enteredByName: enteredBy,
          notes,
          status,
          expectedUpdatedAt: scorecard?.updated_at ?? null,
          stationScores: stationRows
            .filter((row) => row.parsed !== null)
            .map((row) => ({
              stationId: row.station.id,
              hits: row.parsed as number,
              targets: row.station.bird_count,
            })),
        })

        if (eventId && memberId && courseId) {
          window.localStorage.removeItem(
            offlineDraftKey(eventId, memberId, courseId),
          )
        }
        setDirty(false)
        setPendingSync(false)
        setLocalDraftSavedAt(null)
        setLastSavedAt(new Date())

        if (!options.silent) {
          toast.success(
            status === "finalized"
              ? "Scorecard finalized and locked."
              : "Draft scorecard saved.",
          )
        }

        await load()
        return true
      } catch (caught) {
        if (isDigitalScorecardConflictError(caught)) {
          setPendingSync(false)
          toast.warning(
            "A newer server scorecard was found. ClayKeeper protected your device draft instead of overwriting it.",
          )
          await load()
          return false
        }

        setPendingSync(true)
        if (!options.silent) {
          toast.error(
            caught instanceof Error
              ? caught.message
              : "Scorecard could not be saved.",
          )
        }
        return false
      } finally {
        setSaving(false)
      }
    },
    [
      courseId,
      data,
      dirty,
      enteredBy,
      enteredCount,
      eventId,
      invalid.length,
      load,
      locked,
      malfunctions,
      memberId,
      notes,
      scorecard?.id,
      scorecard?.updated_at,
      shootId,
      stationRows,
      stations.length,
      verified1,
      verified2,
    ],
  )

  useEffect(() => {
    if (!dirty || locked || saving || !memberId || !courseId || !online || syncConflict) return

    const timer = window.setTimeout(() => {
      void save("draft", { silent: true })
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [courseId, dirty, locked, memberId, online, save, saving, syncConflict])

  useEffect(() => {
    if (!online || !pendingSync || !dirty || locked || saving || syncConflict) return
    const timer = window.setTimeout(() => {
      void save("draft", { silent: true })
    }, 750)
    return () => window.clearTimeout(timer)
  }, [dirty, locked, online, pendingSync, save, saving, syncConflict])

  function keepServerVersion() {
    if (!eventId || !memberId || !courseId) return
    window.localStorage.removeItem(offlineDraftKey(eventId, memberId, courseId))
    setSyncConflict(null)
    setPendingSync(false)
    setLocalDraftSavedAt(null)
    setDirty(false)
    toast.success("Server scorecard kept. The older device draft was discarded.")
  }

  function restoreDeviceDraft() {
    if (!syncConflict) return
    const draft = syncConflict.draft
    setScores((current) => ({ ...current, ...draft.scores }))
    setMalfunctions(draft.malfunctions)
    setVerified1(draft.verified1)
    setVerified2(draft.verified2)
    setEnteredBy(draft.enteredBy)
    setNotes(draft.notes)
    setSyncConflict(null)
    setPendingSync(true)
    setDirty(true)
    toast.warning(
      "Device draft restored. Review it carefully, then save to intentionally replace the newer server draft.",
    )
  }

  function updateScore(stationId: string, value: string) {
    setScores((current) => ({
      ...current,
      [stationId]: value.replace(/[^0-9]/g, ""),
    }))
    setDirty(true)
  }

  function adjustScore(stationId: string, birdCount: number, delta: number) {
    const currentRaw = scores[stationId] ?? ""
    const current = currentRaw === "" ? 0 : Number(currentRaw)
    const next = Math.min(birdCount, Math.max(0, current + delta))
    updateScore(stationId, String(next))
  }

  async function moveToMember(targetId: string) {
    if (!targetId || saving) return

    if (dirty && !locked) {
      const saved = await save("draft")
      if (!saved) return
    }

    setMemberId(targetId)
  }

  function focusStation(index: number) {
    const target = scoreInputRefs.current[index]
    target?.focus()
    target?.select()
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading digital scoring…
        </div>
      </PageContainer>
    )
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="space-y-4 rounded-xl border bg-white p-6">
          <p>{error || "Scoring data is unavailable."}</p>
          <Link
            to="/scoring"
            className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Choose an Event
          </Link>
        </div>
      </PageContainer>
    )
  }

  const saveStateLabel = syncConflict
    ? "Sync conflict — choose a version"
    : saving
      ? "Saving…"
    : !online && pendingSync
      ? `Saved on device ${formatSavedTime(localDraftSavedAt)}`
      : pendingSync
        ? "Pending sync"
        : dirty
          ? "Unsaved changes"
          : `Saved ${formatSavedTime(lastSavedAt)}`

  return (
    <PageContainer>
      <div className="space-y-4 pb-28 md:space-y-6 md:pb-0">
        <header className="rounded-2xl border bg-white p-4 shadow-sm md:p-6">
          <Link
            to={`/events/${eventId}/operations`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Operations Center
          </Link>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">
                Mobile Tournament Scoring
              </p>
              <h1 className="mt-1 text-2xl font-bold md:text-3xl">
                Digital Score Entry
              </h1>
              <p className="mt-1 text-sm text-slate-600">{data.event.name}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${online ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {online ? "Online" : "Offline · scores stay on this device"}
              </div>
              <div
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  syncConflict
                    ? "bg-red-50 text-red-800"
                    : saving
                      ? "bg-blue-50 text-blue-700"
                    : dirty
                      ? "bg-amber-50 text-amber-800"
                      : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {syncConflict ? (
                  <CircleAlert className="h-4 w-4" />
                ) : saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : dirty ? (
                  <CircleAlert className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {saveStateLabel}
              </div>
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">
                Scorecard progress
              </span>
              <span className="font-bold text-slate-950">
                {enteredCount}/{stations.length} · {progress}%
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {syncConflict ? (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900 shadow-sm">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-black">Score sync conflict — nothing was overwritten.</p>
                <p className="mt-1">
                  This device has a locally protected draft, but the server scorecard changed after that draft began. Choose which version you want to continue with.
                </p>
                <div className="mt-3 grid gap-2 rounded-lg bg-white/70 p-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="font-bold">Device draft saved:</span>{" "}
                    {formatConflictTime(syncConflict.draft.savedAt)}
                  </div>
                  <div>
                    <span className="font-bold">Server updated:</span>{" "}
                    {formatConflictTime(syncConflict.serverUpdatedAt)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={keepServerVersion}>
                    Keep Server Version
                  </Button>
                  <Button onClick={restoreDeviceDraft}>
                    Restore Device Draft
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!online ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Connection lost — keep scoring.</p>
                <p className="mt-1">Changes are being stored on this device and will automatically sync as a draft when the connection returns. Finalizing is disabled while offline.</p>
              </div>
            </div>
          </div>
        ) : pendingSync ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Connection restored. ClayKeeper is synchronizing the locally saved scorecard.
          </div>
        ) : null}

        <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-4 md:p-5">
          <Select
            label="Shoot"
            value={shootId}
            setValue={(value) => {
              setShootId(value)
              setDirty(false)
            }}
            options={data.shoots.map((row) => ({
              value: row.id,
              label: row.name,
            }))}
          />
          <Select
            label="Squad"
            value={squadId}
            setValue={(value) => {
              setSquadId(value)
              setDirty(false)
            }}
            options={squads.map((row) => ({
              value: row.id,
              label: `Squad ${row.squad_number}`,
            }))}
          />
          <Select
            label="Athlete / Post"
            value={memberId}
            setValue={(value) => {
              void moveToMember(value)
            }}
            options={members.map((member) => {
              const enrollment = data.enrollments.find(
                (row) => row.id === member.registration_shoot_id,
              )
              const registration = data.registrations.find(
                (row) => row.id === enrollment?.registration_id,
              )
              const athlete = data.athletes.find(
                (row) => row.id === registration?.athlete_id,
              )
              return {
                value: member.id,
                label: `${member.position_label || `Post ${member.position}`} · ${nameOf(athlete)}`,
              }
            })}
          />
          <Select
            label="Course"
            value={courseId}
            setValue={(value) => {
              setCourseId(value)
              setDirty(false)
            }}
            options={data.courses.map((row) => ({
              value: row.id,
              label: row.name,
            }))}
          />
        </section>

        {!memberId || !courseId ? (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">
            Select a shoot, squad, athlete, and course to begin scoring.
          </div>
        ) : (
          <>
            <section className="sticky top-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur md:static md:shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Current athlete
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-950">
                    {nameOf(participant?.athlete)}
                  </p>
                  <p className="text-sm text-slate-600">
                    {participant?.team?.name || "No team"} · Squad {selectedSquad?.squad_number ?? "—"} · {participant?.member?.position_label || `Post ${participant?.member?.position ?? "—"}`}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Running score
                    </p>
                    <p className="text-3xl font-black tabular-nums text-slate-950">
                      {totalScore}/{totalTargets}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={!previousMember || saving}
                  onClick={() => previousMember && void moveToMember(previousMember.id)}
                  className="min-h-12"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Previous Athlete
                </Button>
                <Button
                  variant="outline"
                  disabled={!nextMember || saving}
                  onClick={() => nextMember && void moveToMember(nextMember.id)}
                  className="min-h-12"
                >
                  Next Athlete
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Summary
                label="Athlete"
                value={nameOf(participant?.athlete)}
                detail={participant?.team?.name || "No team"}
              />
              <Summary
                label="Squad / Post"
                value={`Squad ${selectedSquad?.squad_number ?? "—"}`}
                detail={
                  participant?.member?.position_label ||
                  `Post ${participant?.member?.position ?? "—"}`
                }
              />
              <Summary
                label="Score"
                value={`${totalScore} / ${totalTargets}`}
                detail={`${enteredCount} of ${stations.length} stations entered`}
              />
              <Summary
                label="Status"
                value={locked ? "Finalized" : scorecard ? "Draft" : "Not Started"}
                detail={locked ? "Locked from editing" : dirty ? "Unsaved changes" : "Editable"}
              />
            </section>

            {locked ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <Lock className="h-5 w-5" />
                This scorecard was finalized and is locked.
              </div>
            ) : null}

            {invalid.length ? (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <CircleAlert className="h-5 w-5" />
                One or more station scores exceed the configured number of birds.
              </div>
            ) : null}

            <section className="space-y-3 md:hidden">
              {stationRows.map((row, index) => {
                const running = stationRows
                  .slice(0, index + 1)
                  .reduce((sum, item) => sum + (item.parsed ?? 0), 0)
                const bad =
                  row.parsed !== null &&
                  (row.parsed < 0 ||
                    row.parsed > row.station.bird_count ||
                    !Number.isInteger(row.parsed))
                const complete = row.parsed !== null && !bad

                return (
                  <article
                    key={row.station.id}
                    className={`rounded-2xl border p-4 shadow-sm ${
                      bad
                        ? "border-red-300 bg-red-50"
                        : complete
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Station
                        </p>
                        <p className="text-2xl font-black text-slate-950">
                          {row.station.station_number}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Running total
                        </p>
                        <p className="text-2xl font-black tabular-nums">
                          {running}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[64px_1fr_64px] items-center gap-3">
                      <button
                        type="button"
                        disabled={locked || Boolean(syncConflict)}
                        onClick={() => adjustScore(row.station.id, row.station.bird_count, -1)}
                        className="min-h-16 rounded-xl border bg-white text-3xl font-black shadow-sm disabled:opacity-40"
                        aria-label={`Decrease station ${row.station.station_number} score`}
                      >
                        −
                      </button>
                      <input
                        ref={(element) => {
                          scoreInputRefs.current[index] = element
                        }}
                        disabled={locked || Boolean(syncConflict)}
                        inputMode="numeric"
                        value={row.raw}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => updateScore(row.station.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return
                          event.preventDefault()
                          focusStation(index + 1)
                        }}
                        className={`min-h-20 w-full rounded-xl border px-3 text-center text-4xl font-black tabular-nums ${
                          bad
                            ? "border-red-400 bg-red-50"
                            : complete
                              ? "border-emerald-400 bg-white"
                              : "bg-white"
                        }`}
                      />
                      <button
                        type="button"
                        disabled={locked || Boolean(syncConflict)}
                        onClick={() => adjustScore(row.station.id, row.station.bird_count, 1)}
                        className="min-h-16 rounded-xl border bg-white text-3xl font-black shadow-sm disabled:opacity-40"
                        aria-label={`Increase station ${row.station.station_number} score`}
                      >
                        +
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={locked || Boolean(syncConflict)}
                        onClick={() => updateScore(row.station.id, "0")}
                        className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold disabled:opacity-40"
                      >
                        Set 0
                      </button>
                      <button
                        type="button"
                        disabled={locked || Boolean(syncConflict)}
                        onClick={() => updateScore(row.station.id, String(row.station.bird_count))}
                        className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold disabled:opacity-40"
                      >
                        Hit All ({row.station.bird_count})
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm">
                      <span>
                        Targets: <strong>{row.station.bird_count}</strong>
                      </span>
                      <span>
                        Misses: <strong>{row.parsed === null ? "—" : row.station.bird_count - row.parsed}</strong>
                      </span>
                    </div>

                    {row.station.notes ? (
                      <p className="mt-3 text-sm text-slate-600">
                        {row.station.notes}
                      </p>
                    ) : null}
                  </article>
                )
              })}
            </section>

            <section className="hidden overflow-hidden rounded-2xl border bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-4">Station</th>
                      <th className="p-4">Available Birds</th>
                      <th className="p-4">Hits</th>
                      <th className="p-4">Misses</th>
                      <th className="p-4">Running Total</th>
                      <th className="p-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stationRows.map((row, index) => {
                      const running = stationRows
                        .slice(0, index + 1)
                        .reduce((sum, item) => sum + (item.parsed ?? 0), 0)
                      const bad =
                        row.parsed !== null &&
                        (row.parsed < 0 ||
                          row.parsed > row.station.bird_count ||
                          !Number.isInteger(row.parsed))
                      const complete = row.parsed !== null && !bad

                      return (
                        <tr
                          key={row.station.id}
                          className={complete ? "bg-emerald-50/30" : ""}
                        >
                          <td className="p-4 font-bold">
                            {row.station.station_number}
                          </td>
                          <td className="p-4">{row.station.bird_count}</td>
                          <td className="p-4">
                            <input
                              ref={(element) => {
                                scoreInputRefs.current[index] = element
                              }}
                              disabled={locked || Boolean(syncConflict)}
                              inputMode="numeric"
                              value={row.raw}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) => updateScore(row.station.id, event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") return
                                event.preventDefault()
                                focusStation(index + 1)
                              }}
                              className={`h-14 w-28 rounded-lg border px-3 text-center text-2xl font-black ${
                                bad
                                  ? "border-red-400 bg-red-50"
                                  : complete
                                    ? "border-emerald-400 bg-emerald-50"
                                    : ""
                              }`}
                            />
                          </td>
                          <td className="p-4 text-lg font-semibold">
                            {row.parsed === null
                              ? "—"
                              : row.station.bird_count - row.parsed}
                          </td>
                          <td className="p-4 text-lg font-bold">{running}</td>
                          <td className="p-4 text-slate-500">
                            {row.station.notes || "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2 md:p-5 xl:grid-cols-4">
              <label>
                <span className="text-sm font-semibold">Malfunctions (0–3)</span>
                <input
                  disabled={locked || Boolean(syncConflict)}
                  type="number"
                  min={0}
                  max={3}
                  value={malfunctions}
                  onChange={(event) => {
                    setMalfunctions(
                      Math.min(3, Math.max(0, Number(event.target.value))),
                    )
                    setDirty(true)
                  }}
                  className="mt-1 min-h-12 w-full rounded-lg border px-3 text-lg"
                />
              </label>
              <Field
                label="Verified by #1"
                value={verified1}
                setValue={(value) => {
                  setVerified1(value)
                  setDirty(true)
                }}
                disabled={locked || Boolean(syncConflict)}
              />
              <Field
                label="Verified by #2"
                value={verified2}
                setValue={(value) => {
                  setVerified2(value)
                  setDirty(true)
                }}
                disabled={locked || Boolean(syncConflict)}
              />
              <Field
                label="Entered by"
                value={enteredBy}
                setValue={(value) => {
                  setEnteredBy(value)
                  setDirty(true)
                }}
                disabled={locked || Boolean(syncConflict)}
              />
              <label className="md:col-span-2 xl:col-span-4">
                <span className="text-sm font-semibold">Notes</span>
                <textarea
                  disabled={locked || Boolean(syncConflict)}
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value)
                    setDirty(true)
                  }}
                  className="mt-1 min-h-24 w-full rounded-lg border p-3"
                />
              </label>
            </section>

            <div className="hidden flex-wrap justify-end gap-2 md:flex">
              <Button
                variant="outline"
                onClick={() => void save("draft")}
                disabled={saving || locked || Boolean(syncConflict)}
              >
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              <Button
                onClick={() => void save("finalized")}
                disabled={saving || locked || Boolean(syncConflict) || stations.length === 0 || !online}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Finalize Scorecard
              </Button>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
              <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => void save("draft")}
                  disabled={saving || locked || Boolean(syncConflict)}
                  className="min-h-12"
                >
                  <Save className="h-5 w-5" />
                  Save Draft
                </Button>
                <Button
                  onClick={() => void save("finalized")}
                  disabled={saving || locked || Boolean(syncConflict) || stations.length === 0 || !online}
                  className="min-h-12"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  Finalize
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  )
}

function Select(props: {
  label: string
  value: string
  setValue: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label>
      <span className="text-sm font-semibold">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.setValue(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-lg border bg-white px-3 text-base"
      >
        <option value="">Select…</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Field(props: {
  label: string
  value: string
  setValue: (value: string) => void
  disabled: boolean
}) {
  return (
    <label>
      <span className="text-sm font-semibold">{props.label}</span>
      <input
        disabled={props.disabled}
        value={props.value}
        onChange={(event) => props.setValue(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
      />
    </label>
  )
}

function Summary(props: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {props.label}
      </p>
      <p className="mt-1 text-xl font-black">{props.value}</p>
      <p className="mt-1 text-xs text-slate-500">{props.detail}</p>
    </div>
  )
}
