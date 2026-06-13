export interface Circle {
  id: number
  x: number
  y: number
  size: number
  color: string
  distance: number
  indexOfDifficulty: number
  clicked: boolean
}

export type GameState = "waiting" | "playing" | "success" | "failure"
