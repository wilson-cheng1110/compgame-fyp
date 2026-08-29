"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { auth } from "@/lib/api"
import { getUsers, setUsers } from "@/lib/user-store"
import { ChevronRight, ChevronLeft } from "lucide-react"

const avatars = [
  {
    id: 1,
    src: "/images/avatar_1.png",
    alt: "Male character with brown hair",
  },
  {
    id: 2,
    src: "/images/avatar_2.png",
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
      // Mirror to the server. The cookie is UI decoration (docs/revamp.md Part 0);
      // without this the account row keeps avatar_id = null, and the student is
      // sent back through onboarding every time they open the app on a different
      // device. Not awaited here — the next screen is the one that must confirm.
      // avatarId is numeric in the local avatar list but a string on the server
      // (SessionUser.avatarId: string | null) — normalise at the boundary.
      void auth.profile(undefined, String(avatars[currentAvatar].id))

      // Update in users storage too (keyed by SID — the user cookie has no email)
      const users = getUsers()
      if (users[userData.sid]) {
        users[userData.sid].avatarId = avatars[currentAvatar].id
        setUsers(users)
      }
    }

    // Navigate to username selection
    router.push("/onboarding/username")
  }

  return (
    <main className="shell min-h-screen">
      <div className="mx-auto w-full max-w-md px-5 py-16">
        {/* Two steps, and the rail says which one you are on — the same graphic the
            topic unit uses for the same reason. */}
        <div className="u-rail mb-8">
          <div className="u-rail-seg is-now" />
          <div className="u-rail-seg" />
          <div className="u-rail-seg" />
        </div>

        <p className="u-eyebrow">Step 1 of 3</p>
        <h1 className="u-h1 mt-1">Pick your look</h1>
        <p className="u-stem u-muted mt-2">
          This is just for you — it shows up on your dashboard. You can ignore it entirely if
          you would rather.
        </p>

        <div className="u-card p-8 mt-8">
          <div className="flex items-center justify-center gap-8">
            <button onClick={handlePrevAvatar} className="u-btn" aria-label="Previous avatar">
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative w-24 h-32 flex items-center justify-center">
              <Image
                src={avatars[currentAvatar].src || "/placeholder.svg"}
                alt={avatars[currentAvatar].alt}
                width={96}
                height={128}
                className="object-contain"
                priority
              />
            </div>

            <button onClick={handleNextAvatar} className="u-btn" aria-label="Next avatar">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <p className="u-faint text-center mt-4 u-num">
            {currentAvatar + 1} of {avatars.length}
          </p>
        </div>

        <button onClick={handleContinue} className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7">
          Continue
        </button>
      </div>
    </main>
  )
}
