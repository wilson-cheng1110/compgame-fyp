"use client"

export default function GestaltGamePage() {
  return (
    <div className="game-container">
      <h1 className="text-2xl font-bold mb-4">Gestalt Principles Game</h1>
      <div className="game-wrapper w-full h-[90vh]">
        <iframe
          src="/game-files/index.html"
          className="w-full h-full border-0"
          title="Gestalt Principles Game"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}
