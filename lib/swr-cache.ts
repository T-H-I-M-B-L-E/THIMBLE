// Lightweight in-memory cache for hot data.
//
// Reads are synchronous (renders use cached data instantly). Writes notify
// subscribers so multiple consumers of the same key stay in sync. Inflight
// requests are deduped per key so 20 mounted components asking for the same
// resource at once fire one network call.

type Listener = () => void

const store = new Map<string, unknown>()
const stamps = new Map<string, number>()
const inflight = new Map<string, Promise<unknown>>()
const listeners = new Map<string, Set<Listener>>()

const DEFAULT_FRESH_MS = 30_000

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value)
  stamps.set(key, Date.now())
  listeners.get(key)?.forEach(fn => {
    try { fn() } catch { /* swallow */ }
  })
}

export function invalidate(key: string): void {
  store.delete(key)
  stamps.delete(key)
}

export function isFresh(key: string, freshMs = DEFAULT_FRESH_MS): boolean {
  const t = stamps.get(key)
  return !!t && Date.now() - t < freshMs
}

export function subscribe(key: string, fn: Listener): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) listeners.delete(key)
  }
}

// Fetch with inflight dedupe. If multiple callers race for the same key
// they all share the same promise; the result is cached on resolve.
export function fetchCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const promise = (async () => {
    try {
      const value = await fetcher()
      setCached(key, value)
      return value
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, promise)
  return promise
}

// Fire-and-forget warm-up. No-op if data is already fresh or a request is
// already in flight. Safe to call repeatedly (e.g. on hover).
export function prefetch<T>(key: string, fetcher: () => Promise<T>, freshMs = DEFAULT_FRESH_MS): void {
  if (isFresh(key, freshMs) || inflight.has(key)) return
  fetchCached(key, fetcher).catch(() => { /* warm-up failures are silent */ })
}
