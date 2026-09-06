const CACHE = "claykeeper-mobile-v3"
const APP_SHELL = ["/", "/index.html", "/mobile", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("claykeeper-mobile-") &&
                key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return

  const urls = event.data.urls.filter((url) => {
    try {
      return new URL(url, self.location.origin).origin === self.location.origin
    } catch {
      return false
    }
  })

  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        urls.map(async (url) => {
          try {
            await cache.add(url)
          } catch {
            // A single optional asset should not prevent the scoring app from being cached.
          }
        }),
      )
      event.ports[0]?.postMessage({ cached: true })
    }),
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE)
          return (
            (await cache.match(event.request)) ||
            (await cache.match("/index.html")) ||
            (await cache.match("/"))
          )
        }),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        }),
    ),
  )
})
