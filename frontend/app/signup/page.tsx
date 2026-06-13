"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import Cookies from "js-cookie"

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

export default function SignupPage() {
  const router = useRouter()
  // Changed state from 'email' to 'sid' to match legacy requirements
  const [sid, setSid] = useState("") 
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [darkMode, setDarkMode] = useState(false)

  // Check if user is already logged in
  useEffect(() => {
    const userCookie = Cookies.get("user")
    if (userCookie) {
      router.push("/dashboard")
    }

    // Check for dark mode preference
    const darkModePref = Cookies.get("darkMode")
    if (darkModePref === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
  }, [router])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    if (newMode) {
      document.body.classList.add("dark-mode")
      Cookies.set("darkMode", "true", { expires: 365 })
    } else {
      document.body.classList.remove("dark-mode")
      Cookies.set("darkMode", "false", { expires: 365 })
    }
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Updated validation for SID
    if (!sid || !password) {
      setError("Please fill in all fields")
      return
    }

    // Check if user already exists in the global 'users' cookie
    const existingUsers = Cookies.get("users")
    const users = existingUsers ? JSON.parse(existingUsers) : {}

    if (users[sid]) {
      setError("This Student ID is already registered")
      return
    }

    // Create new user entry keyed by SID
    users[sid] = {
      sid,
      password, // In a real app, you would hash this password
      badges: [],
      createdAt: new Date().toISOString(),
      // Adding a temporary username to prevent errors in other components
      username: `User_${sid.slice(-4)}`,
      avatarId: 1, // Default avatar
    }

    // Save updated users list to persistent cookies
    Cookies.set("users", JSON.stringify(users), { expires: 365 })

    // Log the user in by setting the 'user' session cookie
    Cookies.set(
      "user",
      JSON.stringify({
        sid,
        username: users[sid].username,
        avatarId: users[sid].avatarId,
        needsOnboarding: true,
      }),
      { expires: 7 },
    )
    
    // Redirect to onboarding to set up Avatar and Username
    router.push("/onboarding/avatar")
  }

  return (
    <main
      className={`min-h-screen ${darkMode ? "bg-[#020617] text-white" : "bg-white text-black"} ${pixelifySans.variable} ${pressStart2P.variable}`}
    >
      {/* Header */}
      <header className="w-full bg-[#f4eba7] py-3 border-b-2 border-black">
        <div className="container mx-auto px-8 md:px-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png"
              alt="COMPGame Logo"
              width={40}
              height={40}
              className="mr-3"
            />
            <span className="font-press-start-2p text-black text-xl">COMPGame</span>
          </Link>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <div className="w-6 h-6 flex items-center justify-center text-black">
                {darkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>

            <Link href="/login">
              <button className="bg-[#facc15] border-2 border-[#a16207] px-5 py-2 font-pixelify-sans text-base font-bold hover:bg-[#FDE047] transition-colors text-black shadow-[2px_2px_0px_0px_#000]">
                Log In
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Signup Form */}
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <div className="max-w-2xl w-full">
          {/* Welcome Banner */}
          <div className="flex flex-row items-center mb-6">
            <div className="mr-4">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png"
                alt="COMPGame Logo"
                width={100}
                height={100}
              />
            </div>
            <div className={`flex-1 rounded-lg p-6 border-2 border-black ${darkMode ? "bg-[#1e293b]" : "bg-[#f1f5f9]"}`}>
              <h1 className="font-press-start-2p text-center text-lg leading-relaxed">
                Create an account to earn badges :)
              </h1>
            </div>
          </div>

          {/* Form Container */}
          <div className={`rounded-lg p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${darkMode ? "bg-[#1e293b]" : "bg-[#f1f5f9]"}`}>
            <form onSubmit={handleSignup} className="space-y-6">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded font-pixelify-sans text-center">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="font-press-start-2p text-[10px]">Student ID (SID):</label>
                <input
                  type="text"
                  placeholder="e.g. 22000000D"
                  value={sid}
                  onChange={(e) => setSid(e.target.value)}
                  className="w-full px-4 py-3 rounded-md border-2 border-black bg-white text-black font-pixelify-sans focus:outline-none focus:ring-2 focus:ring-[#0099db]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="font-press-start-2p text-[10px]">Password:</label>
                <input
                  type="password"
                  placeholder=""
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-md border-2 border-black bg-white text-black font-pixelify-sans focus:outline-none focus:ring-2 focus:ring-[#0099db]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0099db] border-2 border-black hover:bg-[#007cb2] text-white font-press-start-2p py-4 rounded-md transition-transform active:scale-95 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Sign Up for Free
              </button>

              <div className="text-center font-pixelify-sans mt-4">
                Already have an account?{" "}
                <Link href="/login" className="text-[#0099db] hover:underline font-bold">
                  Log in here
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}