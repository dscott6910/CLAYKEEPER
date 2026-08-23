import { useEffect, useRef, useState } from "react"
import type {
  FormEvent,
  HTMLAttributes,
  PointerEvent,
} from "react"
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom"
import {
  ArrowLeft,
  CalendarDays,
  LockKeyhole,
  Mail,
  Phone,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/useAuth"
import {
  clearPendingParticipantSignup,
  completeParticipantSignup,
  createParticipantAccount,
  loadParticipantSignupOrganization,
  loadParticipantSignupFromUserMetadata,
  loadPendingParticipantSignup,
  type ParticipantSignupOrganization,
} from "@/lib/services/participantSignup"
import {
  APP_VERSION,
  CLAYKEEPER_LOGO,
} from "@/lib/branding"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    return String(error.message)
  }

  return "Unable to create the account. Please try again."
}

export type WaiverKey =
  | "parentAthlete"
  | "medicalConsent"
  | "sportsmanship"
  | "clayKeeperAgreement"

export const WAIVER_FORMS: Record<
  WaiverKey,
  {
    title: string
    checkboxLabel: string
    body: string
  }
> = {
  parentAthlete: {
    title: "Parents/Guardians and Athletes Waiver Form",
    checkboxLabel:
      "I agree to the Parents/Guardians and Athletes Waiver Form",
    body: `Parents/Guardians Athletes — Please Read Carefully

In exchange for and as a condition of being allowed to participate in the California Youth Shooting Sports Association (hereafter "CYSSA") clay target program, Athlete and Athlete's parent or legal guardian, if Athlete is a minor child(ren), agree to the following:

The parties acknowledge that the CYSSA clay target program is a team-based program that provides team and individual competitions in clay target sports involving the use of firearms. Failure to adhere to safe handling and use of firearms at all venues and locations may be grounds for removal from the CYSSA program.

The parties request to participate knowing and understanding that there are risks and dangers associated with the use of firearms, including property damage, serious bodily injury, and death. The parties agree to assume all known and unknown risks, inherent or otherwise, connected with participation in the CYSSA program, including risks connected with other competitors, instructors, coaches, staff, volunteers, organizations, venues, equipment, ammunition, mechanical devices, machinery, and clay target shooting facilities.

To the fullest extent allowed by law, the parties agree to defend, indemnify and hold harmless CYSSA and all involved or affiliated organizations and individuals, and each of their respective directors, officers, employees, agents, and volunteers, from and against claims, demands, actions, suits, proceedings, liabilities, damages, losses, judgments and expenses arising out of participation or conduct in CYSSA.

The parties grant CYSSA and involved or affiliated organizations and individuals a royalty-free license to reproduce, publish, distribute, sell, or otherwise use the participant's name, photograph, likeness, and statements in connection with promotion of the CYSSA program.

The parties acknowledge this waiver is binding upon the parties, their agents, heirs, assigns, and next of kin. The parties understand and voluntarily accept all risks associated with participation in CYSSA and agree that CYSSA will not be liable for injury, property damage, mental or economic loss, or other damage resulting from participation.

Special Waiver of Claim for Ammunition, Safety Equipment, and Loaned Firearms

For athletes under 18 years of age, the parent or legal guardian understands that a minor is prohibited by law from purchasing and owning a firearm and ammunition. The parent or legal guardian agrees to legally purchase, directly provide, and furnish all appropriate firearms, ammunition, ear and eye protection, and safety equipment to the minor child for participation in CYSSA.

The parent or legal guardian further consents and authorizes CYSSA adult coaches who have legally procured appropriate ammunition, eye and ear protection, and safety equipment to provide those items to the minor child from time to time for participation in CYSSA.

From time to time, the minor child may be temporarily provided a loaned firearm, ear protection, eye protection, or safety equipment. The parent or legal guardian releases and agrees to indemnify CYSSA and all involved or affiliated organizations and individuals from liability for actions that may result while the loaned firearm or equipment is in the parent, guardian, or minor child's possession or use.

By accepting this waiver electronically, the parent or legal guardian confirms that they have read and understood this waiver and assumption of risk, and expressly waive and release CYSSA and all respective officers, employees, agents, volunteers, and representatives from liability arising from participation in CYSSA activities.`,
  },
  medicalConsent: {
    title: "Medical Consent",
    checkboxLabel: "I agree to the Medical Consent",
    body: `In the event that the Athlete may require emergency medical care, or in the event the Athlete may become ill while participating in a California Youth Shooting Sports Association event, Athlete and Athlete's parent/legal guardian if Athlete is a minor hereby gives advanced consent to the CYSSA program, CYSSA Sponsors, and involved or affiliated organizations including their respective volunteers, to provide, through a medical staff of their choice, necessary or advisable medical care and treatment to Athlete.

Athlete and Athlete's parent/legal guardian if Athlete is a minor further agree to pay any and all medical costs, expenses, and charges and to release, waive, discharge, and hold harmless the California Youth Shooting Sports Association program, CYSSA Sponsors, and involved or affiliated organizations including their respective volunteers, officers, employees, or agents, from and against any liability or any claim or demand arising from or connected with such medical care and treatment.`,
  },
  sportsmanship: {
    title: "Sportsmanship Contract",
    checkboxLabel: "I agree to the Sportsmanship Contract",
    body: `The California Youth Shooting Sports Association Clay Target Program places a strong emphasis on sportsmanship and safety. As part of this effort, parents/guardians are asked to read and discuss this contract with their child/athlete. This is a contract among the CYSSA, the parent/guardian, and his/her child. The signatures on this form signify an agreement to comply with the provisions of this contract.

Parents:

I understand the California Youth Shooting Sports Association program's first and foremost priority is safety. I will enforce the CYSSA safety standards with my child at all times. I will encourage my child and other team members to have fun. I will behave as a positive role model, respect the goals of the CYSSA, and reinforce the character values of good sportsmanship, teamwork, and self-discipline.

I agree to stay off the shooting field. Any problems or criticisms will be presented in a positive way to the coaches or a designated assistant. I will refrain from criticizing other shooters or coaches, using abusive language, or consuming alcohol or drugs before or during all CYSSA program activities that I attend.

I understand that unsportsmanlike behavior on my part may result in my being asked to leave the area. Such actions on my part could also result in my child being disqualified or removed from the CYSSA program. By signing this form, I affirm that I have read and understand the behavioral standards for parents and for my child, and agree to abide by them.

Athlete:

I understand shooting on a California Youth Shooting Sports Association team is a privilege. I agree to act responsibly and obey all rules as specified in the CYSSA Handbook while participating in CYSSA activities. I will encourage and support my teammates, cooperate and show respect to my coaches, and represent the team in a positive manner both at practices and in competition.

I will set specific attainable goals, attend practices with a positive attitude, practice good sportsmanship at all times, and conduct myself as a lady or gentleman at all times.

I understand that unsportsmanlike behavior, use of illegal drugs or alcohol, or acts of violence on my part may result in my disqualification and even expulsion from the CYSSA program. I will not lie, cheat, or steal nor tolerate those who do. By signing this form, I affirm that I am academically eligible to participate in extracurricular activities as set forth by my school, that I have read and understand the behavioral standards for athletes, and that I agree to abide by them.`,
  },
  clayKeeperAgreement: {
    title: "ClayKeeper Agreement and Liability Waiver",
    checkboxLabel:
      "I agree to the ClayKeeper Agreement and Waiver",
    body: `Please read the following agreement and waiver carefully, as it affects your future legal rights. By proceeding with registration, you acknowledge and agree that you have carefully read this agreement and waiver and agree to the terms set forth below.

The activity for which you are registering may be physically challenging and may pose a risk of discomfort, illness, injury, and even death. It is your responsibility to ensure that each participant is in sufficient physical condition to participate without risk to health or life.

Some events may pose risks to participants and observers. Risks cannot be removed completely, and participants and observers attend at their own risk. If you are registering or accompanying anyone under the age of 18, you agree to this Agreement and Waiver on behalf of that person.

Authority to Register and Act as Agent:

You represent and warrant that you have full legal authority and capacity to complete registration for the event on behalf of yourself and, where applicable, any party for whom you are registering, including authority to make use of the credit or debit card to which registration fees may be charged.

If you are registering a child under the age of 18 or an incapacitated adult, you represent and warrant that you are the parent or legal guardian of that party and have the legal authority and capacity to enter into this Agreement and Waiver on their behalf.

Assumption of Risk:

In consideration of acceptance of registration and participation in the event, you assume full and complete risk and responsibility for any discomfort, illness, injury, or accident which may occur while preparing for the event, during the event, while on the premises of the event, or while traveling to or from the event. Participation may carry inherent risks and dangers that cannot be eliminated completely.

Representations:

You represent and warrant that each participant is in sufficient physical condition to safely participate and has no medical condition that would make participation more hazardous. You consent to medical care and transportation to obtain treatment in the event of injury and understand that this waiver extends to liability arising out of medical treatment and transportation provided in an emergency.

You agree to observe and obey all posted rules and warnings, follow instructions or directions provided by ClayKeeper or the event organizer, and abide by decisions of event officials regarding safe participation or attendance. Event officials may dismiss a participant without refund if behavior endangers safety or negatively affects the event.

Release and Waiver of Liability:

You waive, release, covenant not to sue, and forever discharge ClayKeeper and all other persons associated with the event for liabilities, claims, actions, or damages arising out of or connected with registration or participation in the event, including claims caused by negligence of the released parties to the maximum extent permitted by law.

Indemnity:

You agree to indemnify, defend, and hold harmless ClayKeeper and all other persons associated with the event from liabilities arising out of or connected with participation in the event, use of ClayKeeper, or violation of this Agreement and Waiver.

Acceptance:

By indicating acceptance of this Agreement and Waiver, you affirm that you have read this Agreement and Waiver and fully understand its terms. You understand that you and all registered parties are giving up substantial rights, including the right to sue. You acknowledge that you are agreeing freely and voluntarily and intend acceptance to be a complete and unconditional release of liability to the greatest extent allowed by law.`,
  },
}

export function ParticipantSignupPage() {
  const { organizationSlug = "" } = useParams()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()

  const [organization, setOrganization] =
    useState<ParticipantSignupOrganization | null>(null)

  const [loadingOrganization, setLoadingOrganization] =
    useState(true)

  const [organizationError, setOrganizationError] =
    useState("")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [gender, setGender] = useState("")
  const [graduationYear, setGraduationYear] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] =
    useState("")
  const [country, setCountry] = useState("United States")
  const [address, setAddress] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [stateProvince, setStateProvince] = useState("")
  const [zip, setZip] = useState("")
  const [physicalSameAsMailing, setPhysicalSameAsMailing] =
    useState("")
  const [priorShootingExperience, setPriorShootingExperience] =
    useState("")
  const [teamAffiliated, setTeamAffiliated] = useState("")
  const [teamName, setTeamName] = useState("")
  const [homeRange, setHomeRange] = useState("")
  const [coachName, setCoachName] = useState("")
  const [secondaryEmergencyContact, setSecondaryEmergencyContact] =
    useState("")
  const [emergencyContactMethods, setEmergencyContactMethods] =
    useState<string[]>([])
  const [guardianFirstName, setGuardianFirstName] = useState("")
  const [guardianLastName, setGuardianLastName] = useState("")
  const [guardianGender, setGuardianGender] = useState("")
  const [guardianBirthDate, setGuardianBirthDate] = useState("")
  const [guardianEmail, setGuardianEmail] = useState("")
  const [guardianPhone, setGuardianPhone] = useState("")
  const [guardianCellPhone, setGuardianCellPhone] = useState("")
  const [guardianCountry, setGuardianCountry] =
    useState("United States")
  const [guardianAddress, setGuardianAddress] = useState("")
  const [guardianAddressLine2, setGuardianAddressLine2] =
    useState("")
  const [guardianCity, setGuardianCity] = useState("")
  const [guardianStateProvince, setGuardianStateProvince] =
    useState("")
  const [guardianZip, setGuardianZip] = useState("")
  const [guardianBusinessPhone, setGuardianBusinessPhone] =
    useState("")
  const [guardianBusinessPhoneExt, setGuardianBusinessPhoneExt] =
    useState("")
  const [guardianRelationship, setGuardianRelationship] =
    useState("")
  const [waiverParentAthlete, setWaiverParentAthlete] =
    useState(false)
  const [waiverMedicalConsent, setWaiverMedicalConsent] =
    useState(false)
  const [waiverSportsmanship, setWaiverSportsmanship] =
    useState(false)
  const [waiverClayKeeperAgreement, setWaiverClayKeeperAgreement] =
    useState(false)
  const [signatureMode, setSignatureMode] =
    useState<"write" | "type">("write")
  const [drawnSignature, setDrawnSignature] = useState("")
  const [typedSignature, setTypedSignature] = useState("")
  const signatureCanvasRef =
    useRef<HTMLCanvasElement | null>(null)
  const signatureDrawingRef = useRef(false)
  const [activeWaiver, setActiveWaiver] =
    useState<WaiverKey | null>(null)
  const [waiversRead, setWaiversRead] = useState<
    Record<WaiverKey, boolean>
  >({
    parentAthlete: false,
    medicalConsent: false,
    sportsmanship: false,
    clayKeeperAgreement: false,
  })

  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState("")
  const [participantNumber, setParticipantNumber] =
    useState<string | null>(null)

  const [confirmationRequired, setConfirmationRequired] =
    useState(false)

  const selectedDisciplineIds = (searchParams.get("session") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  useEffect(() => {
    setFirstName(searchParams.get("firstName") || "")
    setLastName(searchParams.get("lastName") || "")
    setBirthDate(searchParams.get("birthDate") || "")
    setGender(searchParams.get("gender") || "")
    setEmail(searchParams.get("email") || "")
    setGuardianEmail(searchParams.get("email") || "")
  }, [searchParams])

  useEffect(() => {
    let mounted = true

    async function loadOrganization() {
      setLoadingOrganization(true)
      setOrganizationError("")

      try {
        const result =
          await loadParticipantSignupOrganization(
            organizationSlug,
          )

        if (!mounted) return

        if (!result) {
          setOrganizationError(
            "This participant signup link is not valid or the organization is not accepting access.",
          )
          return
        }

        setOrganization(result)
      } catch (loadError) {
        if (!mounted) return
        setOrganizationError(errorMessage(loadError))
      } finally {
        if (mounted) {
          setLoadingOrganization(false)
        }
      }
    }

    void loadOrganization()

    return () => {
      mounted = false
    }
  }, [organizationSlug])

  useEffect(() => {
    if (!session || !organization || participantNumber) {
      return
    }

    const signupOrganization = organization
    let mounted = true

    async function finishPendingSignup() {
      setFinishing(true)
      setError("")

      try {
        const localPending =
          loadPendingParticipantSignup()

        const metadataPending =
          localPending ??
          await loadParticipantSignupFromUserMetadata()

        if (!mounted) return

        if (
          !metadataPending ||
          metadataPending.organizationId !==
            signupOrganization.organizationId
        ) {
          setFinishing(false)
          return
        }

        const number =
          await completeParticipantSignup(metadataPending)

        if (!mounted) return

        setParticipantNumber(number)
        setConfirmationRequired(false)
      } catch (finishError) {
        if (!mounted) return
        setError(errorMessage(finishError))
      } finally {
        if (mounted) {
          setFinishing(false)
        }
      }
    }

    void finishPendingSignup()

    return () => {
      mounted = false
    }
  }, [session, organization, participantNumber])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!organization) return

    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 8) {
      setError(
        "Password must contain at least 8 characters.",
      )
      return
    }

    if (
      !waiverParentAthlete ||
      !waiverMedicalConsent ||
      !waiverSportsmanship ||
      !waiverClayKeeperAgreement
    ) {
      setError(
        "Please review and accept all waivers and agreements.",
      )
      return
    }

    const submittedSignature =
      signatureMode === "write"
        ? drawnSignature
        : typedSignature.trim()

    if (!submittedSignature) {
      setError(
        "Please complete the digital signature before continuing.",
      )
      return
    }

    setSubmitting(true)

    try {
      const registrationNotes = [
        `Shooter mailing address: ${address.trim()} ${addressLine2.trim()} ${city.trim()}, ${stateProvince.trim()} ${zip.trim()} ${country.trim()}`.trim(),
        physicalSameAsMailing
          ? `Physical address same as mailing: ${physicalSameAsMailing}`
          : "",
        priorShootingExperience
          ? `Prior shooting experience: ${priorShootingExperience}`
          : "",
        teamAffiliated
          ? `Affiliated with high school team: ${teamAffiliated}`
          : "",
        teamName ? `Team name: ${teamName}` : "",
        homeRange
          ? `Home range / club / training facility: ${homeRange}`
          : "",
        coachName ? `Coach name: ${coachName}` : "",
        secondaryEmergencyContact
          ? `Secondary emergency contact: ${secondaryEmergencyContact}`
          : "",
        emergencyContactMethods.length
          ? `Emergency contact methods: ${emergencyContactMethods.join(", ")}`
          : "",
        `Primary parent/guardian: ${guardianFirstName.trim()} ${guardianLastName.trim()} (${guardianRelationship.trim()})`.trim(),
        guardianGender
          ? `Guardian gender: ${guardianGender}`
          : "",
        guardianBirthDate
          ? `Guardian date of birth: ${guardianBirthDate}`
          : "",
        guardianEmail
          ? `Guardian email: ${guardianEmail.trim()}`
          : "",
        guardianPhone
          ? `Guardian home phone: ${guardianPhone.trim()}`
          : "",
        guardianCellPhone
          ? `Guardian cell phone: ${guardianCellPhone.trim()}`
          : "",
        `Guardian address: ${guardianAddress.trim()} ${guardianAddressLine2.trim()} ${guardianCity.trim()}, ${guardianStateProvince.trim()} ${guardianZip.trim()} ${guardianCountry.trim()}`.trim(),
        guardianBusinessPhone
          ? `Guardian business phone: ${guardianBusinessPhone.trim()} ext. ${guardianBusinessPhoneExt.trim()}`.trim()
          : "",
        `Waivers accepted: Parents/Guardians and Athletes Waiver, Medical Consent, Sportsmanship Contract, ClayKeeper Agreement and Waiver`,
        signatureMode === "write"
          ? "Digital signature: handwritten signature captured"
          : `Digital signature (typed): ${submittedSignature}`,
      ]
        .filter(Boolean)
        .join("\n")

      const result = await createParticipantAccount(
        email,
        password,
        {
          organizationId: organization.organizationId,
          organizationSlug: organization.organizationSlug,
          firstName,
          lastName,
          preferredName: "",
          birthDate,
          gender,
          graduationYear,
          phone,
          emergencyContactName:
            `${guardianFirstName} ${guardianLastName}`.trim(),
          emergencyContactPhone:
            guardianCellPhone ||
            guardianPhone,
          notes: registrationNotes,
          selectedDisciplines: selectedDisciplineIds,
          waiversAccepted: {
            parentAthlete: waiverParentAthlete,
            medicalConsent: waiverMedicalConsent,
            sportsmanship: waiverSportsmanship,
            clayKeeperAgreement: waiverClayKeeperAgreement,
          },
          signatureType:
            signatureMode === "write" ? "drawn" : "typed",
          signatureValue: submittedSignature,
        },
      )

      if (result.emailConfirmationRequired) {
        setConfirmationRequired(true)
        return
      }

      setParticipantNumber(result.participantNumber)
    } catch (signupError) {
      setError(errorMessage(signupError))
    } finally {
      setSubmitting(false)
    }
  }

  function cancelPendingSignup() {
    clearPendingParticipantSignup()
    setConfirmationRequired(false)
    setError("")
  }

  function toggleEmergencyContactMethod(method: string) {
    setEmergencyContactMethods((current) =>
      current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method],
    )
  }

  function markWaiverRead(waiver: WaiverKey) {
    setWaiversRead((current) => ({
      ...current,
      [waiver]: true,
    }))
    setActiveWaiver(null)
  }

  function getSignaturePoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function beginSignature(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current
    const point = getSignaturePoint(event)
    if (!canvas || !point) return

    event.currentTarget.setPointerCapture(event.pointerId)
    signatureDrawingRef.current = true

    const context = canvas.getContext("2d")
    if (!context) return

    context.lineWidth = 3
    context.lineCap = "round"
    context.lineJoin = "round"
    context.strokeStyle = "#0f172a"
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function drawSignature(event: PointerEvent<HTMLCanvasElement>) {
    if (!signatureDrawingRef.current) return

    const canvas = signatureCanvasRef.current
    const point = getSignaturePoint(event)
    if (!canvas || !point) return

    const context = canvas.getContext("2d")
    if (!context) return

    context.lineTo(point.x, point.y)
    context.stroke()
    setDrawnSignature(canvas.toDataURL("image/png"))
  }

  function endSignature(event: PointerEvent<HTMLCanvasElement>) {
    if (!signatureDrawingRef.current) return

    signatureDrawingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)

    const canvas = signatureCanvasRef.current
    if (canvas) setDrawnSignature(canvas.toDataURL("image/png"))
  }

  function clearDrawnSignature() {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    context?.clearRect(0, 0, canvas.width, canvas.height)
    setDrawnSignature("")
  }

  if (loadingOrganization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-semibold text-slate-600">
          Loading participant signup…
        </p>
      </main>
    )
  }

  if (!organization || organizationError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <h1 className="mt-6 text-2xl font-bold text-slate-950">
            Signup link unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {organizationError ||
              "This organization could not be found."}
          </p>

          <Link
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Return to sign in
          </Link>
        </div>
      </main>
    )
  }

  if (participantNumber) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            {organization.organizationName}
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Account created
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your ClayKeeper participant account is ready.
          </p>

          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Participant Number
            </p>

            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {participantNumber}
            </p>
          </div>

          <a
            href="/"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continue to ClayKeeper
          </a>
        </div>
      </main>
    )
  }

  if (confirmationRequired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-24 w-48 object-contain object-left"
          />

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            {organization.organizationName}
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Check your email
          </h1>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            We sent a confirmation message to{" "}
            <strong>{email.trim()}</strong>. Confirm your email
            address to finish creating your participant account.
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            After confirmation, return to this signup link. Your
            Participant Number will be assigned automatically.
          </p>

          {finishing ? (
            <p className="mt-5 text-sm font-semibold text-emerald-700">
              Finishing your participant account…
            </p>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={cancelPendingSignup}
            className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            Cancel this signup
          </button>
        </div>
      </main>
    )
  }

  const sessionParam = searchParams.get("session") || ""
  const backToRegistrationPath = `/signup/${encodeURIComponent(
    organization.organizationSlug,
  )}/youth/registration${
    sessionParam
      ? `?session=${encodeURIComponent(sessionParam)}`
      : ""
  }`

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-12 text-white lg:flex">
        <div>
          <img
            src={CLAYKEEPER_LOGO}
            alt="ClayKeeper TMK"
            className="h-44 w-72 object-contain object-left"
          />

          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Participant account
          </p>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            {organization.organizationName}
          </p>

          <h1 className="mt-5 text-5xl font-bold leading-tight">
            Create your ClayKeeper participant account.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Your organization-specific Participant Number will be
            assigned automatically when registration is complete.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          ClayKeeper v{APP_VERSION}
        </p>
      </section>

      <section className="flex items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-xl">
          <div className="mb-6 lg:hidden">
            <img
              src={CLAYKEEPER_LOGO}
              alt="ClayKeeper TMK"
              className="h-24 w-48 object-contain object-left"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <Link
              to={backToRegistrationPath}
              className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              {organization.organizationName}
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Youth shooter registration
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Create the shooter login, profile, emergency
              contact, and season registration record.
            </p>

            <form
              className="mt-7 space-y-5"
              onSubmit={handleSubmit}
            >
              <SignupSection
                title="Shooter information"
                description="Basic participant details used for rosters, squadding, scoring, and reports."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SignupInput
                  label="First name"
                  value={firstName}
                  onChange={setFirstName}
                  icon={User}
                  autoComplete="given-name"
                  required
                />

                <SignupInput
                  label="Last name"
                  value={lastName}
                  onChange={setLastName}
                  icon={User}
                  autoComplete="family-name"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                <SignupInput
                  label="Birth date"
                  type="date"
                  value={birthDate}
                  onChange={setBirthDate}
                  icon={CalendarDays}
                  autoComplete="bday"
                />

                <FormSelect
                  label="Grade as of 2026-2027 school year"
                  value={graduationYear}
                  onChange={setGraduationYear}
                  options={[
                    "",
                    "3rd",
                    "4th",
                    "5th",
                    "6th",
                    "7th",
                    "8th",
                    "9th",
                    "10th",
                    "11th",
                    "12th",
                  ]}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="gender"
                  className="text-sm font-medium text-slate-700"
                >
                  Gender <span className="text-red-500">*</span>
                </label>

                <select
                  id="gender"
                  required
                  value={gender}
                  onChange={(event) =>
                    setGender(event.target.value)
                  }
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <SignupSection
                title="Shooter contact and address"
                description="Used by organization staff for season communication, rosters, and safety follow-up."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SignupInput
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  icon={Mail}
                  autoComplete="email"
                  required
                />

                <SignupInput
                  label="Home phone number"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  icon={Phone}
                  autoComplete="tel"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SignupInput
                  label="Country"
                  value={country}
                  onChange={setCountry}
                  icon={User}
                  autoComplete="country-name"
                  required
                />

                <SignupInput
                  label="Address"
                  value={address}
                  onChange={setAddress}
                  icon={User}
                  autoComplete="street-address"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
                <SignupInput
                  label="Address line 2"
                  value={addressLine2}
                  onChange={setAddressLine2}
                  icon={User}
                  autoComplete="address-line2"
                />

                <SignupInput
                  label="City"
                  value={city}
                  onChange={setCity}
                  icon={User}
                  autoComplete="address-level2"
                  required
                />

                <SignupInput
                  label="State"
                  value={stateProvince}
                  onChange={setStateProvince}
                  icon={User}
                  autoComplete="address-level1"
                  required
                />
              </div>

              <SignupInput
                label="ZIP"
                value={zip}
                onChange={setZip}
                icon={User}
                autoComplete="postal-code"
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelect
                  label="Is your physical address the same as your mailing address?"
                  value={physicalSameAsMailing}
                  onChange={setPhysicalSameAsMailing}
                  required
                />

                <FormSelect
                  label="Has the registrant participated in shooting sports before this year?"
                  value={priorShootingExperience}
                  onChange={setPriorShootingExperience}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                <FormSelect
                  label="Is your team affiliated with a high school?"
                  value={teamAffiliated}
                  onChange={setTeamAffiliated}
                />

                <FormSelect
                  label="What is the name of your team?"
                  value={teamName}
                  onChange={setTeamName}
                  options={["", "I do not know yet", "Other"]}
                />
              </div>

              <SignupInput
                label="Home range, gun club, or training facility"
                value={homeRange}
                onChange={setHomeRange}
                icon={User}
                autoComplete="off"
              />

              <div>
                <label
                  htmlFor="coach-name"
                  className="text-sm font-medium text-slate-700"
                >
                  What is the coach&apos;s name?
                </label>

                <textarea
                  id="coach-name"
                  value={coachName}
                  onChange={(event) =>
                    setCoachName(event.target.value)
                  }
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Leave blank if you do not know"
                />
              </div>

              <div>
                <label
                  htmlFor="secondary-emergency-contact"
                  className="text-sm font-medium text-slate-700"
                >
                  Name of secondary emergency contact different from
                  parent/legal guardian details already provided
                </label>

                <textarea
                  id="secondary-emergency-contact"
                  value={secondaryEmergencyContact}
                  onChange={(event) =>
                    setSecondaryEmergencyContact(
                      event.target.value,
                    )
                  }
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700">
                  Emergency contact methods to reach by
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    "Cell Phone",
                    "Email",
                    "Text",
                    "Physical Address",
                  ].map((method) => (
                    <label
                      key={method}
                      className="flex items-center gap-2 text-sm text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={emergencyContactMethods.includes(
                          method,
                        )}
                        onChange={() =>
                          toggleEmergencyContactMethod(method)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {method}
                    </label>
                  ))}
                </div>
              </div>

              <SignupSection
                title="Primary parent / guardian"
                description="Parent or legal guardian information required for youth shooter registration."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SignupInput
                  label="Parent / guardian first name"
                  value={guardianFirstName}
                  onChange={setGuardianFirstName}
                  icon={User}
                  autoComplete="given-name"
                  required
                />

                <SignupInput
                  label="Parent / guardian last name"
                  value={guardianLastName}
                  onChange={setGuardianLastName}
                  icon={User}
                  autoComplete="family-name"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelect
                  label="Parent / guardian gender"
                  value={guardianGender}
                  onChange={setGuardianGender}
                  options={[
                    "",
                    "Female",
                    "Male",
                    "Prefer not to answer",
                  ]}
                />

                <SignupInput
                  label="Parent / guardian date of birth"
                  type="date"
                  value={guardianBirthDate}
                  onChange={setGuardianBirthDate}
                  icon={CalendarDays}
                  autoComplete="bday"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                <SignupInput
                  label="Parent / guardian email address"
                  type="email"
                  value={guardianEmail}
                  onChange={setGuardianEmail}
                  icon={Mail}
                  autoComplete="email"
                  required
                />

                <SignupInput
                  label="Parent / guardian home phone number"
                  type="tel"
                  value={guardianPhone}
                  onChange={setGuardianPhone}
                  icon={Phone}
                  autoComplete="tel"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SignupInput
                  label="Parent / guardian cell phone number"
                  type="tel"
                  value={guardianCellPhone}
                  onChange={setGuardianCellPhone}
                  icon={Phone}
                  autoComplete="tel"
                />

                <SignupInput
                  label="Parent / guardian country"
                  value={guardianCountry}
                  onChange={setGuardianCountry}
                  icon={User}
                  autoComplete="country-name"
                  required
                />
              </div>

              <SignupInput
                label="Parent / guardian address"
                value={guardianAddress}
                onChange={setGuardianAddress}
                icon={User}
                autoComplete="street-address"
                required
              />

              <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
                <SignupInput
                  label="Address line 2"
                  value={guardianAddressLine2}
                  onChange={setGuardianAddressLine2}
                  icon={User}
                  autoComplete="address-line2"
                />

                <SignupInput
                  label="City"
                  value={guardianCity}
                  onChange={setGuardianCity}
                  icon={User}
                  autoComplete="address-level2"
                  required
                />

                <SignupInput
                  label="State"
                  value={guardianStateProvince}
                  onChange={setGuardianStateProvince}
                  icon={User}
                  autoComplete="address-level1"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <SignupInput
                  label="Parent / guardian ZIP"
                  value={guardianZip}
                  onChange={setGuardianZip}
                  icon={User}
                  autoComplete="postal-code"
                  required
                />

                <SignupInput
                  label="Business phone number"
                  type="tel"
                  value={guardianBusinessPhone}
                  onChange={setGuardianBusinessPhone}
                  icon={Phone}
                  autoComplete="tel"
                />

                <SignupInput
                  label="Ext."
                  value={guardianBusinessPhoneExt}
                  onChange={setGuardianBusinessPhoneExt}
                  icon={Phone}
                  autoComplete="off"
                />
              </div>

              <FormSelect
                label="Relationship to registrant"
                value={guardianRelationship}
                onChange={setGuardianRelationship}
                options={[
                  "",
                  "Mother",
                  "Father",
                  "Legal guardian",
                  "Grandparent",
                  "Other",
                ]}
                required
              />

              <SignupSection
                title="Waivers and agreements"
                description="Please read the following waivers and agreements carefully. By agreeing electronically, you acknowledge that you have read and understood each selected agreement."
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-800">
                  {firstName || lastName
                    ? `${firstName} ${lastName}`.trim()
                    : "Youth shooter"}
                </p>

                <div className="mt-4 space-y-3">
                  <AgreementCheckbox
                    waiverKey="parentAthlete"
                    checked={waiverParentAthlete}
                    onChange={setWaiverParentAthlete}
                    read={waiversRead.parentAthlete}
                    onOpen={setActiveWaiver}
                  />

                  <AgreementCheckbox
                    waiverKey="medicalConsent"
                    checked={waiverMedicalConsent}
                    onChange={setWaiverMedicalConsent}
                    read={waiversRead.medicalConsent}
                    onOpen={setActiveWaiver}
                  />

                  <AgreementCheckbox
                    waiverKey="sportsmanship"
                    checked={waiverSportsmanship}
                    onChange={setWaiverSportsmanship}
                    read={waiversRead.sportsmanship}
                    onOpen={setActiveWaiver}
                  />

                  <AgreementCheckbox
                    waiverKey="clayKeeperAgreement"
                    checked={waiverClayKeeperAgreement}
                    onChange={setWaiverClayKeeperAgreement}
                    read={waiversRead.clayKeeperAgreement}
                    onOpen={setActiveWaiver}
                  />
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-800">
                  Digital signature
                </p>

                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      checked={signatureMode === "write"}
                      onChange={() => setSignatureMode("write")}
                      className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Write your signature
                  </label>

                  {signatureMode === "write" ? (
                    <div>
                      <canvas
                        ref={signatureCanvasRef}
                        width={900}
                        height={240}
                        onPointerDown={beginSignature}
                        onPointerMove={drawSignature}
                        onPointerUp={endSignature}
                        onPointerCancel={endSignature}
                        className="h-36 w-full touch-none rounded-lg border border-slate-300 bg-white"
                        aria-label="Draw your signature"
                      />

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">
                          Use your mouse, trackpad, or finger to
                          sign inside the box.
                        </p>

                        <button
                          type="button"
                          onClick={clearDrawnSignature}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      checked={signatureMode === "type"}
                      onChange={() => setSignatureMode("type")}
                      className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Type your signature
                  </label>

                  {signatureMode === "type" ? (
                    <input
                      type="text"
                      value={typedSignature}
                      onChange={(event) =>
                        setTypedSignature(event.target.value)
                      }
                      required
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Type your legal signature"
                    />
                  ) : null}
                </div>
              </div>

              <SignupSection
                title="ClayKeeper login"
                description="Create the login the shooter or parent will use to access ClayKeeper after registration."
              />

              <SignupInput
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                icon={LockKeyhole}
                autoComplete="new-password"
                required
              />

              <SignupInput
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                icon={LockKeyhole}
                autoComplete="new-password"
                required
              />

              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full"
                disabled={submitting || finishing}
              >
                {submitting
                  ? "Saving registration..."
                  : "Continue to cart"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>

      {activeWaiver ? (
        <WaiverModal
          waiver={activeWaiver}
          onClose={() => setActiveWaiver(null)}
          onRead={() => markWaiverRead(activeWaiver)}
        />
      ) : null}
    </main>
  )
}

function SignupInput({
  label,
  value,
  onChange,
  icon: Icon,
  type = "text",
  autoComplete,
  required = false,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  icon: typeof User
  type?: string
  autoComplete?: string
  required?: boolean
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
}) {
  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")

  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <div className="relative mt-2">
        <Icon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />

        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          required={required}
          inputMode={inputMode}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        />
      </div>
    </div>
  )
}

function FormSelect({
  label,
  value,
  onChange,
  options = ["", "Yes", "No"],
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options?: string[]
  required?: boolean
}) {
  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")

  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-medium text-slate-700"
      >
        {label}{" "}
        {required ? (
          <span className="text-red-500">*</span>
        ) : null}
      </label>

      <select
        id={id}
        required={required}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {option || "Select one"}
          </option>
        ))}
      </select>
    </div>
  )
}

function AgreementCheckbox({
  waiverKey,
  checked,
  onChange,
  read,
  onOpen,
}: {
  waiverKey: WaiverKey
  checked: boolean
  onChange: (checked: boolean) => void
  read: boolean
  onOpen: (waiver: WaiverKey) => void
}) {
  const waiver = WAIVER_FORMS[waiverKey]

  return (
    <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={!read}
        required
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200"
      />

      <span>
        I agree to the{" "}
        <button
          type="button"
          onClick={() => onOpen(waiverKey)}
          className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
        >
          {waiver.title}
        </button>
        <span className="text-red-500">*</span>
        {!read ? (
          <span className="ml-2 text-xs font-medium text-slate-500">
            Read first
          </span>
        ) : (
          <span className="ml-2 text-xs font-medium text-emerald-700">
            Read
          </span>
        )}
      </span>
    </label>
  )
}

function WaiverModal({
  waiver,
  onClose,
  onRead,
}: {
  waiver: WaiverKey
  onClose: () => void
  onRead: () => void
}) {
  const form = WAIVER_FORMS[waiver]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waiver-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              Waiver and agreement
            </p>

            <h2
              id="waiver-modal-title"
              className="mt-1 text-2xl font-bold tracking-tight text-slate-950"
            >
              {form.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close waiver"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="whitespace-pre-line text-sm leading-7 text-slate-700">
            {form.body}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            Please review the full form before agreeing to it on
            the registration page.
          </p>

          <Button
            type="button"
            className="min-h-11 px-6"
            onClick={onRead}
          >
            I have read this form
          </Button>
        </div>
      </div>
    </div>
  )
}

function SignupSection({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-base font-bold text-slate-950">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  )
}
