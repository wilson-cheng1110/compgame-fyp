import type { Metadata } from "next"
import StartMenuClient from "./StartMenuClient"

export const metadata: Metadata = {
  title: "Fitts' Law Game",
  description: "Learn about Fitts Law through interactive gameplay",
}

export default function StartMenu() {
  return <StartMenuClient />
}
