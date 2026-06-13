import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { pixelifySans, pressStart2P } from "./fonts"

export const metadata: Metadata = {
  title: "CPU Scheduling Assessment",
  description: "Test your knowledge of CPU scheduling algorithms through interactive assessments",
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
