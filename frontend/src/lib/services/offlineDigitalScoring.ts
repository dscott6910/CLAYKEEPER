import type { DigitalScoringData } from "@/lib/services/digitalScoring"

const DATABASE_NAME = "claykeeper-offline"
const DATABASE_VERSION = 1
const EVENT_STORE = "scoring-events"
const DRAFT_STORE = "scorecard-drafts"

export type OfflineScoringEvent = {
  eventId: string
  cachedAt: string
  data: DigitalScoringData
}

export type OfflineScorecardDraft = {
  key: string
  eventId: string
  organizationId: string
  shootId: string
  memberId: string
  courseId: string
  scorecardId: string | null
  requestedStatus: "draft" | "finalized"
  scores: Record<string, string>
  stationNotes: Record<string, string>
  stationTargets: Record<string, number>
  malfunctions: number
  verified1: string
  verified2: string
  enteredBy: string
  notes: string
  savedAt: string
  baseUpdatedAt: string | null
}

export function offlineScorecardKey(
  eventId: string,
  memberId: string,
  courseId: string,
) {
  return `${eventId}:${memberId}:${courseId}`
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(EVENT_STORE)) {
        database.createObjectStore(EVENT_STORE, { keyPath: "eventId" })
      }
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        const store = database.createObjectStore(DRAFT_STORE, { keyPath: "key" })
        store.createIndex("eventId", "eventId", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Offline storage could not be opened."))
  })
}

async function runRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    let result: T

    request.onsuccess = () => {
      result = request.result
    }
    request.onerror = () => {
      database.close()
      reject(request.error ?? new Error("Offline storage request failed."))
    }
    transaction.oncomplete = () => {
      database.close()
      resolve(result)
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error("Offline storage transaction failed."))
    }
  })
}

export async function cacheScoringEvent(data: DigitalScoringData) {
  const cached: OfflineScoringEvent = {
    eventId: data.event.id,
    cachedAt: new Date().toISOString(),
    data,
  }
  await runRequest(EVENT_STORE, "readwrite", (store) => store.put(cached))
  return cached
}

export function getCachedScoringEvent(eventId: string) {
  return runRequest<OfflineScoringEvent | undefined>(EVENT_STORE, "readonly", (store) =>
    store.get(eventId),
  )
}

export function putOfflineScorecardDraft(draft: OfflineScorecardDraft) {
  return runRequest(DRAFT_STORE, "readwrite", (store) => store.put(draft))
}

export function getOfflineScorecardDraft(key: string) {
  return runRequest<OfflineScorecardDraft | undefined>(DRAFT_STORE, "readonly", (store) =>
    store.get(key),
  )
}

export function deleteOfflineScorecardDraft(key: string) {
  return runRequest(DRAFT_STORE, "readwrite", (store) => store.delete(key))
}

export async function listOfflineScorecardDrafts(eventId: string) {
  const database = await openDatabase()
  return new Promise<OfflineScorecardDraft[]>((resolve, reject) => {
    const transaction = database.transaction(DRAFT_STORE, "readonly")
    const index = transaction.objectStore(DRAFT_STORE).index("eventId")
    const request = index.getAll(eventId)

    let drafts: OfflineScorecardDraft[] = []
    request.onsuccess = () => {
      drafts = request.result
    }
    request.onerror = () => {
      database.close()
      reject(request.error ?? new Error("Queued scorecards could not be loaded."))
    }
    transaction.oncomplete = () => {
      database.close()
      resolve(drafts)
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error("Offline storage transaction failed."))
    }
  })
}

export async function requestPersistentOfflineStorage() {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist()
}

export async function cacheScoringAppForOffline() {
  if (!("serviceWorker" in navigator)) return

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return
  const worker = registration.active
  if (!worker) return

  const resourceUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => {
      try {
        return new URL(url).origin === window.location.origin
      } catch {
        return false
      }
    })

  const urls = [...new Set(["/", "/index.html", window.location.href, ...resourceUrls])]
  await new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(resolve, 5000)
    channel.port1.onmessage = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    worker.postMessage({ type: "CACHE_URLS", urls }, [channel.port2])
  })
}
