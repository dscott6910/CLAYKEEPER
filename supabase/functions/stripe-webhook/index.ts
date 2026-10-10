import Stripe from "npm:stripe@^22"
import { createClient } from "npm:@supabase/supabase-js@^2"

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function registrationId(metadata: Stripe.Metadata | null | undefined) {
  return metadata?.season_registration_id || null
}

function paymentIntentId(
  value: string | Stripe.PaymentIntent | null | undefined,
) {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const stripeSecretKey = requiredEnvironment("STRIPE_SECRET_KEY")
    const webhookSecret = requiredEnvironment("STRIPE_WEBHOOK_SECRET")
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      return new Response("Missing Stripe signature", { status: 400 })
    }

    const stripe = new Stripe(stripeSecretKey)
    const cryptoProvider = Stripe.createSubtleCryptoProvider()
    const body = await request.text()

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        cryptoProvider,
      )
    } catch (error) {
      console.error("Stripe signature verification failed", error)
      return new Response("Invalid Stripe signature", { status: 400 })
    }

    const supabaseUrl = requiredEnvironment("SUPABASE_URL")
    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY")
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    let payload:
      | {
          registrationId: string | null
          checkoutSessionId: string | null
          paymentIntentId: string | null
          amount: number
          currency: string
          status: "pending" | "succeeded" | "failed" | "cancelled"
          receiptEmail: string | null
        }
      | undefined

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      const session = event.data.object as Stripe.Checkout.Session
      const succeeded =
        event.type === "checkout.session.async_payment_succeeded" ||
        session.payment_status === "paid"
      const status =
        event.type === "checkout.session.expired"
          ? "cancelled"
          : event.type === "checkout.session.async_payment_failed"
            ? "failed"
            : succeeded
              ? "succeeded"
              : "pending"

      payload = {
        registrationId: registrationId(session.metadata),
        checkoutSessionId: session.id,
        paymentIntentId: paymentIntentId(session.payment_intent),
        amount: Number(session.amount_total || 0) / 100,
        currency: session.currency || "usd",
        status,
        receiptEmail:
          session.customer_details?.email || session.customer_email || null,
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge
      payload = {
        registrationId: null,
        checkoutSessionId: null,
        paymentIntentId: paymentIntentId(charge.payment_intent),
        amount: Number(charge.amount_refunded || 0) / 100,
        currency: charge.currency || "usd",
        status: "succeeded",
        receiptEmail: charge.billing_details?.email || null,
      }
    }

    if (!payload) {
      return Response.json({ received: true, ignored: true })
    }

    if (payload.amount <= 0 || !payload.paymentIntentId && !payload.checkoutSessionId) {
      throw new Error("Stripe event is missing payment details.")
    }

    const { error } = await adminClient.rpc(
      "apply_stripe_season_payment_event",
      {
        p_event_id: event.id,
        p_event_type: event.type,
        p_registration_id: payload.registrationId,
        p_checkout_session_id: payload.checkoutSessionId,
        p_payment_intent_id: payload.paymentIntentId,
        p_amount: payload.amount,
        p_currency: payload.currency,
        p_status: payload.status,
        p_receipt_email: payload.receiptEmail,
      },
    )

    if (error) throw error

    return Response.json({ received: true })
  } catch (error) {
    console.error("stripe-webhook failed", error)
    return new Response("Webhook processing failed", { status: 500 })
  }
})
