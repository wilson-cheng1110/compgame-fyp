import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { pixelifySans, pressStart2P } from "./fonts"

// Update the metadata title and description to reflect page replacement focus
export const metadata: Metadata = {
  title: "Page Replacement Game",
  description: "Learn about page replacement algorithms through interactive simulations",
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
