"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import Cookies from "js-cookie"
import { getUsers, setUsers } from "@/lib/user-store"
import { ChevronLeft } from "lucide-react"

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

// Avatar blob URLs
const avatarUrls = {
  1: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_1-0OHXpMnV7F5XjJKF4OuVW5OxvnxFRr.png",
  2: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_2-QeIlj2Z9JERNw3e1qM9bzmMMkbbGso.png",
}

export default function UsernameSelectionPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [darkMode, setDarkMode] = useState(false)
  const [error, setError] = useState("")
  const [avatarSrc, setAvatarSrc] = useState("")
  const [userData, setUserData] = useState<any>(null)

  // Check if user is logged in and get avatar
  useEffect(() => {
    const userCookie = Cookies.get("user")
    if (!userCookie) {
      router.push("/login")
      return
    }

    // Get selected avatar
    const parsedUserData = JSON.parse(userCookie)
    setUserData(parsedUserData)

    if (parsedUserData.avatarId) {
      // Use the direct blob URL based on avatarId
      setAvatarSrc(avatarUrls[parsedUserData.avatarId as keyof typeof avatarUrls] || "/placeholder.svg")
    }

    // Check for dark mode preference
    const darkModePref = Cookies.get("darkMode")
    if (darkModePref === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
  }, [router])

  const handleContinue = () => {
    if (!username.trim()) {
      setError("Please enter a username")
      return
    }

    // Save username to user data
    if (userData) {
      userData.username = username
      userData.needsOnboarding = false // Remove the onboarding flag
      Cookies.set("user", JSON.stringify(userData), { expires: 7 })

      // Update in users storage too (keyed by SID — the user cookie has no email)
      const users = getUsers()
      if (users[userData.sid]) {
        users[userData.sid].username = username
        users[userData.sid].avatarId = userData.avatarId
        setUsers(users)
      }
    }

    // Navigate to dashboard
    router.push("/dashboard")
  }

  return (
    <main
      className={`min-h-screen ${darkMode ? "bg-[#020617] text-white" : "bg-white text-black"} ${pixelifySans.variable} ${pressStart2P.variable}`}
    >
      {/* Progress Bar with Back Button */}
      <div className="w-full max-w-4xl mx-auto pt-8 px-4 relative">
        <Link href="/onboarding/avatar" passHref>
          <button
            className="absolute left-4 top-8 p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden ml-12">
          <div className="h-full bg-[#a3e635] rounded-full" style={{ width: "90%" }}></div>
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
            <h1 className="font-press-start-2p text-center text-lg">Looking good! What should I call you?</h1>
          </div>
        </div>

        {/* Avatar Display - Reduced size and increased bottom margin */}
        <div className="mb-16">
          <div className="relative w-24 h-32">
            {avatarSrc && (
              <Image
                src={avatarSrc || "/placeholder.svg"}
                alt="Selected avatar"
                width={96}
                height={128}
                className="object-contain"
                priority
              />
            )}
          </div>
        </div>

        {/* Username Input */}
        <div className="w-full max-w-md mb-8">
          {error && <p className="text-red-500 text-center font-pixelify-sans mb-2">{error}</p>}
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-black font-pixelify-sans"
            maxLength={15}
            required
          />
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
