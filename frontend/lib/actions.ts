"use server"

export async function addBadge({ gameId, name, level }: { gameId: string; name: string; level: string }) {
  console.log("Adding badge", gameId, name, level)
  return true
}
