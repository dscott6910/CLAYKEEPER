const configuredSiteUrl =
  Deno.env.get("CLAYKEEPER_SITE_URL")?.replace(/\/$/, "") ||
  "https://claykeeper.live"

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || configuredSiteUrl
  const allowed =
    origin === configuredSiteUrl ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"

  return {
    "Access-Control-Allow-Origin": allowed ? origin : configuredSiteUrl,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  }
}
export function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}

export function siteUrl() {
  return configuredSiteUrl
}
