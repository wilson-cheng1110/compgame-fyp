"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export function useScrollRestoration() {
  const pathname = usePathname()

  // Ensure scrollbar is consistently visible
  useEffect(() => {
    // Force document body to have consistent overflow settings
    document.documentElement.style.overflowY = "scroll"
    document.body.style.overflowY = "visible"
    document.body.style.minHeight = "100vh"

    // Ensure scrollbar width is accounted for to prevent layout shifts
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      // Clean up
      document.body.style.paddingRight = ""
    }
  }, [pathname])
}
