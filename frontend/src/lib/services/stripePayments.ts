import { supabase } from "@/lib/supabase"

type CheckoutResponse = {
  url?: string
  alreadyPaid?: boolean
  error?: string
}
export async function startStripeSeasonCheckout(
  organizationId: string,
): Promise<{ url: string | null; alreadyPaid: boolean }> {
  const checkoutRequestId = crypto.randomUUID()
  const { data, error } = await supabase.functions.invoke<CheckoutResponse>(
    "create-stripe-checkout",
    {
      body: {
        organizationId,
        checkoutRequestId,
      },
    },
  )

  if (error) {
    let message = error.message || "Unable to begin secure payment."

    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const body = await context.clone().json() as CheckoutResponse
        if (body.error) message = body.error
      } catch {
        // Keep the function client's error message when the response is not JSON.
      }
    }

    throw new Error(message)
  }

  if (data?.alreadyPaid) {
    return { url: null, alreadyPaid: true }
  }

  if (!data?.url) {
    throw new Error("Stripe did not return a secure checkout address.")
  }

  return { url: data.url, alreadyPaid: false }
}
