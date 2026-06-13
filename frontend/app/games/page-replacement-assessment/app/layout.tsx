import type React from "react"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import "./globals.css"

// Load Press Start 2P font
const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

// Load Pixelify Sans font
const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

export const metadata = {
  title: "Page Replacement Assessment",
  description: "Test your knowledge of page replacement algorithms",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${pressStart2P.variable} ${pixelifySans.variable}`}>{children}</body>
    </html>
  )
}
