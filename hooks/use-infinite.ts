"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type CursorFetcher<T> = (cursor: string | null) => Promise<{
  items: T[]
  nextCursor: string | null
}>

export interface InfiniteState<T> {
  items: T[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  sentinelRef: (node: HTMLElement | null) => void
  setItems: React.Dispatch<React.SetStateAction<T[]>>
  reset: () => void
}

/**
 * Cursor-based infinite scroll. The fetcher is called with `null` for the
 * first page and the previous response's `nextCursor` for each subsequent
 * page. Loading stops when `nextCursor` is `null`.
 *
 * Attach `sentinelRef` to an element near the bottom of your list; the
 * hook uses IntersectionObserver to load the next page when it scrolls
 * into view (with a comfortable rootMargin so it kicks off early).
 *
 * Pass `enabled: false` to pause loading (useful for tabs that aren't
 * active yet — defer the initial fetch until the user selects them).
 */
export function useInfinite<T>(
  fetcher: CursorFetcher<T>,
  deps: ReadonlyArray<unknown> = [],
  enabled: boolean = true,
): InfiniteState<T> {
  const [items, setItems] = useState<T[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the latest in-flight fetch so a stale response from before a
  // reset can't overwrite fresh state.
  const reqIdRef = useRef(0)
  const sentinelElRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const reset = useCallback(() => {
    reqIdRef.current++
    setItems([])
    setCursor(null)
    setHasMore(true)
    setError(null)
    setIsLoadingMore(false)
  }, [])

  const loadPage = useCallback(
    async (pageCursor: string | null, isFirst: boolean) => {
      const reqId = ++reqIdRef.current
      if (isFirst) setIsLoading(true)
      else setIsLoadingMore(true)
      setError(null)
      try {
        const result = await fetcher(pageCursor)
        if (reqId !== reqIdRef.current) return // superseded
        setItems(prev => (isFirst ? result.items : [...prev, ...result.items]))
        setCursor(result.nextCursor)
        setHasMore(result.nextCursor !== null)
      } catch (e) {
        if (reqId !== reqIdRef.current) return
        setError(e instanceof Error ? e.message : "Failed to load")
        setHasMore(false)
      } finally {
        if (reqId === reqIdRef.current) {
          setIsLoading(false)
          setIsLoadingMore(false)
        }
      }
    },
    [fetcher],
  )

  // Initial load + whenever deps change.
  useEffect(() => {
    if (!enabled) return
    reset()
    void loadPage(null, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      sentinelElRef.current = node
      observerRef.current?.disconnect()
      if (!node) return

      observerRef.current = new IntersectionObserver(
        entries => {
          const entry = entries[0]
          if (!entry?.isIntersecting) return
          if (!hasMore || isLoading || isLoadingMore) return
          void loadPage(cursor, false)
        },
        { rootMargin: "400px 0px" },
      )
      observerRef.current.observe(node)
    },
    [cursor, hasMore, isLoading, isLoadingMore, loadPage],
  )

  useEffect(() => {
    return () => observerRef.current?.disconnect()
  }, [])

  return { items, isLoading, isLoadingMore, hasMore, error, sentinelRef, setItems, reset }
}
