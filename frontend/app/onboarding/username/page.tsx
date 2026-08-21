"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Cookies from "js-cookie"
import { auth } from "@/lib/api"
import { getUsers, setUsers } from "@/lib/user-store"
import { ChevronLeft } from "lucide-react"

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

  const handleContinue = async () => {
    if (!username.trim()) {
      setError("Please enter a username")
      return
    }

    // THE SERVER IS THE RECORD, THE COOKIE IS DECORATION.
    // This is the last step of onboarding, so it is the one that has to confirm the
    // write landed. If it fails silently the account keeps needsOnboarding = true
    // and the student is walked through onboarding again on their next device — a
    // bug that is invisible on the machine where you test it.
    const res = await auth.profile(
      username.trim(),
      userData?.avatarId != null ? String(userData.avatarId) : undefined,
    )
    if (!res.ok) {
      setError(res.message ?? "Couldn't save that. Check your connection and try again.")
      return
    }

    if (userData) {
      userData.username = username
      userData.needsOnboarding = false
      Cookies.set("user", JSON.stringify(userData), { expires: 7 })

      // Update in users storage too (keyed by SID — the user cookie has no email)
      const users = getUsers()
      if (users[userData.sid]) {
        users[userData.sid].username = username
        users[userData.sid].avatarId = userData.avatarId
        setUsers(users)
      }
    }

    // The baseline is the step after this one, when it has not been sat yet.
    router.push(res.data?.needsBaseline ? "/onboarding/baseline" : "/dashboard")
  }

  return (
    <main className="shell min-h-screen">
      <div className="mx-auto w-full max-w-md px-5 py-16">
        <div className="u-rail mb-8">
          <div className="u-rail-seg is-done" />
          <div className="u-rail-seg is-now" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="u-eyebrow">Step 2 of 2</p>
          <Link href="/onboarding/avatar" className="u-faint hover:underline">
            ← Back
          </Link>
        </div>
        <h1 className="u-h1 mt-1">What should we call you?</h1>
        <p className="u-stem u-muted mt-2">
          A display name for your dashboard. It is not your student ID and nobody is graded on it.
        </p>

        <div className="u-card p-8 mt-8">
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-20 flex-shrink-0 flex items-center justify-center">
              {avatarSrc && (
                <Image
                  src={avatarSrc || "/placeholder.svg"}
                  alt=""
                  width={64}
                  height={80}
                  className="object-contain"
                  priority
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label htmlFor="username" className="u-eyebrow block mb-2">
                Display name
              </label>
              <input
                id="username"
                type="text"
                placeholder="Anything you like"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="u-field"
                maxLength={15}
                required
              />
            </div>
          </div>

          {error && (
            <p className="u-faint mt-4" style={{ color: "var(--state-late)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Continue Button */}
        <button onClick={handleContinue} className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7">
          Continue
        </button>
      </div>
    </main>
  )
}
