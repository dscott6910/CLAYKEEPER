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
  CloudUpload,
  Download,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react"
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { toast } from "sonner"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  isDigitalScorecardConflictError,
  loadDigitalScoring,
  saveDigitalScorecard,
  type DigitalScoringData,
} from "@/lib/services/digitalScoring"
import {
  cacheScoringEvent,
  cacheScoringAppForOffline,
  deleteOfflineScorecardDraft,
  getCachedScoringEvent,
  getOfflineScorecardDraft,
  listOfflineScorecardDrafts,
  offlineScorecardKey,
  putOfflineScorecardDraft,
  requestPersistentOfflineStorage,
  type OfflineScorecardDraft,
} from "@/lib/services/offlineDigitalScoring"

function nameOf(athlete: DigitalScoringData["athletes"][number] | undefined) {
  if (!athlete) return "Unknown participant"
  const first =
    athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim()
}

type SyncConflict = {
  draft: OfflineScorecardDraft
  serverUpdatedAt: string | null
}

const ALL_SQUADS = "__all_squads__"
type MemberSort = "squad" | "name" | "status"

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

function legacyOfflineDraftKey(eventId: string, memberId: string, courseId: string) {
  return `claykeeper:scoring-draft:${eventId}:${memberId}:${courseId}`
}

function scoringSelectionKey(eventId: string) {
  return `claykeeper:digital-scoring-selection:${eventId}`
}

function readScoringSelection(eventId: string) {
  if (!eventId) return {}
  try {
    return JSON.parse(
      window.localStorage.getItem(scoringSelectionKey(eventId)) ?? "{}",
    ) as { shootId?: string; squadId?: string; memberId?: string }
  } catch {
    return {}
  }
}

function isLikelyConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|load failed|network|offline|connection/i.test(message)
}

export function DigitalScoringPage() {
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const storedSelection = useMemo(
    () => readScoringSelection(eventId ?? ""),
    [eventId],
  )

  const requestedShootId =
    storedSelection.shootId || searchParams.get("shootId") || ""
  const requestedMemberId =
    storedSelection.memberId || searchParams.get("memberId") || ""
  const requestedCourseId =
    searchParams.get("courseId") ?? ""

  const [data, setData] = useState<DigitalScoringData | null>(null)
  const [shootId, setShootId] = useState("")
  const [squadId, setSquadId] = useState(ALL_SQUADS)
  const [memberId, setMemberId] = useState("")
  const [memberSort, setMemberSort] = useState<MemberSort>("squad")
  const [courseId, setCourseId] = useState("")
  const [scores, setScores] = useState<Record<string, string>>({})
  const [stationNotes, setStationNotes] = useState<Record<string, string>>({})
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
  const [queuedStatus, setQueuedStatus] = useState<"draft" | "finalized">("draft")
  const [queuedCount, setQueuedCount] = useState(0)
  const [syncingQueue, setSyncingQueue] = useState(false)
  const [queueSyncBlocked, setQueueSyncBlocked] = useState(false)
  const [preparingOffline, setPreparingOffline] = useState(false)
  const [offlineCachedAt, setOfflineCachedAt] = useState<Date | null>(null)
  const [usingOfflineData, setUsingOfflineData] = useState(false)
  const [localDraftSavedAt, setLocalDraftSavedAt] = useState<Date | null>(null)
  const [syncConflict, setSyncConflict] = useState<SyncConflict | null>(null)
  const [lastSaveError, setLastSaveError] = useState("")
  const enteredByInputRef = useRef<HTMLInputElement | null>(null)
  const [lastServerConfirmation, setLastServerConfirmation] = useState<{
    at: Date
    status: "draft" | "finalized"
    score: number
    targets: number
  } | null>(null)
  const scoreInputRefs = useRef<Array<HTMLInputElement | null>>([])
  const stationCardRefs = useRef<Array<HTMLElement | null>>([])
  const selectionRef = useRef({ shootId: "", squadId: ALL_SQUADS, memberId: "" })

  const recordLastSaveError = useCallback((message: string) => {
    setLastSaveError(message)
  }, [])

  useEffect(() => {
    selectionRef.current = { shootId, squadId, memberId }
    if (eventId && shootId && memberId) {
      window.localStorage.setItem(
        scoringSelectionKey(eventId),
        JSON.stringify({ shootId, squadId, memberId }),
      )
    }
  }, [eventId, memberId, shootId, squadId])

  const refreshQueuedCount = useCallback(async () => {
    if (!eventId) return
    const drafts = await listOfflineScorecardDrafts(eventId)
    setQueuedCount(drafts.length)
  }, [eventId])

  const load = useCallback(async (options: { silent?: boolean; resetSquads?: boolean } = {}) => {
    if (options.resetSquads) {
      selectionRef.current.squadId = ALL_SQUADS
      setSquadId(ALL_SQUADS)
    }
    if (!eventId) {
      if (!options.silent) setError("Choose an event before opening digital scoring.")
      setLoading(false)
      return false
    }

    setLoading(true)
    setError("")

    try {
      let next: DigitalScoringData

      try {
        if (!navigator.onLine) throw new Error("The device is offline.")
        next = await loadDigitalScoring(eventId)
        const cached = await cacheScoringEvent(next)
        await cacheScoringAppForOffline().catch(() => undefined)
        setOfflineCachedAt(new Date(cached.cachedAt))
        setUsingOfflineData(false)
        setQueueSyncBlocked(false)
      } catch (caught) {
        const cached = await getCachedScoringEvent(eventId)
        if (!cached) throw caught
        next = cached.data
        setOfflineCachedAt(new Date(cached.cachedAt))
        setUsingOfflineData(true)
      }

      const preferredMemberId =
        selectionRef.current.memberId || requestedMemberId
      const requestedMember = preferredMemberId
        ? next.members.find(
            (row) => row.id === preferredMemberId,
          )
        : undefined

      const requestedSquad = requestedMember
        ? next.squads.find(
            (row) => row.id === requestedMember.squad_id,
          )
        : undefined

      const preferredShootId =
        selectionRef.current.shootId || requestedShootId
      const requestedShoot =
        requestedSquad &&
        next.shoots.some(
          (row) =>
            row.id === requestedSquad.shoot_id &&
            (
              !preferredShootId ||
              row.id === preferredShootId
            ),
        )
          ? requestedSquad.shoot_id
          : preferredShootId &&
              next.shoots.some(
                (row) => row.id === preferredShootId,
              )
            ? preferredShootId
            : ""

      const requestedCourse =
        requestedCourseId &&
        next.courses.some(
          (row) => row.id === requestedCourseId,
        )
          ? requestedCourseId
          : ""

      setData(next)

      if (
        requestedMember &&
        requestedSquad &&
        requestedShoot
      ) {
        setShootId(requestedShoot)
        setSquadId(
          selectionRef.current.squadId === ALL_SQUADS
            ? ALL_SQUADS
            : requestedSquad.id,
        )
        setMemberId(requestedMember.id)

        if (requestedCourse) {
          setCourseId(requestedCourse)
        }

        return true
      }

      setShootId(
        (current) =>
          current ||
          requestedShoot ||
          next.shoots[0]?.id ||
          "",
      )
      return true
    } catch (caught) {
      if (!options.silent) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Scoring could not be loaded.",
        )
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [
    eventId,
    requestedCourseId,
    requestedMemberId,
    requestedShootId,
  ])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void refreshQueuedCount()
  }, [refreshQueuedCount])

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      setQueueSyncBlocked(false)
    }
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
    () =>
      [...(data?.squads.filter((row) => row.shoot_id === shootId) ?? [])].sort(
        (left, right) =>
          Number(left.squad_number) - Number(right.squad_number) ||
          left.squad_number.localeCompare(right.squad_number),
      ),
    [data, shootId],
  )

  useEffect(() => {
    setSquadId((current) =>
      current === ALL_SQUADS || squads.some((row) => row.id === current)
        ? current
        : ALL_SQUADS,
    )
  }, [squads])

  const members = useMemo(() => {
    if (!data) return []
    const squadById = new Map(data.squads.map((row) => [row.id, row]))
    const athleteByMemberId = new Map(
      data.members.map((member) => {
        const enrollment = data.enrollments.find(
          (row) => row.id === member.registration_shoot_id,
        )
        const registration = data.registrations.find(
          (row) => row.id === enrollment?.registration_id,
        )
        return [member.id, data.athletes.find((row) => row.id === registration?.athlete_id)]
      }),
    )
    const eligibleSquadIds = new Set(squads.map((row) => row.id))
    const filtered = data.members.filter((row) =>
      squadId === ALL_SQUADS
        ? eligibleSquadIds.has(row.squad_id)
        : row.squad_id === squadId,
    )
    const statusRank = (member: typeof filtered[number]) => {
      const status = data.scorecards.find(
        (row) => row.squad_member_id === member.id,
      )?.status
      return status === "finalized" ? 0 : status === "draft" ? 1 : 2
    }
    const name = (member: typeof filtered[number]) =>
      nameOf(athleteByMemberId.get(member.id))
    const squadOrder = (member: typeof filtered[number]) => {
      const squad = squadById.get(member.squad_id)
      return Number(squad?.squad_number ?? 0)
    }

    return [...filtered].sort((left, right) => {
      if (memberSort === "name") {
        return (
          name(left).localeCompare(name(right)) ||
          squadOrder(left) - squadOrder(right) ||
          left.position - right.position
        )
      }
      if (memberSort === "status") {
        return (
          statusRank(left) - statusRank(right) ||
          squadOrder(left) - squadOrder(right) ||
          left.position - right.position
        )
      }
      return (
        squadOrder(left) - squadOrder(right) ||
        left.position - right.position ||
        name(left).localeCompare(name(right))
      )
    })
  }, [data, memberSort, squadId, squads])

  useEffect(() => {
    setMemberId((current) =>
      members.some((row) => row.id === current)
        ? current
        : members[0]?.id || "",
    )
  }, [members])

  const selectedSquad =
    data?.squads.find((row) => row.id === squadId) ??
    data?.squads.find((row) => row.id === members.find((row) => row.id === memberId)?.squad_id)
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

    const scorecardStationScores = data.stationScores.filter(
      (row) => row.scorecard_id === scorecard?.id,
    )
    const stationMap = new Map(
      scorecardStationScores.map((row) => [row.station_id, String(row.hits)]),
    )
    const stationNoteMap = new Map(
      scorecardStationScores.map((row) => [row.station_id, row.notes ?? ""]),
    )

    setScores(
      Object.fromEntries(
        stations.map((station) => [
          station.id,
          stationMap.get(station.id) ?? "",
        ]),
      ),
    )
    setStationNotes(
      Object.fromEntries(
        stations.map((station) => [
          station.id,
          stationNoteMap.get(station.id) ?? "",
        ]),
      ),
    )
    setMalfunctions(scorecard?.malfunction_count ?? 0)
    setVerified1(scorecard?.verified_by_1 ?? "")
    setVerified2(scorecard?.verified_by_2 ?? "")
    setEnteredBy(scorecard?.entered_by_name ?? "")
    setNotes(scorecard?.notes ?? "")

    const key = eventId && courseId
      ? offlineScorecardKey(eventId, memberId, courseId)
      : ""
    let cancelled = false

    void (async () => {
      let draft = key ? await getOfflineScorecardDraft(key) : undefined

      if (!draft && eventId && courseId) {
        const legacyKey = legacyOfflineDraftKey(eventId, memberId, courseId)
        const stored = window.localStorage.getItem(legacyKey)
        if (stored) {
          try {
            const legacy = JSON.parse(stored) as Partial<OfflineScorecardDraft>
            draft = {
              key,
              eventId,
              organizationId: data.event.organization_id,
              shootId: selectedSquad?.shoot_id ?? shootId,
              memberId,
              courseId,
              scorecardId: scorecard?.id ?? null,
              requestedStatus: "draft",
              scores: legacy.scores ?? {},
              stationNotes: legacy.stationNotes ?? {},
              stationTargets: Object.fromEntries(
                stations.map((station) => [station.id, station.bird_count]),
              ),
              malfunctions: legacy.malfunctions ?? 0,
              verified1: legacy.verified1 ?? "",
              verified2: legacy.verified2 ?? "",
              enteredBy: legacy.enteredBy ?? "",
              notes: legacy.notes ?? "",
              savedAt: legacy.savedAt ?? new Date().toISOString(),
              baseUpdatedAt: legacy.baseUpdatedAt ?? scorecard?.updated_at ?? null,
            }
            await putOfflineScorecardDraft(draft)
            window.localStorage.removeItem(legacyKey)
          } catch {
            window.localStorage.removeItem(legacyKey)
          }
        }
      }

      if (cancelled) return

      if (draft && !locked) {
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
          setQueuedStatus(draft.requestedStatus)
          setPendingSync(false)
          setDirty(false)
          return
        }

        setSyncConflict(null)
        setScores((current) => ({ ...current, ...draft.scores }))
        setStationNotes((current) => ({
          ...current,
          ...(draft.stationNotes ?? {}),
        }))
        setMalfunctions(draft.malfunctions)
        setVerified1(draft.verified1)
        setVerified2(draft.verified2)
        setEnteredBy(draft.enteredBy)
        setNotes(draft.notes)
        setLocalDraftSavedAt(new Date(draft.savedAt))
        setQueuedStatus(draft.requestedStatus)
        setPendingSync(true)
        setDirty(false)
        return
      }

      setSyncConflict(null)
      setPendingSync(false)
      setQueuedStatus("draft")
      setLocalDraftSavedAt(null)
      setDirty(false)
    })()

    return () => {
      cancelled = true
    }
  }, [courseId, data, eventId, locked, memberId, scorecard?.entered_by_name, scorecard?.id, scorecard?.malfunction_count, scorecard?.notes, scorecard?.updated_at, scorecard?.verified_by_1, scorecard?.verified_by_2, selectedSquad?.shoot_id, shootId, stations])

  useEffect(() => {
    if (!dirty || locked || !eventId || !memberId || !courseId) return

    const draft: OfflineScorecardDraft = {
      key: offlineScorecardKey(eventId, memberId, courseId),
      eventId,
      organizationId: data?.event.organization_id ?? "",
      shootId,
      memberId,
      courseId,
      scorecardId: scorecard?.id ?? null,
      requestedStatus: queuedStatus,
      scores,
      stationNotes,
      stationTargets: Object.fromEntries(
        stations.map((station) => [station.id, station.bird_count]),
      ),
      malfunctions,
      verified1,
      verified2,
      enteredBy,
      notes,
      savedAt: new Date().toISOString(),
      baseUpdatedAt: scorecard?.updated_at ?? null,
    }
    const timer = window.setTimeout(() => {
      void putOfflineScorecardDraft(draft).then(() => {
        setLocalDraftSavedAt(new Date(draft.savedAt))
        setPendingSync(true)
      })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [courseId, data?.event.organization_id, dirty, enteredBy, eventId, locked, malfunctions, memberId, notes, queuedStatus, scorecard?.id, scorecard?.updated_at, scores, shootId, stationNotes, stations, verified1, verified2])

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
    return {
      station,
      raw,
      parsed,
      note: stationNotes[station.id] ?? "",
    }
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

  const firstIncompleteStationIndex = stationRows.findIndex(
    (row) => row.parsed === null,
  )
  const firstInvalidStationIndex = stationRows.findIndex(
    (row) =>
      row.parsed !== null &&
      (!Number.isInteger(row.parsed) ||
        row.parsed < 0 ||
        row.parsed > row.station.bird_count),
  )
  const activeStationIndex =
    firstInvalidStationIndex >= 0
      ? firstInvalidStationIndex
      : firstIncompleteStationIndex >= 0
        ? firstIncompleteStationIndex
        : Math.max(0, stationRows.length - 1)

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
      recordLastSaveError("")
      if (!data || !eventId || !shootId || !memberId || !courseId) {
        recordLastSaveError("Select a shoot, participant, and course before saving.")
        if (!options.silent) toast.error("Select a shoot, participant, and course before saving.")
        return false
      }
      if (locked) {
        recordLastSaveError("This scorecard is finalized and locked.")
        if (!options.silent) toast.error("This scorecard is finalized and locked.")
        return false
      }
      if (invalid.length) {
        recordLastSaveError("Correct the highlighted station scores before saving.")
        if (!options.silent) {
          toast.error("Correct the highlighted station scores before saving.")
        }
        return false
      }
      if (status === "finalized" && enteredCount !== stations.length) {
        recordLastSaveError("Enter a score for every active station before finalizing.")
        toast.error("Enter a score for every active station before finalizing.")
        return false
      }
      if (status === "finalized" && !enteredBy.trim()) {
        recordLastSaveError("Entered by is required before finalizing. Enter the scorekeeper's name below.")
        enteredByInputRef.current?.scrollIntoView({ block: "center" })
        enteredByInputRef.current?.focus({ preventScroll: true })
        toast.error("Entered by is required before finalizing.")
        return false
      }

      selectionRef.current = { shootId, squadId, memberId }

      const protectedDraft: OfflineScorecardDraft = {
        key: offlineScorecardKey(eventId, memberId, courseId),
        eventId,
        organizationId: data.event.organization_id,
        shootId,
        memberId,
        courseId,
        scorecardId: scorecard?.id ?? null,
        requestedStatus: status,
        scores,
        stationNotes,
        stationTargets: Object.fromEntries(
          stations.map((station) => [station.id, station.bird_count]),
        ),
        malfunctions,
        verified1,
        verified2,
        enteredBy,
        notes,
        savedAt: new Date().toISOString(),
        baseUpdatedAt: scorecard?.updated_at ?? null,
      }

      if (online) setSaving(true)
      await putOfflineScorecardDraft(protectedDraft).catch(() => undefined)
      setLocalDraftSavedAt(new Date(protectedDraft.savedAt))
      setPendingSync(true)
      setQueuedStatus(status)
      await refreshQueuedCount().catch(() => undefined)

      if (!online) {
        setDirty(false)
        recordLastSaveError("")
        if (!options.silent) {
          toast.info(
            status === "finalized"
              ? "Completed scorecard saved on this device. It will finalize after upload."
              : "Draft saved on this device. It will upload automatically.",
          )
        }
        return true
      }

      let saveScorecardId = scorecard?.id
      let saveShootId = shootId
      let saveCourseId = courseId
      let expectedUpdatedAt = scorecard?.updated_at ?? null
      if (status === "finalized") {
        try {
          const latest = await loadDigitalScoring(eventId)
          const latestScorecard = latest.scorecards.find(
            (row) => row.squad_member_id === memberId,
          )
          if (latestScorecard) {
            if (latestScorecard.status === "finalized") {
              setData(latest)
              setDirty(false)
              setPendingSync(false)
              setQueuedStatus("draft")
              setLocalDraftSavedAt(null)
              recordLastSaveError("")
              setLastSavedAt(new Date())
              setLastServerConfirmation({
                at: new Date(),
                status: "finalized",
                score: latestScorecard.total_score,
                targets: latestScorecard.total_targets,
              })
              await deleteOfflineScorecardDraft(
                offlineScorecardKey(eventId, memberId, courseId),
              ).catch(() => undefined)
              await refreshQueuedCount()
              if (!options.silent) {
                toast.info("This scorecard was already finalized on the server.")
              }
              setSaving(false)
              return true
            }
            saveScorecardId = latestScorecard.id
            saveShootId = latestScorecard.shoot_id
            saveCourseId = latestScorecard.course_id
            expectedUpdatedAt = latestScorecard.updated_at
          }
        } catch {
          // The normal save path below still handles offline/network failures.
        }
      }

      try {
        await saveDigitalScorecard({
          organizationId: data.event.organization_id,
          eventId,
          shootId: saveShootId,
          squadMemberId: memberId,
          courseId: saveCourseId,
          scorecardId: saveScorecardId,
          malfunctionCount: malfunctions,
          verifiedBy1: verified1,
          verifiedBy2: verified2,
          enteredByName: enteredBy,
          notes,
          status,
          expectedUpdatedAt: status === "finalized" ? null : expectedUpdatedAt,
          stationScores: stationRows
            .filter((row) => row.parsed !== null)
            .map((row) => ({
              stationId: row.station.id,
              hits: row.parsed as number,
              targets: row.station.bird_count,
              notes: row.note,
            })),
        })

        await deleteOfflineScorecardDraft(
          offlineScorecardKey(eventId, memberId, courseId),
        ).catch(() => undefined)
        setDirty(false)
        setPendingSync(false)
        setQueuedStatus("draft")
        setLocalDraftSavedAt(null)
        await refreshQueuedCount().catch(() => undefined)
        const confirmedAt = new Date()
        setLastSavedAt(confirmedAt)
        recordLastSaveError("")
        setLastServerConfirmation({
          at: confirmedAt,
          status,
          score: totalScore,
          targets: totalTargets,
        })

        if (!options.silent) {
          toast.success(
            status === "finalized"
              ? "Scorecard finalized and locked."
              : "Draft scorecard saved.",
          )
        }

        await load({ silent: true })
        setShootId(shootId)
        setSquadId(squadId)
        setMemberId(memberId)
        return true
      } catch (caught) {
        if (isDigitalScorecardConflictError(caught)) {
          setPendingSync(false)
          recordLastSaveError("A newer server scorecard was found. Choose which version to keep before continuing.")
          toast.warning(
            "A newer server scorecard was found. ClayKeeper protected your device draft instead of overwriting it.",
          )
          await load()
          return false
        }

        setPendingSync(true)
        const message =
          caught instanceof Error
            ? caught.message
            : "Scorecard could not be saved."
        recordLastSaveError(message)
        if (isLikelyConnectionError(caught)) {
          setDirty(false)
          setQueueSyncBlocked(true)
          if (!options.silent) {
            toast.info("The scorecard is saved on this device and will upload when the connection is available.")
          }
          return true
        }
        if (!options.silent) {
          toast.error(message)
        }
        return false
      } finally {
        setSaving(false)
      }
    },
    [
      courseId,
      data,
      enteredBy,
      enteredCount,
      eventId,
      invalid.length,
      load,
      locked,
      malfunctions,
      memberId,
      notes,
      online,
      refreshQueuedCount,
      recordLastSaveError,
      scorecard?.id,
      scorecard?.updated_at,
      scores,
      stationNotes,
      shootId,
      squadId,
      stationRows,
      stations,
      totalScore,
      totalTargets,
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
    if (!online || queuedCount === 0 || saving || syncingQueue || syncConflict || queueSyncBlocked || !eventId) return

    const timer = window.setTimeout(() => {
      void (async () => {
        setSyncingQueue(true)
        let uploaded = 0
        let conflicts = 0

        try {
          const drafts = await listOfflineScorecardDrafts(eventId)
          for (const draft of drafts.sort((a, b) => a.savedAt.localeCompare(b.savedAt))) {
            try {
              await saveDigitalScorecard({
                organizationId: draft.organizationId,
                eventId: draft.eventId,
                shootId: draft.shootId,
                squadMemberId: draft.memberId,
                courseId: draft.courseId,
                scorecardId: draft.scorecardId,
                malfunctionCount: draft.malfunctions,
                verifiedBy1: draft.verified1,
                verifiedBy2: draft.verified2,
                enteredByName: draft.enteredBy,
                notes: draft.notes,
                status: draft.requestedStatus,
                expectedUpdatedAt: draft.baseUpdatedAt,
                stationScores: Object.entries(draft.scores)
                  .filter(([, value]) => value !== "")
                  .map(([stationId, value]) => ({
                    stationId,
                    hits: Number(value),
                    targets: draft.stationTargets[stationId] ?? 0,
                    notes: draft.stationNotes[stationId] ?? "",
                  })),
              })
              await deleteOfflineScorecardDraft(draft.key)
              uploaded += 1

              if (draft.key === offlineScorecardKey(eventId, memberId, courseId)) {
                setPendingSync(false)
                setQueuedStatus("draft")
                setLocalDraftSavedAt(null)
              }
            } catch (caught) {
              if (isDigitalScorecardConflictError(caught)) {
                conflicts += 1
                if (draft.key === offlineScorecardKey(eventId, memberId, courseId)) {
                  setSyncConflict({
                    draft,
                    serverUpdatedAt: scorecard?.updated_at ?? null,
                  })
                  setPendingSync(false)
                }
                continue
              }
              throw caught
            }
          }

          await refreshQueuedCount()
          if (uploaded > 0) {
            toast.success(`${uploaded} saved scorecard${uploaded === 1 ? "" : "s"} uploaded.`)
            await load()
          }
          if (conflicts > 0) {
            setQueueSyncBlocked(true)
            toast.warning(`${conflicts} queued scorecard${conflicts === 1 ? " needs" : "s need"} review before uploading.`)
          }
        } catch (caught) {
          setQueueSyncBlocked(true)
          recordLastSaveError(
            caught instanceof Error ? caught.message : "Queued scorecards could not be uploaded.",
          )
        } finally {
          setSyncingQueue(false)
        }
      })()
    }, 750)

    return () => window.clearTimeout(timer)
  }, [courseId, eventId, load, memberId, online, queuedCount, queueSyncBlocked, refreshQueuedCount, saving, scorecard?.updated_at, syncConflict, syncingQueue])

  function keepServerVersion() {
    if (!eventId || !memberId || !courseId) return
    void deleteOfflineScorecardDraft(
      offlineScorecardKey(eventId, memberId, courseId),
    ).then(async () => {
      setSyncConflict(null)
      setPendingSync(false)
      setQueueSyncBlocked(false)
      setLocalDraftSavedAt(null)
      setDirty(false)
      await refreshQueuedCount()
      toast.success("Server scorecard kept. The older device draft was discarded.")
    })
  }

  function restoreDeviceDraft() {
    if (!syncConflict) return
    const draft = {
      ...syncConflict.draft,
      baseUpdatedAt: syncConflict.serverUpdatedAt,
      savedAt: new Date().toISOString(),
    }
    setScores((current) => ({ ...current, ...draft.scores }))
    setStationNotes((current) => ({
      ...current,
      ...(draft.stationNotes ?? {}),
    }))
    setMalfunctions(draft.malfunctions)
    setVerified1(draft.verified1)
    setVerified2(draft.verified2)
    setEnteredBy(draft.enteredBy)
    setNotes(draft.notes)
    setSyncConflict(null)
    setQueueSyncBlocked(false)
    setPendingSync(true)
    setDirty(true)
    void putOfflineScorecardDraft(draft)
    toast.warning(
      "Device draft restored. Review it carefully, then save to intentionally replace the newer server draft.",
    )
  }

  function updateScore(stationId: string, value: string) {
    setScores((current) => ({
      ...current,
      [stationId]: value.replace(/[^0-9]/g, ""),
    }))
    setQueuedStatus("draft")
    setDirty(true)
    if (error) setError("")
  }

  function updateStationNote(stationId: string, value: string) {
    setStationNotes((current) => ({
      ...current,
      [stationId]: value,
    }))
    setQueuedStatus("draft")
    setDirty(true)
    if (error) setError("")
  }

  function adjustScore(stationId: string, birdCount: number, delta: number) {
    const currentRaw = scores[stationId] ?? ""
    const current = currentRaw === "" ? 0 : Number(currentRaw)
    const next = Math.min(birdCount, Math.max(0, current + delta))
    updateScore(stationId, String(next))
  }

  async function protectBeforeNavigation(action: () => void) {
    if (saving || Boolean(syncConflict)) return

    if (dirty && !locked) {
      const saved = await save("draft")
      if (!saved) {
        toast.error(
          "ClayKeeper kept you on this scorecard because the pending work was not confirmed by the server.",
        )
        return
      }
    }

    action()
  }

  async function moveToMember(targetId: string) {
    if (!targetId || saving) return
    await protectBeforeNavigation(() => setMemberId(targetId))
  }

  function focusStation(index: number) {
    const safeIndex = Math.min(Math.max(index, 0), stationRows.length - 1)
    if (safeIndex < 0) return
    stationCardRefs.current[safeIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
    window.setTimeout(() => {
      const target = scoreInputRefs.current[safeIndex]
      target?.focus()
      target?.select()
    }, 250)
  }

  function setScoreAndAdvance(
    stationId: string,
    value: string,
    stationIndex: number,
  ) {
    updateScore(stationId, value)
    const nextIndex = stationRows.findIndex(
      (row, index) => index > stationIndex && row.parsed === null,
    )
    if (nextIndex >= 0) focusStation(nextIndex)
  }

  async function prepareForOfflineUse() {
    if (!online) {
      toast.info("Reconnect before updating the offline event data.")
      return
    }

    setPreparingOffline(true)
    try {
      await requestPersistentOfflineStorage()
      await load()
      await cacheScoringAppForOffline()
      toast.success("This event is ready for offline scoring on this device.")
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Offline scoring could not be prepared.",
      )
    } finally {
      setPreparingOffline(false)
    }
  }

  async function finalizeWithConfirmation() {
    if (locked || saving || Boolean(syncConflict)) return
    if (enteredCount !== stations.length || invalid.length > 0 || !enteredBy.trim()) {
      await save("finalized")
      return
    }

    const athlete = nameOf(participant?.athlete)
    const confirmation = window.confirm(
      `FINAL REVIEW\n\nParticipant: ${athlete}\nScore: ${totalScore} / ${totalTargets}\nStations: ${enteredCount} / ${stations.length}\n\nFinalized scorecards are locked from normal editing.\n\nPress OK to finalize this scorecard.`,
    )

    if (!confirmation) {
      toast.message("Finalization cancelled. The scorecard remains editable.")
      return
    }

    await save("finalized")
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
    : saving || syncingQueue
      ? "Saving…"
    : queuedCount > 0
      ? `${queuedCount} waiting to upload`
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
                    : saving || syncingQueue
                      ? "bg-blue-50 text-blue-700"
                    : dirty || queuedCount > 0
                      ? "bg-amber-50 text-amber-800"
                      : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {syncConflict ? (
                  <CircleAlert className="h-4 w-4" />
                ) : saving || syncingQueue ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : dirty || queuedCount > 0 ? (
                  <CircleAlert className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {saveStateLabel}
              </div>
              <Button
                variant="outline"
                disabled={!online || preparingOffline}
                onClick={() => void prepareForOfflineUse()}
                title="Download current event details for offline scoring"
              >
                {preparingOffline ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {offlineCachedAt ? "Update Offline Data" : "Prepare Offline"}
              </Button>
              <Button variant="outline" onClick={() => void load({ resetSquads: true })}>
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
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button variant="outline" onClick={() => void load({ resetSquads: true })} className="shrink-0">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : null}

        {usingOfflineData ? (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <Download className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Using event data saved on this device</p>
              <p className="mt-1">Keep scoring normally. New work will upload automatically when a connection returns.</p>
            </div>
          </div>
        ) : null}

        {queuedCount > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CloudUpload className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">{queuedCount} scorecard{queuedCount === 1 ? "" : "s"} saved on this device</p>
                <p className="mt-1">{online ? queueSyncBlocked ? "One or more scorecards need conflict review before upload." : "ClayKeeper will upload them automatically." : "They will upload automatically when service returns."}</p>
              </div>
            </div>
            {online && queueSyncBlocked ? (
              <Button variant="outline" onClick={() => setQueueSyncBlocked(false)}>
                <RefreshCw className="h-4 w-4" />
                Retry Upload
              </Button>
            ) : null}
          </div>
        ) : null}

        {lastSaveError && !syncConflict ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Server confirmation failed</p>
              <p className="mt-1">{lastSaveError}</p>
              <p className="mt-1 text-xs">Your current work remains protected on this device until the server confirms a save.</p>
            </div>
            <Button
              variant="outline"
              disabled={!online || saving || locked}
              onClick={() => void save("draft")}
              className="shrink-0"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Retry Save
            </Button>
          </div>
        ) : null}

        {lastServerConfirmation && !dirty && !pendingSync && !syncConflict ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Server confirmed</p>
              <p className="mt-1">
                {lastServerConfirmation.status === "finalized" ? "Finalized scorecard" : "Draft"} confirmed at {formatSavedTime(lastServerConfirmation.at)} · {lastServerConfirmation.score}/{lastServerConfirmation.targets}
              </p>
            </div>
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
                <p className="mt-1">Changes are stored on this device. Drafts and completed scorecards will upload automatically when the connection returns.</p>
              </div>
            </div>
          </div>
        ) : pendingSync ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Connection restored. ClayKeeper is synchronizing the locally saved scorecard.
          </div>
        ) : null}

        <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-5 md:p-5">
          <Select
            label="Shoot"
            value={shootId}
            setValue={(value) => {
              void protectBeforeNavigation(() => setShootId(value))
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
              void protectBeforeNavigation(() => setSquadId(value))
            }}
            options={[{ value: ALL_SQUADS, label: "All Squads" }, ...squads.map((row) => ({
              value: row.id,
              label: `Squad ${row.squad_number}`,
            }))]}
          />
          <Select
            label="Participant / Post"
            value={memberId}
            setValue={(value) => {
              void moveToMember(value)
            }}
            options={members.map((member) => {
              const squad = data.squads.find((row) => row.id === member.squad_id)
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
                label: `${squadId === ALL_SQUADS ? `Squad ${squad?.squad_number} · ` : ""}${member.position_label || `Post ${member.position}`} · ${nameOf(athlete)}`,
              }
            })}
          />
          <Select
            label="Sort shooters"
            value={memberSort}
            setValue={(value) => setMemberSort(value as MemberSort)}
            options={[
              { value: "squad", label: "Squad / post" },
              { value: "name", label: "Shooter name" },
              { value: "status", label: "Score status" },
            ]}
          />
          <Select
            label="Course"
            value={courseId}
            setValue={(value) => {
              void protectBeforeNavigation(() => setCourseId(value))
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Current participant · {currentMemberIndex >= 0 ? currentMemberIndex + 1 : 0} of {members.length}
                    </p>
                    {locked ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-800">
                        Finalized · Read Only
                      </span>
                    ) : null}
                  </div>
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
                  Previous Participant
                </Button>
                <Button
                  variant="outline"
                  disabled={!nextMember || saving}
                  onClick={() => nextMember && void moveToMember(nextMember.id)}
                  className="min-h-12"
                >
                  Next Participant
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Station progress</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {enteredCount === stations.length
                      ? "All active stations entered"
                      : `Next attention: Station ${stationRows[activeStationIndex]?.station.station_number ?? "—"}`}
                  </p>
                </div>
                {enteredCount < stations.length ? (
                  <Button
                    variant="outline"
                    onClick={() => focusStation(activeStationIndex)}
                    className="min-h-11"
                  >
                    Go to Next Station
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {stationRows.map((row, index) => {
                  const bad =
                    row.parsed !== null &&
                    (row.parsed < 0 ||
                      row.parsed > row.station.bird_count ||
                      !Number.isInteger(row.parsed))
                  const complete = row.parsed !== null && !bad
                  return (
                    <button
                      key={row.station.id}
                      type="button"
                      onClick={() => focusStation(index)}
                      className={`min-h-10 min-w-10 rounded-lg border px-3 text-sm font-black transition ${
                        bad
                          ? "border-red-300 bg-red-50 text-red-800"
                          : complete
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : index === activeStationIndex
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      aria-label={`Go to station ${row.station.station_number}`}
                    >
                      {row.station.station_number}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Summary
                label="Participant"
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
                value={locked ? "Finalized" : pendingSync && queuedStatus === "finalized" ? "Ready to Upload" : scorecard || pendingSync ? "Draft" : "Not Started"}
                detail={locked ? "Locked from editing" : pendingSync ? "Saved on this device" : dirty ? "Unsaved changes" : "Editable"}
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
                    ref={(element) => {
                      stationCardRefs.current[index] = element
                    }}
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
                        onClick={() => setScoreAndAdvance(row.station.id, "0", index)}
                        className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold disabled:opacity-40"
                      >
                        Set 0 & Next
                      </button>
                      <button
                        type="button"
                        disabled={locked || Boolean(syncConflict)}
                        onClick={() => setScoreAndAdvance(row.station.id, String(row.station.bird_count), index)}
                        className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold disabled:opacity-40"
                      >
                        Hit All & Next ({row.station.bird_count})
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
                          ref={(element) => {
                            if (window.innerWidth >= 768) stationCardRefs.current[index] = element
                          }}
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
                          <td className="p-4">
                            {row.station.notes ? (
                              <p className="mb-2 text-xs text-slate-500">
                                Instruction:
                              </p>
                            ) : null}
                            <textarea
                              disabled={locked || Boolean(syncConflict)}
                              value={row.note}
                              onChange={(event) =>
                                updateStationNote(
                                  row.station.id,
                                  event.target.value,
                                )
                              }
                              placeholder="Optional station note"
                              rows={2}
                              className="min-w-52 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-slate-100"
                            />
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
                    setQueuedStatus("draft")
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
                  setQueuedStatus("draft")
                  setDirty(true)
                }}
                disabled={locked || Boolean(syncConflict)}
              />
              <Field
                label="Verified by #2"
                value={verified2}
                setValue={(value) => {
                  setVerified2(value)
                  setQueuedStatus("draft")
                  setDirty(true)
                }}
                disabled={locked || Boolean(syncConflict)}
              />
              <Field
                label={<>Entered by <strong className="font-bold text-red-600">(REQUIRED TO FINALIZE)</strong></>}
                inputRef={enteredByInputRef}
                value={enteredBy}
                setValue={(value) => {
                  setEnteredBy(value)
                  setQueuedStatus("draft")
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
                    setQueuedStatus("draft")
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
                {online ? "Save Draft" : "Save on Device"}
              </Button>
              <Button
                onClick={() => void finalizeWithConfirmation()}
                disabled={saving || locked || Boolean(syncConflict) || stations.length === 0}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {online ? "Finalize Scorecard" : "Complete on Device"}
              </Button>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
              <div className="mx-auto max-w-xl">
                <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-slate-600">
                  <span>{nameOf(participant?.athlete)}</span>
                  <span className="tabular-nums">{totalScore}/{totalTargets} · {enteredCount}/{stations.length} stations</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => void save("draft")}
                  disabled={saving || locked || Boolean(syncConflict)}
                  className="min-h-12"
                >
                  <Save className="h-5 w-5" />
                  {online ? "Save Draft" : "Save on Device"}
                </Button>
                <Button
                  onClick={() => void finalizeWithConfirmation()}
                  disabled={saving || locked || Boolean(syncConflict) || stations.length === 0}
                  className="min-h-12"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  {online ? "Finalize" : "Complete"}
                </Button>
                </div>
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
  inputRef?: React.Ref<HTMLInputElement>
  label: React.ReactNode
  value: string
  setValue: (value: string) => void
  disabled: boolean
}) {
  return (
    <label>
      <span className="text-sm font-semibold">{props.label}</span>
      <input
        ref={props.inputRef}
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
