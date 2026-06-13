import type React from "react"
import Link from "next/link"

interface GameCardProps {
  title: string
  description: string
  image: string
  href: string
}

export const GameCard: React.FC<GameCardProps> = ({ title, description, image, href }) => {
  return (
    <Link href={href}>
      <div className="p-6 rounded-lg bg-white cursor-pointer hover:shadow-lg transition-shadow border border-gray-300 h-full">
        <div className="aspect-video relative w-full mb-4">
          <img src={image || "/placeholder.svg"} alt={title} className="object-cover rounded-md w-full h-full" />
        </div>
        <h3 className="font-press-start-2p text-lg mb-2">{title}</h3>
        <p className="font-pixelify-sans text-sm opacity-70">{description}</p>
      </div>
    </Link>
  )
}
