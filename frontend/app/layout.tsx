import type React from "react"
import "./globals.css"
import "./shell.css"
import type { Metadata } from "next"
import { inter, robotoMono, pixelifySans, pressStart2P } from "./fonts"
import { BadgeProvider } from "@/lib/badge-context"
import { ProgressProvider } from "@/lib/progress-context"
import { AiChatWidget } from "@/components/ai-chat-widget"
import { ReflectionDialog } from "@/components/reflection-dialog"

// All four families are declared here so every route can reach any of them, but
// they are used in two separate registers (see app/fonts.ts): Inter + Roboto Mono
// (CUBIK's faces) in the shell, the pixel faces in the 26 game routes. Declaring
// them together is not mixing them — nothing outside `.shell` picks up Inter, and
// nothing inside it picks up Press Start 2P unless it asks by name.
const fontVars = `${inter.variable} ${robotoMono.variable} ${pixelifySans.variable} ${pressStart2P.variable}`

export const metadata: Metadata = {
  title: "COMPGame",
  description:
    "Flipped-learning units for COMP3423 Human–Computer Interaction: learn the concept, then test yourself, with an AI tutor throughout.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={fontVars}>
      <body className={fontVars}>
        <BadgeProvider>
          <ProgressProvider>
            {children}
            {/* Mounted inside ProgressProvider — it calls useProgress to persist
                the reflection summary. Listens globally for "start-reflection". */}
            <ReflectionDialog />
          </ProgressProvider>
        </BadgeProvider>
        <AiChatWidget />
      </body>
    </html>
  )
}
