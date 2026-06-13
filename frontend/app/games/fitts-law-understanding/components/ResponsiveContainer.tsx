"use client"

import { useEffect, useState, type ReactNode, createContext, useContext } from "react"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

// Create a context to share the scale factor
interface ScaleContextType {
  scale: number
}

const ScaleContext = createContext<ScaleContextType>({ scale: 1 })

// Hook to use the scale factor
export const useScale = () => useContext(ScaleContext)

interface ResponsiveContainerProps {
  children: ReactNode
  designWidth?: number
  designHeight?: number
  className?: string
}

export default function ResponsiveContainer({
  children,
  designWidth = 1920,
  designHeight = 1080,
  className = "",
}: ResponsiveContainerProps) {
  const [scale, setScale] = useState(1)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const updateScale = () => {
      if (!isClient) return

      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      // Calculate scale based on both width and height constraints
      const scaleX = windowWidth / designWidth
      const scaleY = windowHeight / designHeight

      // Use the smaller scale to ensure the entire game fits
      const newScale = Math.min(scaleX, scaleY)

      setScale(newScale)
    }

    // Initial calculation
    updateScale()

    // Update on resize
    if (isClient) {
      window.addEventListener("resize", updateScale)
      return () => window.removeEventListener("resize", updateScale)
    }
  }, [designWidth, designHeight])

  if (!mounted) {
    return null // Prevent layout shift during hydration
  }

  return (
    <ScaleContext.Provider value={{ scale }}>
      <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-black">
        <div
          className={`origin-center relative ${className}`}
          style={{
            width: `${designWidth}px`,
            height: `${designHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: "center",
          }}
        >
          {children}
        </div>
      </div>
    </ScaleContext.Provider>
  )
}
