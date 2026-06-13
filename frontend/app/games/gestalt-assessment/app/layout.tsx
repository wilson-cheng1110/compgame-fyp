import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { pixelifySans, pressStart2P } from "./fonts"

export const metadata: Metadata = {
  title: "Gestalt Principles Assessment",
  description: "Test your knowledge of Gestalt principles through this interactive assessment",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${pixelifySans.variable} ${pressStart2P.variable}`}>{children}</body>
    </html>
  )
}
