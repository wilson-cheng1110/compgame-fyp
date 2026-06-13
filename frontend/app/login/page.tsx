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

export default function LoginPage() {
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

  const handleResetPassword = () => {
    Cookies.remove("user")
    Cookies.remove("users")
    router.push("/signup")
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Updated validation for SID
    if (!sid || !password) {
      setError("Please fill in all fields")
      return
    }

    // Retrieve global users list from persistence
    const existingUsers = Cookies.get("users")
    if (!existingUsers) {
      setError("Invalid Student ID or password")
      return
    }

    const users = JSON.parse(existingUsers)
    
    /**
     * Logic: We look for a user object where the 'sid' matches.
     * If your store saves users by SID as the key, use: users[sid]
     */
    const user = users[sid]

    if (!user || user.password !== password) {
      setError("Invalid Student ID or password")
      return
    }

    // Log user in with their details stored in the session cookie
    Cookies.set(
      "user",
      JSON.stringify({
        sid,
        username: user.username,
        avatarId: user.avatarId,
      }),
      { expires: 7 },
    )

    // Redirect to the unified dashboard
    router.push("/dashboard")
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

          <div className="flex items-center gap-3">
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

            <Link href="/signup">
              <button className="bg-[#facc15] border-2 border-[#a16207] px-5 py-2 font-pixelify-sans text-base font-bold hover:bg-[#fde047] transition-colors text-black shadow-[3px_3px_0px_0px_#000]">
                Sign Up
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Form */}
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
            <div className={`flex-1 p-6 border-2 border-black ${darkMode ? "bg-[#1e293b]" : "bg-[#f8f6ee]"}`}>
              <h1 className="font-press-start-2p text-center text-lg leading-relaxed">
                Log in to continue your journey~
              </h1>
            </div>
          </div>

          {/* Form Container */}
          <div className={`p-8 border-2 border-black shadow-[8px_8px_0px_0px_#000] ${darkMode ? "bg-[#1e293b]" : "bg-[#f8f6ee]"}`}>
            <form onSubmit={handleLogin} className="space-y-6">
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
                  className="w-full px-4 py-3 border-2 border-black bg-white text-black font-pixelify-sans focus:outline-none focus:ring-2 focus:ring-[#0099db]"
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
                  className="w-full px-4 py-3 border-2 border-black bg-white text-black font-pixelify-sans focus:outline-none focus:ring-2 focus:ring-[#0099db]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0099db] border-2 border-black hover:bg-[#007cb2] text-white font-press-start-2p py-4 transition-transform active:scale-95 shadow-[4px_4px_0px_0px_#000]"
              >
                Log In
              </button>

              <div className="text-center font-pixelify-sans mt-4">
                Need an account?{" "}
                <Link href="/signup" className="text-[#0099db] hover:underline font-bold">
                  Sign up here
                </Link>
              </div>

              <div className="text-center font-pixelify-sans mt-2">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-[#0099db] hover:underline font-bold"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}