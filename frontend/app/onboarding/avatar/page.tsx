"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import Cookies from "js-cookie"
import { ChevronRight, ChevronLeft } from "lucide-react"

const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

const pressStart2P = Press_Start_2P({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

const avatars = [
  {
    id: 1,
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_1-0OHXpMnV7F5XjJKF4OuVW5OxvnxFRr.png",
    alt: "Male character with brown hair",
  },
  {
    id: 2,
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_2-QeIlj2Z9JERNw3e1qM9bzmMMkbbGso.png",
    alt: "Female character with red hair",
  },
]

export default function AvatarSelectionPage() {
  const router = useRouter()
  const [currentAvatar, setCurrentAvatar] = useState(0)
  const [darkMode, setDarkMode] = useState(false)
  const [userData, setUserData] = useState<any>(null)

  // Check if user is logged in
  useEffect(() => {
    const userCookie = Cookies.get("user")
    if (!userCookie) {
      router.push("/login")
      return
    }

    // Parse user data
    const parsedUserData = JSON.parse(userCookie)
    setUserData(parsedUserData)

    // Check if user needs onboarding
    if (!parsedUserData.needsOnboarding) {
      router.push("/dashboard")
      return
    }

    // Check for dark mode preference
    const darkModePref = Cookies.get("darkMode")
    if (darkModePref === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
  }, [router])

  const handlePrevAvatar = () => {
    setCurrentAvatar((prev) => (prev === 0 ? avatars.length - 1 : prev - 1))
  }

  const handleNextAvatar = () => {
    setCurrentAvatar((prev) => (prev === avatars.length - 1 ? 0 : prev + 1))
  }

  const handleContinue = () => {
    // Save selected avatar to user data
    if (userData) {
      userData.avatarId = avatars[currentAvatar].id
      Cookies.set("user", JSON.stringify(userData), { expires: 7 })

      // Update in users storage too
      const existingUsers = Cookies.get("users")
      if (existingUsers) {
        const users = JSON.parse(existingUsers)
        if (users[userData.email]) {
          users[userData.email].avatarId = avatars[currentAvatar].id
          Cookies.set("users", JSON.stringify(users), { expires: 365 })
        }
      }
    }

    // Navigate to username selection
    router.push("/onboarding/username")
  }

  return (
    <main
      className={`min-h-screen ${darkMode ? "bg-[#020617] text-white" : "bg-white text-black"} ${pixelifySans.variable} ${pressStart2P.variable}`}
    >
      {/* Progress Bar without Back Button */}
      <div className="w-full max-w-4xl mx-auto pt-8 px-4">
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#a3e635] rounded-full" style={{ width: "50%" }}></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-12 px-4 flex flex-col items-center">
        {/* Title Box with Logo */}
        <div className="flex flex-row items-center mb-12 max-w-2xl w-full">
          <div className="mr-4">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png"
              alt="COMPGame Logo"
              width={100}
              height={100}
            />
          </div>
          <div className={`flex-1 rounded-lg p-6 ${darkMode ? "bg-[#1e293b]" : "bg-[#f1f5f9]"}`}>
            <h1 className="font-press-start-2p text-center text-lg">First, let's choose your look.</h1>
          </div>
        </div>

        {/* Avatar Selection - Reduced size and increased bottom margin */}
        <div className="flex items-center justify-center mb-20">
          <button
            onClick={handlePrevAvatar}
            className={`p-4 rounded-lg mr-8 ${darkMode ? "bg-[#1e293b]" : "bg-[#f1f5f9]"} hover:bg-gray-300`}
            aria-label="Previous avatar"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="relative w-24 h-32">
            <Image
              src={avatars[currentAvatar].src || "/placeholder.svg"}
              alt={avatars[currentAvatar].alt}
              width={96}
              height={128}
              className="object-contain"
              priority
            />
          </div>

          <button
            onClick={handleNextAvatar}
            className={`p-4 rounded-lg ml-8 ${darkMode ? "bg-[#1e293b]" : "bg-[#f1f5f9]"} hover:bg-gray-300`}
            aria-label="Next avatar"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full max-w-md bg-[#0099db] hover:bg-[#007cb2] text-white font-press-start-2p py-4 rounded-md transition-colors"
        >
          Continue
        </button>
      </div>
    </main>
  )
}
