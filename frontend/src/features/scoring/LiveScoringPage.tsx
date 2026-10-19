import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Plus, RefreshCw, Save, Shuffle, Trash2, Trophy, UserPlus, Users } from "lucide-react"
import { useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { rankIndividuals, type AwardParticipant } from "@/lib/services/awardsEngine"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  createShootOffRound,
  deleteShootOffRound,
  loadScoringBaseData,
  loadShootScoringData,
  registerAthleteForScoring,
  saveRoundScore,
  saveShootOffScore,
  updateScoringMemberStartingStation,
  type ScoreEntry,
  type DigitalScoreTotal,
  type ScoringAthlete,
  type ScoringClass,
  type ScoringEnrollment,
  type ScoringEvent,
  type ScoringMember,
  type ScoringNamedRecord,
  type ScoringRegistration,
  type ScoringShoot,
  type ScoringSquad,
  type ShootOffRound,
  type ShootOffScore,
} from "@/lib/services/scoring"
import { createParticipant } from "@/lib/services/participants"
import { assignEnrollment, moveMember } from "@/lib/services/squads"

type ShootData = {
  squads: ScoringSquad[]
  members: ScoringMember[]
  enrollments: ScoringEnrollment[]
  registrations: ScoringRegistration[]
  athletes: ScoringAthlete[]
  teams: ScoringNamedRecord[]
  classes: ScoringClass[]
  scores: ScoreEntry[]
  digitalTotals: DigitalScoreTotal[]
  shootOffRounds: ShootOffRound[]
  shootOffScores: ShootOffScore[]
}

const emptyData: ShootData = { squads: [], members: [], enrollments: [], registrations: [], athletes: [], teams: [], classes: [], scores: [], digitalTotals: [], shootOffRounds: [], shootOffScores: [] }

type AssignmentOption = {
  value: string
  squadId: string
  position: number
  label: string
}

function assignmentLabel(discipline: string | undefined, position: number) {
  return discipline === "american_trap" || discipline === "bunker" ? `Post ${position}` : `Position ${position}`
}

export function LiveScoringPage() {
  const { eventId: routeEventId } = useParams()
  const [searchParams] = useSearchParams()
  const [organizationId, setOrganizationId] = useState("")
  const [events, setEvents] = useState<ScoringEvent[]>([])
  const [shoots, setShoots] = useState<ScoringShoot[]>([])
  const [eventId, setEventId] = useState(routeEventId || "")
  const [shootId, setShootId] = useState(searchParams.get("shootId") || "")
  const [squadId, setSquadId] = useState(searchParams.get("squadId") || "")
  const focusedMemberId = searchParams.get("memberId") || ""
  const focusedOnce = useRef(false)
  const [data, setData] = useState<ShootData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState("")
  const [error, setError] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [showShootDayTools, setShowShootDayTools] = useState(true)
  const [managementBusy, setManagementBusy] = useState(false)
  const [unassignedEnrollmentId, setUnassignedEnrollmentId] = useState("")
  const [unassignedAssignment, setUnassignedAssignment] = useState("")
  const [quickMode, setQuickMode] = useState<"existing" | "new">("existing")
  const [participantSearch, setParticipantSearch] = useState("")
  const [quickAthleteId, setQuickAthleteId] = useState("")
  const [quickFirstName, setQuickFirstName] = useState("")
  const [quickLastName, setQuickLastName] = useState("")
  const [quickTeamId, setQuickTeamId] = useState("")
  const [quickClassId, setQuickClassId] = useState("")
  const [quickAssignment, setQuickAssignment] = useState("")
  const [quickStartingStation, setQuickStartingStation] = useState("")
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const eventShoots = useMemo(() => shoots.filter((shoot) => shoot.event_id === eventId), [shoots, eventId])
  const selectedShoot = shoots.find((shoot) => shoot.id === shootId)
  const selectedSquad = data.squads.find((squad) => squad.id === squadId)
  const enrollmentById = useMemo(() => new Map(data.enrollments.map((row) => [row.id, row])), [data.enrollments])
  const registrationById = useMemo(() => new Map(data.registrations.map((row) => [row.id, row])), [data.registrations])
  const athleteById = useMemo(() => new Map(data.athletes.map((row) => [row.id, row])), [data.athletes])
  const teamById = useMemo(() => new Map(data.teams.map((row) => [row.id, row])), [data.teams])
  const classById = useMemo(() => new Map(data.classes.map((row) => [row.id, row])), [data.classes])
  const activeMemberByEnrollmentId = useMemo(() => new Map(data.members.filter((member) => !["withdrawn", "no_show"].includes(member.status)).map((member) => [member.registration_shoot_id, member])), [data.members])
  const assignmentOptions = useMemo(() => {
    const occupied = new Set(data.members.filter((member) => !["withdrawn", "no_show"].includes(member.status)).map((member) => `${member.squad_id}:${member.position}`))
    return data.squads.flatMap((squad) => Array.from({ length: squad.capacity || 5 }, (_, index) => index + 1)
      .filter((position) => !occupied.has(`${squad.id}:${position}`))
      .map((position): AssignmentOption => ({
        value: `${squad.id}:${position}`,
        squadId: squad.id,
        position,
        label: `Squad ${squad.squad_number} · ${assignmentLabel(selectedShoot?.discipline, position)}${squad.course_name ? ` · ${squad.course_name}` : ""}`,
      })))
  }, [data.members, data.squads, selectedShoot])
  const unassignedEnrollments = useMemo(() => data.enrollments.filter((enrollment) => {
    if (activeMemberByEnrollmentId.has(enrollment.id) || !["registered", "completed"].includes(enrollment.status)) return false
    const registration = registrationById.get(enrollment.registration_id)
    return registration?.status === "registered" || Boolean(registration?.checked_in)
  }), [activeMemberByEnrollmentId, data.enrollments, registrationById])
  const filteredAthletes = useMemo(() => {
    const query = participantSearch.trim().toLowerCase()
    if (!query) return data.athletes.slice(0, 100)
    return data.athletes.filter((athlete) => [displayName(athlete), athlete.cyssa_number, teamById.get(athlete.team_id || "")?.name]
      .filter(Boolean).join(" ").toLowerCase().includes(query)).slice(0, 100)
  }, [data.athletes, participantSearch, teamById])
  const squadMembers = useMemo(() => data.members
    .filter((member) => member.squad_id === squadId && participantFor(member).registration?.checked_in)
    .sort((a, b) => a.position - b.position), [data.members, squadId, enrollmentById, registrationById])
  const scoreMap = useMemo(() => {
    const map = new Map(data.scores.map((row) => [`${row.squad_member_id}:${row.round_number}`, row.score]))
    if (selectedShoot?.discipline?.toLowerCase().includes("sporting") && selectedShoot.number_of_rounds === 1) {
      data.digitalTotals.forEach((row) => {
        const key = `${row.squad_member_id}:1`
        if (!map.has(key) && row.total_score !== null) map.set(key, row.total_score)
      })
    }
    return map
  }, [data.digitalTotals, data.scores, selectedShoot])
  const checkedInMemberCount = useMemo(() => data.members.filter((member) => participantFor(member).registration?.checked_in).length, [data.members, data.enrollments, data.registrations])
  const shootOffScoreMap = useMemo(() => new Map(data.shootOffScores.map((row) => [`${row.squad_member_id}:${row.shoot_off_round_id}`, row.score])), [data.shootOffScores])
  const tiedMembers = useMemo(() => {
    if (!selectedShoot) return [] as Array<{ total: number; names: string[] }>
    const classes = new Map<string, AwardParticipant[]>()
    data.members.filter((member) => participantFor(member).registration?.checked_in).forEach((member) => {
      const scores = Array.from({ length: selectedShoot.number_of_rounds }, (_, i) => scoreMap.get(`${member.id}:${i + 1}`))
      if (scores.some((score) => score === undefined || score === null)) return
      const numericScores = scores as number[]
      const total = numericScores.reduce((sum, score) => sum + score, 0)
      const participant = participantFor(member)
      const classCode = participant.cls?.code.toUpperCase() || "Unclassified"
      const squad = data.squads.find((row) => row.id === member.squad_id)
      const row: AwardParticipant = {
        enrollmentId: member.registration_shoot_id, memberId: member.id,
        name: displayName(participant.athlete), classCode, total, complete: true,
        team: participant.team?.name || "", squad: `Squad ${squad?.squad_number || ""}`,
        shootOffs: data.shootOffRounds.map((round) => shootOffScoreMap.get(`${member.id}:${round.id}`) ?? -1),
      }
      classes.set(classCode, [...(classes.get(classCode) ?? []), row])
    })
    return [...classes].flatMap(([classCode, rows]) => {
      const ties = new Map<number, AwardParticipant[]>()
      rankIndividuals(rows, 3).filter((row) => row.unresolvedTie).forEach((row) => {
        ties.set(row.place, [...(ties.get(row.place) ?? []), row])
      })
      return [...ties].map(([place, tied]) => ({
        total: tied[0].total,
        names: tied.map((row) => `${classCode} - place ${place}: ${row.name} (${row.squad})`),
      }))
    })
  }, [scoreMap, selectedShoot, data.members, data.squads, data.shootOffRounds, shootOffScoreMap, enrollmentById, registrationById, athleteById, teamById, classById])

  async function loadBase() {
    setLoading(true); setError("")
    try {
      const base = await loadScoringBaseData()
      setOrganizationId(base.organizationId); setEvents(base.events); setShoots(base.shoots)
      const nextEvent = eventId || base.events[0]?.id || ""
      setEventId(nextEvent)
      const nextShoot = shootId || base.shoots.find((shoot) => shoot.event_id === nextEvent)?.id || ""
      setShootId(nextShoot)
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load round score entry.") }
    finally { setLoading(false) }
  }

  async function loadShoot() {
    if (!organizationId || !eventId || !shootId) { setData(emptyData); return }
    setLoading(true); setError("")
    try {
      const next = await loadShootScoringData(organizationId, eventId, shootId)
      setData(next)
      setSquadId((current) => next.squads.some((s) => s.id === current) ? current : next.squads[0]?.id || "")
      setDrafts({})
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load scores. Apply the live-scoring migration in Supabase if this is the first run.") }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadBase() }, [])
  useEffect(() => { void loadShoot() }, [organizationId, eventId, shootId])
  useEffect(() => {
    const preferred = assignmentOptions.find((option) => option.squadId === squadId) ?? assignmentOptions[0]
    if (!assignmentOptions.some((option) => option.value === quickAssignment)) setQuickAssignment(preferred?.value ?? "")
    if (!assignmentOptions.some((option) => option.value === unassignedAssignment)) setUnassignedAssignment(preferred?.value ?? "")
  }, [assignmentOptions, quickAssignment, squadId, unassignedAssignment])

  useEffect(() => {
    if (loading || focusedOnce.current || !focusedMemberId) return
    const row = document.getElementById(`score-member-${focusedMemberId}`)
    if (!row) return
    focusedOnce.current = true
    row.scrollIntoView({ block: "center", inline: "nearest" })
    const input = row.querySelector<HTMLInputElement>(searchParams.get("focus") === "shootOff" ? "input[data-shoot-off]" : "input")
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [loading, focusedMemberId, searchParams, squadId])

  function participantFor(member: ScoringMember) {
    const enrollment = enrollmentById.get(member.registration_shoot_id)
    const registration = enrollment ? registrationById.get(enrollment.registration_id) : undefined
    const athlete = registration ? athleteById.get(registration.athlete_id) : undefined
    return { registration, athlete, team: registration?.team_id ? teamById.get(registration.team_id) : undefined, cls: registration?.class_id ? classById.get(registration.class_id) : undefined }
  }

  function participantForEnrollment(enrollment: ScoringEnrollment) {
    const registration = registrationById.get(enrollment.registration_id)
    const athlete = registration ? athleteById.get(registration.athlete_id) : undefined
    return {
      registration,
      athlete,
      team: registration?.team_id ? teamById.get(registration.team_id) : undefined,
      cls: registration?.class_id ? classById.get(registration.class_id) : undefined,
    }
  }

  function displayName(athlete?: ScoringAthlete) {
    if (!athlete) return "Unknown participant"
    return [athlete.preferred_name || athlete.first_name, athlete.last_name].filter(Boolean).join(" ") || "Unknown participant"
  }

  function decodeAssignment(value: string) {
    const [targetSquadId, rawPosition] = value.split(":")
    const position = Number(rawPosition)
    if (!targetSquadId || !Number.isInteger(position) || position < 1) return null
    return { squadId: targetSquadId, position }
  }

  function chooseQuickAthlete(athleteId: string) {
    setQuickAthleteId(athleteId)
    const athlete = athleteById.get(athleteId)
    if (!athlete) return
    setQuickTeamId(athlete.team_id ?? "")
    setQuickClassId(athlete.class_id ?? "")
  }

  async function changeMemberAssignment(member: ScoringMember, value: string) {
    const assignment = decodeAssignment(value)
    if (!assignment || !selectedShoot) return
    const targetSquad = data.squads.find((squad) => squad.id === assignment.squadId)
    if (!targetSquad) return
    setManagementBusy(true)
    try {
      await moveMember(member.id, assignment.squadId, assignment.position, assignmentLabel(selectedShoot.discipline, assignment.position))
      toast.success(`Participant moved to Squad ${targetSquad.squad_number}, ${assignmentLabel(selectedShoot.discipline, assignment.position)}.`)
      await loadShoot()
    } catch (err) { toast.error(err instanceof Error ? err.message : "The participant could not be moved.") }
    finally { setManagementBusy(false) }
  }

  async function commitStartingStation(member: ScoringMember, value: string) {
    const nextValue = value.trim() || null
    if (nextValue === (member.starting_station ?? null)) return
    setManagementBusy(true)
    try {
      await updateScoringMemberStartingStation(member.id, nextValue)
      setData((current) => ({ ...current, members: current.members.map((row) => row.id === member.id ? { ...row, starting_station: nextValue } : row) }))
      toast.success("Starting station updated.")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Starting station could not be updated.") }
    finally { setManagementBusy(false) }
  }

  async function assignRegisteredParticipant() {
    if (!selectedShoot || !unassignedEnrollmentId) { toast.error("Choose a registered participant."); return }
    const assignment = decodeAssignment(unassignedAssignment)
    if (!assignment) { toast.error("Choose an open squad position."); return }
    const enrollment = data.enrollments.find((row) => row.id === unassignedEnrollmentId)
    const participant = enrollment ? participantForEnrollment(enrollment) : null
    setManagementBusy(true)
    try {
      await assignEnrollment({
        organizationId,
        shootId,
        squadId: assignment.squadId,
        registrationShootId: unassignedEnrollmentId,
        position: assignment.position,
        label: assignmentLabel(selectedShoot.discipline, assignment.position),
      })
      toast.success(`${displayName(participant?.athlete)} assigned.`)
      setUnassignedEnrollmentId("")
      setSquadId(assignment.squadId)
      await loadShoot()
    } catch (err) { toast.error(err instanceof Error ? err.message : "The participant could not be assigned.") }
    finally { setManagementBusy(false) }
  }

  async function registerAndAssignParticipant() {
    if (!selectedShoot) return
    const assignment = decodeAssignment(quickAssignment)
    if (!assignment) { toast.error("Choose an open squad position."); return }
    if (!quickTeamId) { toast.error("Choose the participant's team."); return }

    let athleteId = quickAthleteId
    setManagementBusy(true)
    try {
      if (quickMode === "new") {
        const firstName = quickFirstName.trim()
        const lastName = quickLastName.trim()
        if (!firstName || !lastName) throw new Error("Enter the new participant's first and last name.")
        const duplicate = data.athletes.find((athlete) =>
          (athlete.first_name ?? "").trim().toLowerCase() === firstName.toLowerCase()
          && (athlete.last_name ?? "").trim().toLowerCase() === lastName.toLowerCase())
        if (duplicate) throw new Error(`${displayName(duplicate)} already exists. Select the existing participant instead.`)
        athleteId = await createParticipant({
          organization_id: organizationId,
          class_id: quickClassId || null,
          first_name: firstName,
          last_name: lastName,
          preferred_name: null,
          birth_date: null,
          gender: null,
          graduation_year: null,
          cyssa_number: null,
          ata_number: null,
          nssa_number: null,
          email: null,
          phone: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          notes: "Created at the shoot from round score entry.",
          active: true,
        }, quickTeamId)
      } else if (!athleteId) {
        throw new Error("Choose an existing participant.")
      }

      const enrollmentId = await registerAthleteForScoring({
        organizationId,
        eventId,
        shoot: selectedShoot,
        athleteId,
        teamId: quickTeamId,
        classId: quickClassId || null,
      })
      await assignEnrollment({
        organizationId,
        shootId,
        squadId: assignment.squadId,
        registrationShootId: enrollmentId,
        position: assignment.position,
        label: assignmentLabel(selectedShoot.discipline, assignment.position),
      })
      if (quickStartingStation.trim()) {
        const existingMember = data.members.find((member) => member.registration_shoot_id === enrollmentId)
        if (existingMember) await updateScoringMemberStartingStation(existingMember.id, quickStartingStation.trim())
        else {
          const memberResult = await loadShootScoringData(organizationId, eventId, shootId)
          const createdMember = memberResult.members.find((member) => member.registration_shoot_id === enrollmentId)
          if (createdMember) await updateScoringMemberStartingStation(createdMember.id, quickStartingStation.trim())
        }
      }
      toast.success("Participant registered, checked in, and assigned.")
      setQuickAthleteId(""); setQuickFirstName(""); setQuickLastName(""); setQuickStartingStation("")
      setSquadId(assignment.squadId)
      await loadShoot()
    } catch (err) { toast.error(err instanceof Error ? err.message : "The participant could not be registered.") }
    finally { setManagementBusy(false) }
  }

  function scoreValue(memberId: string, round: number) {
    const key = `${memberId}:${round}`
    return drafts[key] ?? (scoreMap.get(key)?.toString() ?? "")
  }

  async function commitRound(memberId: string, round: number, moveNext = false) {
    if (!selectedShoot) return
    const key = `${memberId}:${round}`
    const raw = scoreValue(memberId, round).trim()
    const parsed = raw === "" ? null : Number(raw)
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0 || parsed > selectedShoot.targets_per_round)) {
      toast.error(`Enter a whole number from 0 to ${selectedShoot.targets_per_round}.`); inputRefs.current[key]?.focus(); return
    }
    setSavingKey(key)
    try {
      await saveRoundScore({ organizationId, eventId, shootId, squadMemberId: memberId, roundNumber: round, score: parsed })
      setData((current) => ({ ...current, scores: parsed === null ? current.scores.filter((row) => !(row.squad_member_id === memberId && row.round_number === round)) : [...current.scores.filter((row) => !(row.squad_member_id === memberId && row.round_number === round)), { id: key, squad_member_id: memberId, round_number: round, score: parsed, status: "entered" }] }))
      setDrafts((current) => { const next = { ...current }; delete next[key]; return next })
      if (moveNext && round < selectedShoot.number_of_rounds) setTimeout(() => inputRefs.current[`${memberId}:${round + 1}`]?.focus(), 0)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Score could not be saved.") }
    finally { setSavingKey("") }
  }

  async function addShootOff() {
    if (!selectedShoot) return
    const roundNumber = Math.max(0, ...data.shootOffRounds.map((round) => round.round_number)) + 1
    try { await createShootOffRound({ organizationId, eventId, shootId, roundNumber }); await loadShoot(); toast.success(`Shoot-off ${roundNumber} added.`) }
    catch (err) { toast.error(err instanceof Error ? err.message : "Shoot-off could not be added.") }
  }

  async function removeShootOff(round: ShootOffRound) {
    if (!window.confirm(`Delete ${round.label || `SO${round.round_number}`} and all scores in it?`)) return
    try { await deleteShootOffRound(round.id); await loadShoot(); toast.success("Shoot-off round deleted.") }
    catch (err) { toast.error(err instanceof Error ? err.message : "Shoot-off could not be deleted.") }
  }

  async function commitShootOff(memberId: string, round: ShootOffRound, value: string) {
    const key = `so:${memberId}:${round.id}`
    const parsed = value.trim() === "" ? null : Number(value)
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0 || parsed > 100)) { toast.error("Enter a whole number from 0 to 100."); return }
    setSavingKey(key)
    try { await saveShootOffScore({ organizationId, eventId, shootId, roundId: round.id, squadMemberId: memberId, score: parsed }); await loadShoot() }
    catch (err) { toast.error(err instanceof Error ? err.message : "Shoot-off score could not be saved.") }
    finally { setSavingKey("") }
  }

  const scoredMemberIds = new Set<string>(data.scores.filter((score) => score.score !== null).map((score) => score.squad_member_id))
  data.digitalTotals.filter((row) => row.total_score !== null).forEach((row) => scoredMemberIds.add(row.squad_member_id))
  const completedScores = scoredMemberIds.size
  const expectedScores = checkedInMemberCount * (selectedShoot?.number_of_rounds ?? 0)

  return (
    <div className="min-h-screen">
      <AppHeader title="Round Score Entry" description="Enter and save participant round totals and shoot-off scores" />
      <PageContainer>
        <div className="space-y-5">
          <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-3">
            <label className="space-y-1 text-sm font-medium">Event<select className="w-full rounded-lg border bg-white px-3 py-2" value={eventId} onChange={(e) => { const id = e.target.value; setEventId(id); setShootId(shoots.find((shoot) => shoot.event_id === id)?.id || "") }}>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Shoot<select className="w-full rounded-lg border bg-white px-3 py-2" value={shootId} onChange={(e) => setShootId(e.target.value)}>{eventShoots.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Squad<select className="w-full rounded-lg border bg-white px-3 py-2" value={squadId} onChange={(e) => setSquadId(e.target.value)}>{data.squads.map((squad) => <option key={squad.id} value={squad.id}>Squad {squad.squad_number}{squad.house_number ? ` · House ${squad.house_number}` : ""}{squad.course_name ? ` · ${squad.course_name}` : ""}</option>)}</select></label>
          </section>

          {error ? <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Round score entry could not load.</strong><p>{error}</p></div></div> : null}

          {tiedMembers.length > 0 ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-start gap-3"><Trophy className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>{tiedMembers.length === 1 ? "Tie detected" : `${tiedMembers.length} ties detected`}</strong><p className="mt-1">{tiedMembers.map((tie) => `${tie.names.join(", ")} (${tie.total})`).join(" · ")}</p><p className="mt-2">Enter the shoot-off score in the SO column for each tied participant. Add a shoot-off round if needed.</p></div></div></section> : null}

          <section className="grid gap-3 sm:grid-cols-3">
            <Stat icon={Users} label="Participants (checked in)" value={checkedInMemberCount} />
            <Stat icon={CheckCircle2} label="Scores entered" value={`${completedScores} / ${expectedScores}`} />
            <Stat icon={Trophy} label="Shoot-offs" value={data.shootOffRounds.length} />
          </section>

          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <button type="button" className="flex w-full items-center justify-between gap-4 bg-emerald-50 px-5 py-4 text-left" onClick={() => setShowShootDayTools((current) => !current)}>
              <span>
                <span className="flex items-center gap-2 text-lg font-semibold text-emerald-950"><Shuffle className="h-5 w-5" />Shoot-day changes</span>
                <span className="mt-1 block text-sm text-emerald-800">Register walk-ups, place unassigned participants, or correct squad, post, and starting-station assignments without leaving scoring.</span>
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-emerald-800 transition ${showShootDayTools ? "rotate-180" : ""}`} />
            </button>

            {showShootDayTools ? <div className="grid gap-5 p-5 xl:grid-cols-2">
              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white p-2 shadow-sm"><Users className="h-5 w-5" /></div>
                  <div><h3 className="font-semibold">Assign a registered participant</h3><p className="text-sm text-slate-500">Places someone already registered for this shoot into an open squad position.</p></div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Participant
                    <select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={unassignedEnrollmentId} onChange={(event) => setUnassignedEnrollmentId(event.target.value)}>
                      <option value="">Choose unassigned participant</option>
                      {unassignedEnrollments.map((enrollment) => { const participant = participantForEnrollment(enrollment); return <option key={enrollment.id} value={enrollment.id}>{displayName(participant.athlete)} · {participant.team?.name || "No team"}</option> })}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Squad and post
                    <select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={unassignedAssignment} onChange={(event) => setUnassignedAssignment(event.target.value)}>
                      <option value="">Choose open position</option>
                      {assignmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <Button className="self-end" onClick={() => void assignRegisteredParticipant()} disabled={managementBusy || !unassignedEnrollmentId || !unassignedAssignment}>{managementBusy ? <Loader2 className="animate-spin" /> : <Shuffle />}Assign</Button>
                </div>
                {unassignedEnrollments.length === 0 ? <p className="mt-3 text-sm font-medium text-emerald-700">Everyone registered for this shoot is currently assigned.</p> : null}
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white p-2 shadow-sm"><UserPlus className="h-5 w-5" /></div>
                  <div><h3 className="font-semibold">Register and assign a participant</h3><p className="text-sm text-slate-500">Adds the participant to this shoot, checks them in, and assigns an open position.</p></div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" className={`rounded-lg px-3 py-2 text-sm font-semibold ${quickMode === "existing" ? "bg-slate-950 text-white" : "border bg-white"}`} onClick={() => setQuickMode("existing")}>Existing participant</button>
                  <button type="button" className={`rounded-lg px-3 py-2 text-sm font-semibold ${quickMode === "new" ? "bg-slate-950 text-white" : "border bg-white"}`} onClick={() => setQuickMode("new")}>New walk-up</button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {quickMode === "existing" ? <>
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Find participant<input className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder="Search name, number, or team" /></label>
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Participant<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={quickAthleteId} onChange={(event) => chooseQuickAthlete(event.target.value)}><option value="">Choose participant</option>{filteredAthletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{displayName(athlete)}{athlete.cyssa_number ? ` · ${athlete.cyssa_number}` : ""}</option>)}</select></label>
                  </> : <>
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">First name<input className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={quickFirstName} onChange={(event) => setQuickFirstName(event.target.value)} /></label>
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Last name<input className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={quickLastName} onChange={(event) => setQuickLastName(event.target.value)} /></label>
                  </>}
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Team<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={quickTeamId} onChange={(event) => setQuickTeamId(event.target.value)}><option value="">Choose team</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Class<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={quickClassId} onChange={(event) => setQuickClassId(event.target.value)}><option value="">No class selected</option>{data.classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.display_name || cls.code}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Squad and post<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={quickAssignment} onChange={(event) => setQuickAssignment(event.target.value)}><option value="">Choose open position</option>{assignmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Starting station<input className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" value={quickStartingStation} onChange={(event) => setQuickStartingStation(event.target.value)} placeholder="Optional" /></label>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs text-slate-500">New shoot-day registrations are marked unpaid so the amount remains visible for collection in Treasury. Existing payment status is preserved.</p><Button onClick={() => void registerAndAssignParticipant()} disabled={managementBusy || !quickAssignment}>{managementBusy ? <Loader2 className="animate-spin" /> : <UserPlus />}Register &amp; assign</Button></div>
              </div>
            </div> : null}
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h2 className="text-lg font-semibold">{selectedSquad ? `Squad ${selectedSquad.squad_number}` : "Select a squad"}</h2><p className="text-sm text-slate-500">{selectedShoot ? `${selectedShoot.targets_per_round} targets per round · ${selectedShoot.number_of_rounds} rounds` : ""}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void loadShoot()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button><Button onClick={() => void addShootOff()} disabled={!shootId}><Plus />Add shoot-off</Button></div></header>

            {loading ? <div className="p-12 text-center text-slate-500">Loading scoring data…</div> : squadMembers.length === 0 ? <div className="p-12 text-center text-slate-500">No participants are assigned to this squad. Use Shoot-day changes above to register or assign someone here.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 min-w-60 border-r bg-slate-50 px-4 py-3">Participant</th>
                      <th className="px-3 py-3">Team</th>
                      <th className="px-3 py-3">Class</th>
                      <th className="min-w-60 px-3 py-3">Squad / post</th>
                      <th className="min-w-28 px-3 py-3">Start station</th>
                      {Array.from({ length: selectedShoot?.number_of_rounds ?? 0 }, (_, i) => <th key={i} className="px-2 py-3 text-center">R{i + 1}</th>)}
                      <th className="px-3 py-3 text-center">Total</th>
                      {data.shootOffRounds.map((round) => <th key={round.id} className="px-2 py-2 text-center"><div className="flex items-center justify-center gap-1"><span>{round.label || `SO${round.round_number}`}</span><button className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete shoot-off round" onClick={() => void removeShootOff(round)}><Trash2 className="h-3.5 w-3.5" /></button></div></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {squadMembers.map((member) => {
                      const participant = participantFor(member)
                      const memberSquad = data.squads.find((squad) => squad.id === member.squad_id)
                      const currentAssignment: AssignmentOption = {
                        value: `${member.squad_id}:${member.position}`,
                        squadId: member.squad_id,
                        position: member.position,
                        label: `Squad ${memberSquad?.squad_number ?? "—"} · ${member.position_label || assignmentLabel(selectedShoot?.discipline, member.position)}${memberSquad?.course_name ? ` · ${memberSquad.course_name}` : ""}`,
                      }
                      const total = Array.from({ length: selectedShoot?.number_of_rounds ?? 0 }, (_, i) => scoreMap.get(`${member.id}:${i + 1}`) ?? 0).reduce((a, b) => a + b, 0)
                      return <tr id={`score-member-${member.id}`} key={member.id} className="border-t hover:bg-slate-50/60">
                        <td className="sticky left-0 z-10 border-r bg-white px-4 py-3"><div className="font-semibold">{displayName(participant.athlete)}</div><div className="text-xs text-slate-500">{participant.team?.name || "No team assigned"}</div></td>
                        <td className="px-3 py-3">{participant.team?.name || "—"}</td>
                        <td className="px-3 py-3">{participant.cls?.display_name || participant.cls?.code || "—"}</td>
                        <td className="px-3 py-2">
                          <select aria-label={`Squad and post for ${displayName(participant.athlete)}`} className="w-full rounded-lg border bg-white px-2 py-2 text-sm font-medium" value={currentAssignment.value} disabled={managementBusy} onChange={(event) => void changeMemberAssignment(member, event.target.value)}>
                            <option value={currentAssignment.value}>{currentAssignment.label}</option>
                            {assignmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><input aria-label={`Starting station for ${displayName(participant.athlete)}`} className="w-24 rounded-lg border px-2 py-2 text-center font-semibold" defaultValue={member.starting_station ?? ""} placeholder="—" disabled={managementBusy} onBlur={(event) => void commitStartingStation(member, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur() }} /></td>
                        {Array.from({ length: selectedShoot?.number_of_rounds ?? 0 }, (_, i) => { const round = i + 1; const key = `${member.id}:${round}`; return <td key={round} className="px-2 py-2"><div className="relative"><input ref={(node) => { inputRefs.current[key] = node }} inputMode="numeric" className="h-10 w-16 rounded-lg border px-2 text-center text-base font-semibold focus:border-slate-900 focus:ring-2 focus:ring-slate-200" value={scoreValue(member.id, round)} onChange={(e) => setDrafts((current) => ({ ...current, [key]: e.target.value.replace(/[^0-9]/g, "") }))} onBlur={() => void commitRound(member.id, round)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commitRound(member.id, round, true) } }} maxLength={3} />{savingKey === key ? <Save className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse text-slate-500" /> : null}</div></td> })}
                        <td className="px-3 py-3 text-center text-lg font-bold">{total}</td>
                        {data.shootOffRounds.map((round) => { const current = shootOffScoreMap.get(`${member.id}:${round.id}`); return <td key={round.id} className="px-2 py-2"><input data-shoot-off aria-label={`Shoot-off ${round.round_number} for ${displayName(participant.athlete)}`} inputMode="numeric" defaultValue={current ?? ""} className="h-10 w-16 rounded-lg border border-amber-300 bg-amber-50 px-2 text-center text-base font-semibold" onBlur={(e) => void commitShootOff(member.id, round, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }} /></td> })}
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="text-xs text-slate-500">Scores save automatically when you press Enter or leave a field. Pressing Enter advances from R1 to R2, then through the remaining rounds.</p>
        </div>
      </PageContainer>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string | number }) {
  return <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"><div className="rounded-lg bg-slate-100 p-2"><Icon className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="text-xl font-bold">{value}</p></div></div>
}
