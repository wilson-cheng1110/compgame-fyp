"use client"

import { useState, useEffect } from "react"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

export function useScreenSize() {
  const [screenSize, setScreenSize] = useState({
    width: isClient ? window.innerWidth : 0,
    height: isClient ? window.innerHeight : 0,
  })

  useEffect(() => {
    if (!isClient) return

    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    // Set initial size
    handleResize()

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Clean up
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return screenSize
}
