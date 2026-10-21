import { createClient } from "@supabase/supabase-js"

const dryRun = process.argv.includes("--dry-run")

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendApiKey = process.env.RESEND_API_KEY
const fromEmail =
  process.env.REGISTRATION_EMAIL_FROM ||
  process.env.STAFF_REQUEST_EMAIL_FROM ||
  "ClayKeeper <notifications@claykeeper.live>"
const appUrl =
  process.env.CLAYKEEPER_APP_URL || "https://claykeeper.live"

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`)
  }
}

function roleLabel(role) {
  switch (role) {
    case "admin":
      return "Admin"
    case "coach":
      return "Coach"
    case "scorekeeper":
      return "Scorekeeper"
    case "volunteer":
      return "Volunteer"
    default:
      return role || "staff"
  }
}

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return String(value || "")

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function staffEmailPayload(notification) {
  const requesterName =
    notification.requester_name || "A staff user"
  const requestedRole = roleLabel(notification.requested_role)
  const reviewUrl = `${appUrl.replace(/\/$/, "")}/staff-requests`
  const isReminder = notification.notification_kind === "reminder"
  const subject = isReminder
    ? `Reminder: ${requesterName} is awaiting ClayKeeper approval`
    : `ClayKeeper staff request: ${requesterName} requested ${requestedRole}`

  const details = [
    `Requester: ${requesterName}`,
    notification.requester_email
      ? `Email: ${notification.requester_email}`
      : null,
    `Requested role: ${requestedRole}`,
    `Submitted: ${formatDate(notification.request_created_at)}`,
  ].filter(Boolean)

  const text = [
    isReminder
      ? "This ClayKeeper staff access request is still pending."
      : "A ClayKeeper staff access request is ready for review.",
    "",
    ...details,
    "",
    `Review it here: ${reviewUrl}`,
  ].join("\n")

  const htmlDetails = details
    .map((detail) => `<li>${escapeHtml(detail)}</li>`)
    .join("")

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <p>${isReminder
        ? "This ClayKeeper staff access request is still pending."
        : "A ClayKeeper staff access request is ready for review."}</p>
      <ul>${htmlDetails}</ul>
      <p>
        <a href="${escapeHtml(reviewUrl)}"
           style="display:inline-block;background:#059669;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">
          Review staff request
        </a>
      </p>
    </div>
  `

  return {
    from: fromEmail,
    to: notification.recipient_email,
    subject,
    text,
    html,
  }
}

function participantEmailPayload(notification) {
  const participantName =
    notification.participant_name || "A participant"
  const participantUrl = `${appUrl.replace(/\/$/, "")}/participants/${notification.athlete_id}`
  const subject = `ClayKeeper participant registration: ${participantName}`
  const details = [
    `Participant: ${participantName}`,
    notification.participant_email
      ? `Email: ${notification.participant_email}`
      : null,
    `Registered: ${formatDate(notification.registration_created_at)}`,
    notification.organization_name
      ? `Organization: ${notification.organization_name}`
      : null,
  ].filter(Boolean)

  const text = [
    "A participant created a ClayKeeper account.",
    "",
    ...details,
    "",
    "Participant registrations are created immediately and do not require approval.",
    `View the participant here: ${participantUrl}`,
  ].join("\n")

  const htmlDetails = details
    .map((detail) => `<li>${escapeHtml(detail)}</li>`)
    .join("")

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <p>A participant created a ClayKeeper account.</p>
      <ul>${htmlDetails}</ul>
      <p>Participant registrations are created immediately and do not require approval.</p>
      <p>
        <a href="${escapeHtml(participantUrl)}"
           style="display:inline-block;background:#059669;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">
          View participant
        </a>
      </p>
    </div>
  `

  return {
    from: fromEmail,
    to: notification.recipient_email,
    subject,
    text,
    html,
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

async function sendEmail(payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Resend returned ${response.status}: ${body}`,
    )
  }
}

async function main() {
  requireEnv("SUPABASE_URL or VITE_SUPABASE_URL", supabaseUrl)
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey)
  requireEnv("RESEND_API_KEY", resendApiKey)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const [staffResult, participantResult] = await Promise.all([
    supabase.rpc("list_due_staff_access_request_notifications"),
    supabase.rpc(
      "list_due_participant_registration_notifications",
    ),
  ])

  if (staffResult.error) throw staffResult.error
  if (participantResult.error) throw participantResult.error

  const staffNotifications = staffResult.data ?? []
  const participantNotifications = participantResult.data ?? []
  let staffSent = 0
  let participantSent = 0

  for (const notification of staffNotifications) {
    const payload = staffEmailPayload(notification)

    if (dryRun) {
      console.log(
        `[dry run] ${payload.subject} -> ${payload.to}`,
      )
      continue
    }

    await sendEmail(payload)

    const { error: recordError } = await supabase.rpc(
      "record_staff_access_request_notification_sent",
      {
        p_request_id: notification.request_id,
        p_recipient_user_id: notification.recipient_user_id,
        p_notification_kind: notification.notification_kind,
      },
    )

    if (recordError) throw recordError

    staffSent += 1
    console.log(`${payload.subject} -> ${payload.to}`)
  }

  for (const notification of participantNotifications) {
    const payload = participantEmailPayload(notification)

    if (dryRun) {
      console.log(
        `[dry run] ${payload.subject} -> ${payload.to}`,
      )
      continue
    }

    await sendEmail(payload)

    const { error: recordError } = await supabase.rpc(
      "record_participant_registration_notification_sent",
      {
        p_athlete_id: notification.athlete_id,
        p_recipient_user_id: notification.recipient_user_id,
      },
    )

    if (recordError) throw recordError

    participantSent += 1
    console.log(`${payload.subject} -> ${payload.to}`)
  }

  console.log(
    dryRun
      ? `${staffNotifications.length} staff approval and ${participantNotifications.length} participant notifications are due.`
      : `${staffSent} staff approval and ${participantSent} participant notifications sent.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
