"use client"

import { useEffect } from "react"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

export function useForceScrollbar() {
  useEffect(() => {
    if (!isClient) return

    // Function to ensure scrollbar is visible
    const ensureScrollbarVisible = () => {
      // Force scrollbar to be visible
      document.documentElement.style.overflow = "scroll"
      document.documentElement.style.overflowY = "scroll"

      // Add a small amount of content to ensure scrollbar appears
      const scrollbarForcer = document.getElementById("scrollbar-forcer")
      if (!scrollbarForcer) {
        const forcer = document.createElement("div")
        forcer.id = "scrollbar-forcer"
        forcer.style.height = "1px"
        forcer.style.position = "absolute"
        forcer.style.bottom = "0"
        forcer.style.width = "100%"
        forcer.style.marginBottom = "100vh" // Force scrollbar to appear
        document.body.appendChild(forcer)
      }
    }

    // Call immediately
    ensureScrollbarVisible()

    // Also set up a MutationObserver to ensure it stays visible
    const observer = new MutationObserver(ensureScrollbarVisible)
    observer.observe(document.body, { childList: true, subtree: true })

    // Clean up
    return () => {
      observer.disconnect()
      const forcer = document.getElementById("scrollbar-forcer")
      if (forcer) {
        forcer.remove()
      }
    }
  }, [])
}
