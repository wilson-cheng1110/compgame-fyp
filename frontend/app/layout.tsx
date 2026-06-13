import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import { BadgeProvider } from "@/lib/badge-context"
import { ProgressProvider } from "@/lib/progress-context"
import { AiChatWidget } from "@/components/ai-chat-widget"

const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

const pressStart2P = Press_Start_2P({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

export const metadata: Metadata = {
  title: "COMPGame - Computer Science Learning Games",
  description: "Learn computer science concepts through interactive games",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${pixelifySans.variable} ${pressStart2P.variable}`}>
      <body className={`${pixelifySans.variable} ${pressStart2P.variable}`}>
        <BadgeProvider>
          <ProgressProvider>
            {children}
          </ProgressProvider>
        </BadgeProvider>
        <AiChatWidget />
      </body>
    </html>
  )
}


import './globals.css'