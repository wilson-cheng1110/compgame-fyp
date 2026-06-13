"use client"

import type React from "react"
import { useState, useCallback } from "react"
import type { LucideIcon } from "lucide-react"

interface CustomButtonProps {
  onClick: () => void
  icon: LucideIcon
  text: string
  style?: React.CSSProperties
}

const CustomButton: React.FC<CustomButtonProps> = ({ onClick, icon: Icon, text, style }) => {
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = useCallback(() => {
    console.log(`${text} button hovered`)
    setIsHovered(true)
  }, [text])

  const handleMouseLeave = useCallback(() => {
    console.log(`${text} button unhovered`)
    setIsHovered(false)
  }, [text])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      console.log(`${text} button clicked`)
      onClick()
    },
    [onClick, text],
  )

  const buttonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#2F5162",
    color: isHovered ? "#FFE814" : "white",
    border: `2px solid ${isHovered ? "#FFE814" : "white"}`,
    fontFamily: "Quantico, sans-serif",
    fontSize: "clamp(14px, 2vw, 22px)",
    paddingLeft: "16px",
    transition: "all 0.3s ease-in-out",
    cursor: "pointer",
    ...style,
  }

  const iconStyle: React.CSSProperties = {
    width: "clamp(16px, 2vw, 24px)",
    height: "clamp(16px, 2vw, 24px)",
    marginRight: "16px",
    color: isHovered ? "#FFE814" : "white",
  }

  return (
    <button onClick={handleClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={buttonStyle}>
      <Icon style={iconStyle} />
      <span>{text}</span>
    </button>
  )
}

export default CustomButton
