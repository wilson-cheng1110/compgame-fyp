import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { pixelifySans, pressStart2P } from "./fonts"

// Update the metadata title and description

export const metadata: Metadata = {
  title: "CPU Scheduling Game",
  description: "Learn about CPU scheduling algorithms through interactive simulations",
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
