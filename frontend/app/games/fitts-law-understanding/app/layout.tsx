import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Press_Start_2P, Quantico } from "next/font/google"

// Load Press Start 2P font
const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

// Load Quantico font
const quantico = Quantico({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-quantico",
})

export const metadata: Metadata = {
  title: "Fitts' Law Game",
  description: "Learn about Fitts Law through interactive gameplay",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html 
      lang="en" 
      // Added suppressHydrationWarning to ignore class mismatches 
      // caused by font variables or browser extensions.
      suppressHydrationWarning
      className={`${pressStart2P.variable} ${quantico.variable}`}
    >
      <body 
        // Also added to the body to prevent hydration errors from attribute injections.
        suppressHydrationWarning 
        className="overflow-hidden m-0 p-0"
      >
        {children}
      </body>
    </html>
  )
}