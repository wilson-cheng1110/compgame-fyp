import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Press_Start_2P, Quantico } from "next/font/google"

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

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

export default function FittsLawSubLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${pressStart2P.variable} ${quantico.variable} overflow-hidden`}>
      {children}
    </div>
  )
}
