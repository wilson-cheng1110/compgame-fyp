"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, type ReactNode } from "react"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

interface PreservedLinkProps {
  href: string
  children: ReactNode
  className?: string
}

export default function PreservedLink({ href, children, className }: PreservedLinkProps) {
  const router = useRouter()

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      if (!isClient) return

      // Force scrollbar to be visible before navigation
      document.documentElement.style.overflow = "scroll"
      document.documentElement.style.overflowY = "scroll"

      // Preserve font classes
      const pixelifySansClass = document.documentElement.classList.contains("pixelify-sans-variable")
      const pressStart2PClass = document.documentElement.classList.contains("press-start-2p-variable")

      // Navigate programmatically
      router.push(href)

      // Ensure font classes are preserved after navigation
      if (pixelifySansClass) {
        document.documentElement.classList.add("pixelify-sans-variable")
      }
      if (pressStart2PClass) {
        document.documentElement.classList.add("press-start-2p-variable")
      }
    },
    [href, router],
  )

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  )
}
