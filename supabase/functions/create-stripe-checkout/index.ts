import Stripe from "npm:stripe@^22"
import { createClient } from "npm:@supabase/supabase-js@^2"

import {
  corsHeaders,
  jsonResponse,
  siteUrl,
} from "../_shared/cors.ts"

type CheckoutRequest = {
  organizationId?: string
  checkoutRequestId?: string
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) })
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed." }, 405)
  }

  try {
    const authorization = request.headers.get("Authorization") || ""
    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse(request, { error: "Please sign in to continue." }, 401)
    }

    const supabaseUrl = requiredEnvironment("SUPABASE_URL")
    const anonKey = requiredEnvironment("SUPABASE_ANON_KEY")
    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY")
    const stripeSecretKey = requiredEnvironment("STRIPE_SECRET_KEY")

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse(request, { error: "Your sign-in has expired." }, 401)
    }

    const body = (await request.json()) as CheckoutRequest
    const organizationId = body.organizationId?.trim() || ""
    const checkoutRequestId = body.checkoutRequestId?.trim() || ""

    if (!organizationId || !checkoutRequestId) {
      return jsonResponse(
        request,
        { error: "Organization and checkout request are required." },
        400,
      )
    }

    const { data: settings, error: settingsError } = await adminClient
      .from("organization_settings")
      .select("stripe_payments_enabled,season_registration_fee")
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (settingsError) throw settingsError
    if (!settings?.stripe_payments_enabled) {
      return jsonResponse(
        request,
        { error: "Online payments are not enabled for this organization." },
        409,
      )
    }

    const { data: registration, error: registrationError } = await adminClient
      .from("participant_season_registrations")
      .select(
        "id,organization_id,season_id,athlete_id,user_id,status,payment_status,amount_due,amount_paid,currency",
      )
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (registrationError) throw registrationError
    if (!registration) {
      return jsonResponse(
        request,
        { error: "Complete the participant registration before payment." },
        409,
      )
    }

    const amountDue = Number(registration.amount_due || 0)
    const amountPaid = Number(registration.amount_paid || 0)
    const balance = Math.max(0, amountDue - amountPaid)

    if (registration.payment_status === "paid" || balance <= 0) {
      return jsonResponse(request, { alreadyPaid: true })
    }

    const amountCents = Math.round(balance * 100)
    if (!Number.isSafeInteger(amountCents) || amountCents < 50) {
      return jsonResponse(
        request,
        { error: "The registration balance is not valid for online payment." },
        409,
      )
    }

    const [{ data: organization }, { data: season }, { data: athlete }] =
      await Promise.all([
        adminClient
          .from("organizations")
          .select("name,slug")
          .eq("id", organizationId)
          .single(),
        adminClient
          .from("seasons")
          .select("name")
          .eq("id", registration.season_id)
          .single(),
        adminClient
          .from("athletes")
          .select("first_name,last_name")
          .eq("id", registration.athlete_id)
          .single(),
      ])

    if (!organization?.slug) {
      throw new Error("The organization signup address is unavailable.")
    }

    const metadata = {
      claykeeper_payment_type: "season_registration",
      organization_id: organizationId,
      season_registration_id: registration.id,
      athlete_id: registration.athlete_id,
      user_id: user.id,
    }

    const stripe = new Stripe(stripeSecretKey)
    const baseUrl = siteUrl()
    const signupSlug = encodeURIComponent(organization.slug)
    const participantName = [athlete?.first_name, athlete?.last_name]
      .filter(Boolean)
      .join(" ")

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user.email || undefined,
        client_reference_id: registration.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: String(registration.currency || "usd").toLowerCase(),
              unit_amount: amountCents,
              product_data: {
                name: `${season?.name || "Youth season"} registration`,
                description: participantName
                  ? `ClayKeeper registration for ${participantName}`
                  : `ClayKeeper registration for ${organization.name}`,
              },
            },
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url:
          `${baseUrl}/signup/${signupSlug}/youth/payment/success` +
          "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          `${baseUrl}/signup/${signupSlug}/youth/cart?payment=cancelled`,
      },
      { idempotencyKey: `season-checkout-${checkoutRequestId}` },
    )

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout address.")
    }

    const { error: transactionError } = await adminClient
      .from("participant_season_payment_transactions")
      .upsert(
        {
          organization_id: organizationId,
          season_registration_id: registration.id,
          transaction_type: "payment",
          provider: "stripe",
          provider_transaction_id: checkoutSession.id,
          checkout_request_id: checkoutRequestId,
          checkout_session_id: checkoutSession.id,
          amount: balance,
          currency: String(registration.currency || "usd").toLowerCase(),
          status: "pending",
          payment_method: "card",
          receipt_email: user.email || null,
          processed_at: new Date().toISOString(),
        },
        { onConflict: "checkout_request_id" },
      )

    if (transactionError) throw transactionError

    return jsonResponse(request, { url: checkoutSession.url })
  } catch (error) {
    console.error("create-stripe-checkout failed", error)
    const message =
      error instanceof Error
        ? error.message
        : "Unable to begin secure payment."
    const configurationError =
      message.includes("STRIPE_SECRET_KEY") ||
      message.includes("SUPABASE_")

    return jsonResponse(
      request,
      {
        error: configurationError
          ? "Online payments are being configured. Please try again later."
          : message,
      },
      configurationError ? 503 : 500,
    )
  }
})
