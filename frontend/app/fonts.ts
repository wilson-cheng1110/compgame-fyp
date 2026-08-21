import { IBM_Plex_Sans, IBM_Plex_Serif, Pixelify_Sans, Press_Start_2P } from "next/font/google"

// TWO REGISTERS, ON PURPOSE (docs/revamp.md Part 14 — the 太game fix).
//
// The pixel faces below are not a mistake and are not being retired. They are
// being CONFINED. Until now the whole app was set in Press Start 2P — a face with
// no lowercase, no stroke contrast and a 1-bit grid, designed to be read six feet
// from an arcade cabinet. Carrying a 40-word question stem at 10px is not what it
// is for, and a platform that teaches Gestalt grouping and legibility while
// rendering its own instructions illegibly is undermined by its own interface.
//
//   Plex Sans / Plex Serif  ->  the SHELL: dashboard, topic unit, checks, probe,
//                               consent, login. Where students read and are measured.
//   Press Start 2P / Pixelify -> the GAMES: all 26 routes, untouched.
//
// The contrast is the point. Crossing into a game should feel like entering the
// play space, which it cannot do while everything is equally loud.
//
// Plex rather than Inter: same superfamily across sans and serif so the two never
// fight, real design provenance, and not the default every generated interface
// reaches for.

export const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-sans",
})

// Question stems and briefs. A serif for the part that is read slowly and carefully
// — it signals "this one counts" without a single word of chrome saying so.
export const plexSerif = IBM_Plex_Serif({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-serif",
})

export const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

export const pressStart2P = Press_Start_2P({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})
