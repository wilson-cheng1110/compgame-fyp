import { Inter, Roboto_Mono, Pixelify_Sans, Press_Start_2P } from "next/font/google"

// TWO REGISTERS, ON PURPOSE (docs/revamp.md Part 14.1 — the 太game fix).
//
// The pixel faces below are not a mistake and are not being retired. They are
// being CONFINED. Until now the whole app was set in Press Start 2P — a face with
// no lowercase, no stroke contrast and a 1-bit grid, designed to be read six feet
// from an arcade cabinet. Carrying a 40-word question stem at 10px is not what it
// is for, and a platform that teaches Gestalt grouping and legibility while
// rendering its own instructions illegibly is undermined by its own interface.
//
//   Inter / Roboto Mono   ->  the SHELL: dashboard, topic unit, checks, probe,
//                             consent, login. Where students read and are measured.
//   Press Start 2P /      ->  the GAMES: all 26 routes, untouched.
//   Pixelify Sans
//
// The contrast is the point. Crossing into a game should feel like entering the
// play space, which it cannot do while everything is equally loud.
//
// INTER AND ROBOTO MONO ARE NOT A FREE CHOICE — they are CUBIK's, from
// ~/.antigravity/cubik-website/src/styles/globals.css. Roboto Mono is reserved for
// stats and data there (SIDs, scores, counts, step positions here), which is
// exactly the split that makes the numbers read as deliberate rather than default.
// If cubik-website changes its faces, change them here too.

export const inter = Inter({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const robotoMono = Roboto_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-mono",
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
