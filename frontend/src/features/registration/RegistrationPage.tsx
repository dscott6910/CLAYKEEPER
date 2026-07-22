import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

type OrganizationMembership = {
  organization_id: string
}

type EventRecord = {
  id: string
  organization_id: string
  name: string
  status: string | null
  start_date: string | null
  end_date: string | null
}

type ShootRecord = {
  id: string
  organization_id: string
  event_id: string
  name: string
  discipline: string | null
  entry_fee: number | null
  organization_fee: number | null
  status: string | null
}

type AthleteRecord = {
  id: string
  organization_id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  membership_number: string | null
  status: string | null
}

type TeamRecord = {
  id: string
  organization_id: string
  name: string
}

type ClassRecord = {
  id: string
  organization_id: string
  code: string
  name: string
  sort_order?: number | null
}

type RegistrationRecord = {
  id: string
  organization_id: string
  event_id: string
  athlete_id: string
  team_id: string | null
  class_id: string | null
  registration_number: string | null
  status: string | null
  payment_status: string | null
  registration_fee: number | null
  discount_amount: number | null
  amount_paid: number | null
  checked_in: boolean | null
  registered_at: string | null
  created_at: string | null
}

type RegistrationShootRecord = {
  id: string
  organization_id: string
  event_id: string
  registration_id: string
  shoot_id: string
  status: string | null
  entry_fee: number | null
  organization_fee: number | null
  fee_adjustment: number | null
  total_fee: number | null
}

type RegistrationFormState = {
  athleteId: string
  teamId: string
  classId: string
  shootIds: string[]
  paymentStatus: string
  amountPaid: string
  notes: string
}

const initialFormState: RegistrationFormState = {
  athleteId: "",
  teamId: "",
  classId: "",
  shootIds: [],
  paymentStatus: "unpaid",
  amountPaid: "0",
  notes: "",
}

function getErrorMessage(error: unknown): string {
  console.error("ClayKeeper registration error:", error)

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  if (error && typeof error === "object") {
    const possibleError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    const parts = [
      possibleError.message,
      possibleError.details,
      possibleError.hint,
      possibleError.code ? `Code: ${possibleError.code}` : undefined,
    ].filter(Boolean)

    if (parts.length > 0) {
      return parts.join(" — ")
    }

    try {
      return JSON.stringify(error)
    } catch {
      return "An unknown database error occurred."
    }
  }

  return "An unknown error occurred."
}

function formatCurrency(value: number | string | null | undefined) {
  const parsedValue = Number(value ?? 0)
  const safeValue = Number.isFinite(parsedValue) ? parsedValue : 0

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(safeValue)
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Date not set"
  }

  const dateValue = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`)

  if (Number.isNaN(dateValue.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateValue)
}

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Not Set"
  }

  return value
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(" ")
}

function athleteDisplayName(athlete: AthleteRecord) {
  const firstName =
    athlete.preferred_name?.trim() ||
    athlete.first_name?.trim() ||
    ""

  const lastName = athlete.last_name?.trim() || ""

  return `${firstName} ${lastName}`.trim() || "Unnamed athlete"
}

export function RegistrationPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(
    null,
  )

  const [events, setEvents] = useState<EventRecord[]>([])
  const [selectedEventId, setSelectedEventId] = useState("")

  const [shoots, setShoots] = useState<ShootRecord[]>([])
  const [athletes, setAthletes] = useState<AthleteRecord[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])

  const [registrations, setRegistrations] = useState<
    RegistrationRecord[]
  >([])

  const [registrationShoots, setRegistrationShoots] = useState<
    RegistrationShootRecord[]
  >([])

  const [form, setForm] =
    useState<RegistrationFormState>(initialFormState)

  const [searchText, setSearchText] = useState("")
  const [showRegistrationForm, setShowRegistrationForm] =
    useState(false)

  const [loadingInitialData, setLoadingInitialData] = useState(true)
  const [loadingEventData, setLoadingEventData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingRegistrationId, setUpdatingRegistrationId] =
    useState<string | null>(null)

  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const selectedEvent = useMemo(() => {
    return events.find((event) => event.id === selectedEventId) ?? null
  }, [events, selectedEventId])

  const athleteById = useMemo(() => {
    return new Map(
      athletes.map((athlete) => [athlete.id, athlete]),
    )
  }, [athletes])

  const teamById = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]))
  }, [teams])

  const classById = useMemo(() => {
    return new Map(
      classes.map((competitionClass) => [
        competitionClass.id,
        competitionClass,
      ]),
    )
  }, [classes])

  const shootById = useMemo(() => {
    return new Map(shoots.map((shoot) => [shoot.id, shoot]))
  }, [shoots])

  const registrationShootsByRegistrationId = useMemo(() => {
    const groupedRows = new Map<string, RegistrationShootRecord[]>()

    for (const row of registrationShoots) {
      const existingRows =
        groupedRows.get(row.registration_id) ?? []

      existingRows.push(row)
      groupedRows.set(row.registration_id, existingRows)
    }

    return groupedRows
  }, [registrationShoots])

  const selectedShootTotal = useMemo(() => {
    return form.shootIds.reduce((total, shootId) => {
      const shoot = shootById.get(shootId)

      if (!shoot) {
        return total
      }

      return (
        total +
        Number(shoot.entry_fee ?? 0) +
        Number(shoot.organization_fee ?? 0)
      )
    }, 0)
  }, [form.shootIds, shootById])

  const filteredRegistrations = useMemo(() => {
    const searchValue = searchText.trim().toLowerCase()

    if (!searchValue) {
      return registrations
    }

    return registrations.filter((registration) => {
      const athlete = athleteById.get(registration.athlete_id)
      const athleteName = athlete
        ? athleteDisplayName(athlete).toLowerCase()
        : ""

      const membershipNumber =
        athlete?.membership_number?.toLowerCase() ?? ""

      const registrationNumber =
        registration.registration_number?.toLowerCase() ?? ""

      const paymentStatus =
        registration.payment_status?.toLowerCase() ?? ""

      const teamName = registration.team_id
        ? teamById.get(registration.team_id)?.name.toLowerCase() ?? ""
        : ""

      return (
        athleteName.includes(searchValue) ||
        membershipNumber.includes(searchValue) ||
        registrationNumber.includes(searchValue) ||
        paymentStatus.includes(searchValue) ||
        teamName.includes(searchValue)
      )
    })
  }, [
    athleteById,
    registrations,
    searchText,
    teamById,
  ])

  const paidCount = useMemo(() => {
    return registrations.filter((registration) => {
      return registration.payment_status === "paid"
    }).length
  }, [registrations])

  const checkedInCount = useMemo(() => {
    return registrations.filter((registration) => {
      return Boolean(registration.checked_in)
    }).length
  }, [registrations])

  const eventFeeTotal = useMemo(() => {
    const registrationFeeTotal = registrations.reduce(
      (total, registration) => {
        return (
          total +
          Number(registration.registration_fee ?? 0) -
          Number(registration.discount_amount ?? 0)
        )
      },
      0,
    )

    const shootFeeTotal = registrationShoots.reduce(
      (total, registrationShoot) => {
        const calculatedFee =
          Number(registrationShoot.entry_fee ?? 0) +
          Number(registrationShoot.organization_fee ?? 0) +
          Number(registrationShoot.fee_adjustment ?? 0)

        return (
          total +
          Number(
            registrationShoot.total_fee ?? calculatedFee,
          )
        )
      },
      0,
    )

    return registrationFeeTotal + shootFeeTotal
  }, [registrations, registrationShoots])

  const loadOrganizationData = useCallback(async () => {
    setLoadingInitialData(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error(
          "No authenticated user was found. Please sign in again.",
        )
      }

      const {
        data: membershipData,
        error: membershipError,
      } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()

      if (membershipError) {
        throw membershipError
      }

      const membership =
        membershipData as OrganizationMembership | null

      if (!membership?.organization_id) {
        throw new Error(
          "Your account is not assigned to an organization.",
        )
      }

      const currentOrganizationId = membership.organization_id

      setOrganizationId(currentOrganizationId)

      const [
        eventsResponse,
        athletesResponse,
        teamsResponse,
        classesResponse,
      ] = await Promise.all([
        supabase
          .from("events")
          .select("*")
          .eq("organization_id", currentOrganizationId)
          .order("start_date", { ascending: false }),

        supabase
          .from("athletes")
          .select("*")
          .eq("organization_id", currentOrganizationId)
          .order("last_name", { ascending: true })
          .order("first_name", { ascending: true }),

        supabase
          .from("teams")
          .select("*")
          .eq("organization_id", currentOrganizationId)
          .order("name", { ascending: true }),

        supabase
          .from("classes")
          .select("*")
          .eq("organization_id", currentOrganizationId)
          .order("code", { ascending: true }),
      ])

      if (eventsResponse.error) {
        throw new Error(
          `Events could not be loaded: ${getErrorMessage(
            eventsResponse.error,
          )}`,
        )
      }

      if (athletesResponse.error) {
        throw new Error(
          `Athletes could not be loaded: ${getErrorMessage(
            athletesResponse.error,
          )}`,
        )
      }

      if (teamsResponse.error) {
        throw new Error(
          `Teams could not be loaded: ${getErrorMessage(
            teamsResponse.error,
          )}`,
        )
      }

      if (classesResponse.error) {
        throw new Error(
          `Classes could not be loaded: ${getErrorMessage(
            classesResponse.error,
          )}`,
        )
      }

      const eventRows =
        (eventsResponse.data ?? []) as EventRecord[]

      const athleteRows =
        (athletesResponse.data ?? []) as AthleteRecord[]

      const teamRows =
        (teamsResponse.data ?? []) as TeamRecord[]

      const classRows =
        (classesResponse.data ?? []) as ClassRecord[]

      setEvents(eventRows)
      setAthletes(athleteRows)
      setTeams(teamRows)
      setClasses(classRows)

      setSelectedEventId((currentEventId) => {
        if (
          currentEventId &&
          eventRows.some((event) => event.id === currentEventId)
        ) {
          return currentEventId
        }

        return eventRows[0]?.id ?? ""
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setLoadingInitialData(false)
    }
  }, [])

  const loadSelectedEventData = useCallback(async () => {
    if (!organizationId || !selectedEventId) {
      setShoots([])
      setRegistrations([])
      setRegistrationShoots([])
      return
    }

    setLoadingEventData(true)
    setErrorMessage("")

    try {
      const [shootsResponse, registrationsResponse] =
        await Promise.all([
          supabase
            .from("shoots")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("event_id", selectedEventId)
            .order("name", { ascending: true }),

          supabase
            .from("registrations")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("event_id", selectedEventId)
            .order("created_at", { ascending: false }),
        ])

      if (shootsResponse.error) {
        throw new Error(
          `Shoots could not be loaded: ${getErrorMessage(
            shootsResponse.error,
          )}`,
        )
      }

      if (registrationsResponse.error) {
        throw new Error(
          `Registrations could not be loaded: ${getErrorMessage(
            registrationsResponse.error,
          )}`,
        )
      }

      const shootRows =
        (shootsResponse.data ?? []) as ShootRecord[]

      const registrationRows =
        (registrationsResponse.data ?? []) as RegistrationRecord[]

      setShoots(shootRows)
      setRegistrations(registrationRows)

      const registrationIds = registrationRows.map(
        (registration) => registration.id,
      )

      if (registrationIds.length === 0) {
        setRegistrationShoots([])
        return
      }

      const registrationShootsResponse = await supabase
        .from("registration_shoots")
        .select("*")
        .in("registration_id", registrationIds)

      if (registrationShootsResponse.error) {
        throw new Error(
          `Registered shoots could not be loaded: ${getErrorMessage(
            registrationShootsResponse.error,
          )}`,
        )
      }

      setRegistrationShoots(
        (registrationShootsResponse.data ??
          []) as RegistrationShootRecord[],
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setLoadingEventData(false)
    }
  }, [organizationId, selectedEventId])

  useEffect(() => {
    void loadOrganizationData()
  }, [loadOrganizationData])

  useEffect(() => {
    void loadSelectedEventData()
  }, [loadSelectedEventData])

  function updateForm<K extends keyof RegistrationFormState>(
    field: K,
    value: RegistrationFormState[K],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function toggleShoot(shootId: string) {
    setForm((currentForm) => {
      const shootAlreadySelected =
        currentForm.shootIds.includes(shootId)

      return {
        ...currentForm,
        shootIds: shootAlreadySelected
          ? currentForm.shootIds.filter((id) => id !== shootId)
          : [...currentForm.shootIds, shootId],
      }
    })
  }

  function openRegistrationForm() {
    setForm(initialFormState)
    setErrorMessage("")
    setSuccessMessage("")
    setShowRegistrationForm(true)
  }

  function closeRegistrationForm() {
    setForm(initialFormState)
    setErrorMessage("")
    setShowRegistrationForm(false)
  }

  async function createRegistration() {
    if (!organizationId) {
      setErrorMessage("No organization is currently selected.")
      return
    }

    if (!selectedEventId) {
      setErrorMessage("Select an event before registering an athlete.")
      return
    }

    if (!form.athleteId) {
      setErrorMessage("Select an athlete.")
      return
    }

    if (form.shootIds.length === 0) {
      setErrorMessage("Select at least one shoot.")
      return
    }

    const duplicateRegistration = registrations.some(
      (registration) => {
        return registration.athlete_id === form.athleteId
      },
    )

    if (duplicateRegistration) {
      setErrorMessage(
        "This athlete is already registered for the selected event.",
      )
      return
    }

    const amountPaid = Number(form.amountPaid || 0)

    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      setErrorMessage("Amount paid must be zero or greater.")
      return
    }

    setSaving(true)
    setErrorMessage("")
    setSuccessMessage("")

    let createdRegistrationId: string | null = null

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error(
          "Your login session has expired. Please sign in again.",
        )
      }

      const registrationInsert = {
        organization_id: organizationId,
        event_id: selectedEventId,
        athlete_id: form.athleteId,
        team_id: form.teamId || null,
        class_id: form.classId || null,
        status: "registered",
        registration_source: "manual",
        payment_status: form.paymentStatus,
        amount_paid: amountPaid,
        paid_at:
          form.paymentStatus === "paid"
            ? new Date().toISOString()
            : null,
        notes: form.notes.trim() || null,
        created_by: user.id,
      }

      const registrationResponse = await supabase
        .from("registrations")
        .insert(registrationInsert)
        .select("*")
        .single()

      if (registrationResponse.error) {
        throw new Error(
          `Registration could not be created: ${getErrorMessage(
            registrationResponse.error,
          )}`,
        )
      }

      const createdRegistration =
        registrationResponse.data as RegistrationRecord

      createdRegistrationId = createdRegistration.id

      const registrationShootRows = form.shootIds.map(
        (shootId) => {
          const shoot = shootById.get(shootId)

          if (!shoot) {
            throw new Error(
              "One of the selected shoots could not be found.",
            )
          }

          return {
            organization_id: organizationId,
            event_id: selectedEventId,
            registration_id: createdRegistration.id,
            shoot_id: shoot.id,
            status: "registered",
            entry_fee: Number(shoot.entry_fee ?? 0),
            organization_fee: Number(
              shoot.organization_fee ?? 0,
            ),
            fee_adjustment: 0,
            squad_assignment_status: "unassigned",
          }
        },
      )

      const shootInsertResponse = await supabase
        .from("registration_shoots")
        .insert(registrationShootRows)

      if (shootInsertResponse.error) {
        throw new Error(
          `Shoot registrations could not be created: ${getErrorMessage(
            shootInsertResponse.error,
          )}`,
        )
      }

      setSuccessMessage(
        createdRegistration.registration_number
          ? `Registration ${createdRegistration.registration_number} was created successfully.`
          : "The athlete was registered successfully.",
      )

      setForm(initialFormState)
      setShowRegistrationForm(false)

      await loadSelectedEventData()
    } catch (error) {
      if (createdRegistrationId) {
        const cleanupResponse = await supabase
          .from("registrations")
          .delete()
          .eq("id", createdRegistrationId)

        if (cleanupResponse.error) {
          console.error(
            "Unable to remove incomplete registration:",
            cleanupResponse.error,
          )
        }
      }

      setErrorMessage(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function toggleCheckIn(
    registration: RegistrationRecord,
  ) {
    setUpdatingRegistrationId(registration.id)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error(
          "Your login session has expired. Please sign in again.",
        )
      }

      const newCheckedInStatus = !registration.checked_in

      const updateResponse = await supabase
        .from("registrations")
        .update({
          checked_in: newCheckedInStatus,
          checked_in_at: newCheckedInStatus
            ? new Date().toISOString()
            : null,
          checked_in_by: newCheckedInStatus ? user.id : null,
        })
        .eq("id", registration.id)
        .eq("organization_id", registration.organization_id)

      if (updateResponse.error) {
        throw new Error(
          `Check-in could not be updated: ${getErrorMessage(
            updateResponse.error,
          )}`,
        )
      }

      setSuccessMessage(
        newCheckedInStatus
          ? "Athlete checked in successfully."
          : "Athlete check-in was removed.",
      )

      await loadSelectedEventData()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setUpdatingRegistrationId(null)
    }
  }

  if (loadingInitialData) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading registration manager…
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ClipboardList className="h-4 w-4" />
              Competition Management
            </div>

            <h1 className="text-3xl font-semibold tracking-tight">
              Registration
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Register athletes, select shoots, track fees, and
              manage event check-in.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void loadOrganizationData()
                void loadSelectedEventData()
              }}
              disabled={loadingInitialData || loadingEventData}
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loadingInitialData || loadingEventData
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </Button>

            <Button
              type="button"
              onClick={openRegistrationForm}
              disabled={!selectedEventId || loadingEventData}
            >
              <UserPlus className="h-4 w-4" />
              Add Registration
            </Button>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong className="font-semibold">Error: </strong>
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        ) : null}

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <label
            htmlFor="registration-event"
            className="mb-2 block text-sm font-medium"
          >
            Event
          </label>

          <select
            id="registration-event"
            value={selectedEventId}
            onChange={(event) => {
              setSelectedEventId(event.target.value)
              setShowRegistrationForm(false)
              setSuccessMessage("")
              setErrorMessage("")
            }}
            className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">
              {events.length === 0
                ? "No events have been created"
                : "Select an event"}
            </option>

            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} — {formatDate(event.start_date)}
              </option>
            ))}
          </select>

          {selectedEvent ? (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>
                Status: {formatLabel(selectedEvent.status)}
              </span>

              <span>
                Date: {formatDate(selectedEvent.start_date)}
                {selectedEvent.end_date &&
                selectedEvent.end_date !== selectedEvent.start_date
                  ? ` – ${formatDate(selectedEvent.end_date)}`
                  : ""}
              </span>

              <span>
                Shoots: {shoots.length}
              </span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Registrations"
            value={registrations.length.toString()}
            icon={Users}
          />

          <SummaryCard
            label="Paid"
            value={paidCount.toString()}
            icon={BadgeCheck}
          />

          <SummaryCard
            label="Checked In"
            value={checkedInCount.toString()}
            icon={CheckCircle2}
          />

          <SummaryCard
            label="Event Fees"
            value={formatCurrency(eventFeeTotal)}
            icon={DollarSign}
          />
        </section>

        {showRegistrationForm ? (
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Add Athlete Registration
              </h2>

              <p className="text-sm text-muted-foreground">
                Register one athlete in one or more shoots for the
                selected event.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <FormField label="Athlete" required>
                  <select
                    value={form.athleteId}
                    onChange={(event) => {
                      updateForm("athleteId", event.target.value)
                    }}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Select an athlete</option>

                    {athletes.map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>
                        {athleteDisplayName(athlete)}
                        {athlete.membership_number
                          ? ` — ${athlete.membership_number}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Team">
                    <select
                      value={form.teamId}
                      onChange={(event) => {
                        updateForm("teamId", event.target.value)
                      }}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">No team</option>

                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Class">
                    <select
                      value={form.classId}
                      onChange={(event) => {
                        updateForm("classId", event.target.value)
                      }}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">No class</option>

                      {classes.map((competitionClass) => (
                        <option
                          key={competitionClass.id}
                          value={competitionClass.id}
                        >
                          {competitionClass.code} —{" "}
                          {competitionClass.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Payment Status">
                    <select
                      value={form.paymentStatus}
                      onChange={(event) => {
                        updateForm(
                          "paymentStatus",
                          event.target.value,
                        )
                      }}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="waived">Waived</option>
                      <option value="not_required">
                        Not Required
                      </option>
                    </select>
                  </FormField>

                  <FormField label="Amount Paid">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amountPaid}
                      onChange={(event) => {
                        updateForm("amountPaid", event.target.value)
                      }}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    />
                  </FormField>
                </div>

                <FormField label="Notes">
                  <textarea
                    value={form.notes}
                    onChange={(event) => {
                      updateForm("notes", event.target.value)
                    }}
                    rows={4}
                    placeholder="Optional registration notes"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </FormField>
              </div>

              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-medium">
                    Shoot Selection
                  </h3>

                  <p className="text-xs text-muted-foreground">
                    Select every shoot the athlete is entering.
                  </p>
                </div>

                <div className="space-y-2">
                  {shoots.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                      The selected event does not have any shoots.
                    </div>
                  ) : null}

                  {shoots.map((shoot) => {
                    const selected = form.shootIds.includes(shoot.id)

                    const shootTotal =
                      Number(shoot.entry_fee ?? 0) +
                      Number(shoot.organization_fee ?? 0)

                    return (
                      <label
                        key={shoot.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleShoot(shoot.id)}
                          className="mt-1 h-4 w-4"
                        />

                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            {shoot.name}
                          </span>

                          <span className="block text-xs text-muted-foreground">
                            {formatLabel(shoot.discipline)}
                          </span>
                        </span>

                        <span className="text-sm font-medium">
                          {formatCurrency(shootTotal)}
                        </span>
                      </label>
                    )
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                  <span className="text-sm font-medium">
                    Selected Shoot Fees
                  </span>

                  <span className="text-lg font-semibold">
                    {formatCurrency(selectedShootTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={closeRegistrationForm}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() => void createRegistration()}
                disabled={saving || shoots.length === 0}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}

                Create Registration
              </Button>
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Event Registrations
              </h2>

              <p className="text-sm text-muted-foreground">
                {filteredRegistrations.length} registration
                {filteredRegistrations.length === 1 ? "" : "s"} shown
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value)
                }}
                placeholder="Search athlete or registration…"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          {loadingEventData ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading registrations…
            </div>
          ) : null}

          {!loadingEventData &&
          filteredRegistrations.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />

              <h3 className="font-medium">
                No registrations found
              </h3>

              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Select an event and add its first athlete
                registration.
              </p>
            </div>
          ) : null}

          {!loadingEventData &&
          filteredRegistrations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      Registration
                    </th>
                    <th className="px-5 py-3 font-medium">
                      Athlete
                    </th>
                    <th className="px-5 py-3 font-medium">
                      Team / Class
                    </th>
                    <th className="px-5 py-3 font-medium">
                      Shoots
                    </th>
                    <th className="px-5 py-3 font-medium">
                      Fees
                    </th>
                    <th className="px-5 py-3 font-medium">
                      Payment
                    </th>
                    <th className="px-5 py-3 font-medium">
                      Check-In
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredRegistrations.map((registration) => {
                    const athlete = athleteById.get(
                      registration.athlete_id,
                    )

                    const registrationShootRows =
                      registrationShootsByRegistrationId.get(
                        registration.id,
                      ) ?? []

                    const registrationTotal =
                      Number(registration.registration_fee ?? 0) -
                      Number(registration.discount_amount ?? 0)

                    const shootTotal =
                      registrationShootRows.reduce(
                        (total, registrationShoot) => {
                          const calculatedTotal =
                            Number(
                              registrationShoot.entry_fee ?? 0,
                            ) +
                            Number(
                              registrationShoot.organization_fee ??
                                0,
                            ) +
                            Number(
                              registrationShoot.fee_adjustment ?? 0,
                            )

                          return (
                            total +
                            Number(
                              registrationShoot.total_fee ??
                                calculatedTotal,
                            )
                          )
                        },
                        0,
                      )

                    const team = registration.team_id
                      ? teamById.get(registration.team_id)
                      : null

                    const competitionClass = registration.class_id
                      ? classById.get(registration.class_id)
                      : null

                    const registrationDate =
                      registration.registered_at ??
                      registration.created_at

                    const isUpdating =
                      updatingRegistrationId === registration.id

                    return (
                      <tr
                        key={registration.id}
                        className="align-top hover:bg-muted/30"
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium">
                            {registration.registration_number ||
                              "Pending Number"}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {formatDate(registrationDate)}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium">
                            {athlete
                              ? athleteDisplayName(athlete)
                              : "Unknown athlete"}
                          </div>

                          {athlete?.membership_number ? (
                            <div className="text-xs text-muted-foreground">
                              {athlete.membership_number}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-5 py-4">
                          <div>{team?.name ?? "No team"}</div>

                          <div className="text-xs text-muted-foreground">
                            {competitionClass
                              ? `${competitionClass.code} — ${competitionClass.name}`
                              : "No class"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex max-w-72 flex-wrap gap-1">
                            {registrationShootRows.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                No shoots
                              </span>
                            ) : null}

                            {registrationShootRows.map(
                              (registrationShoot) => (
                                <span
                                  key={registrationShoot.id}
                                  className="rounded-full bg-muted px-2 py-1 text-xs"
                                >
                                  {shootById.get(
                                    registrationShoot.shoot_id,
                                  )?.name ?? "Unknown shoot"}
                                </span>
                              ),
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-medium">
                          {formatCurrency(
                            registrationTotal + shootTotal,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              registration.payment_status === "paid"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : registration.payment_status ===
                                    "partial"
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {formatLabel(
                              registration.payment_status,
                            )}
                          </span>

                          <div className="mt-1 text-xs text-muted-foreground">
                            Paid:{" "}
                            {formatCurrency(
                              registration.amount_paid,
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              registration.checked_in
                                ? "default"
                                : "outline"
                            }
                            onClick={() => {
                              void toggleCheckIn(registration)
                            }}
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}

                            {registration.checked_in
                              ? "Checked In"
                              : "Check In"}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </PageContainer>
  )
}

type SummaryCardProps = {
  label: string
  value: string
  icon: LucideIcon
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: SummaryCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {value}
          </p>
        </div>

        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}

type FormFieldProps = {
  label: string
  required?: boolean
  children: ReactNode
}

function FormField({
  label,
  required = false,
  children,
}: FormFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">
        {label}

        {required ? (
          <span className="ml-1 text-destructive">*</span>
        ) : null}
      </span>

      {children}
    </label>
  )
}