"use client"

import { useRouter } from "next/navigation"
import * as React from "react"

// Keeps the page current: when anyone changes data, /api/events says so and
// the page fetches itself again (router.refresh also drops prefetched pages,
// so the next click is fresh too). Bursts of changes refresh once.
export function LiveRefresh() {
  const router = useRouter()
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 300)
    }
    const source = new EventSource("/api/events")
    source.onmessage = refresh
    // The page may have arrived from a prefetch made minutes ago, and after
    // a dropped connection (sleep, network change) changes may have been
    // missed, so catch up whenever the stream opens.
    source.onopen = refresh
    return () => {
      clearTimeout(timer)
      source.close()
    }
  }, [router])
  return null
}
