"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUserStore } from "@/lib/store"

export function UserAuthForm() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, login, signup, logout } = useUserStore()
  
  // Updated state to track sid instead of generic username
  const [loginData, setLoginData] = useState({ sid: "", password: "" })
  const [signupData, setSignupData] = useState({ 
    username: "", 
    sid: "", 
    password: "", 
    confirmPassword: "" 
  })
  const [error, setError] = useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // We use the sid as the primary key for login
    if (login(loginData.sid, loginData.password)) {
      setIsOpen(false)
    } else {
      setError("Invalid Student ID or password")
    }
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (signupData.password !== signupData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Pass the username, password, email (as username), and sid
    if (signup(signupData.username, signupData.password, signupData.username, signupData.sid)) {
      setIsOpen(false)
    } else {
      setError("Student ID already registered")
    }
  }

  return (
    <>
      {user ? (
        <div className="flex items-center gap-4">
          <span className="font-pixelify-sans text-sm">
            Welcome, {user.username} <span className="text-blue-500 font-bold">(ID: {user.sid})</span>
          </span>
          <Button variant="outline" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      ) : (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Login / Sign Up</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-press-start-2p text-sm">Account Access</DialogTitle>
              <DialogDescription className="font-pixelify-sans">
                Use your Student ID to access the HCI Research Labs.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="font-press-start-2p text-[10px]">Login</TabsTrigger>
                <TabsTrigger value="signup" className="font-press-start-2p text-[10px]">Sign Up</TabsTrigger>
              </TabsList>
              
              {/* LOGIN TAB */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4 font-pixelify-sans">
                  <div className="space-y-2">
                    <Label htmlFor="login-sid">Student ID (SID)</Label>
                    <Input
                      id="login-sid"
                      placeholder="e.g. 22XXXXXXD"
                      value={loginData.sid}
                      onChange={(e) => setLoginData({ ...loginData, sid: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" className="w-full font-press-start-2p text-xs py-6">
                    Enter Dashboard
                  </Button>
                </form>
              </TabsContent>

              {/* SIGNUP TAB */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4 font-pixelify-sans">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Preferred Display Name</Label>
                    <Input
                      id="signup-username"
                      placeholder="Your name"
                      value={signupData.username}
                      onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-sid">Student ID (SID)</Label>
                    <Input
                      id="signup-sid"
                      placeholder="e.g. 22XXXXXXD"
                      value={signupData.sid}
                      onChange={(e) => setSignupData({ ...signupData, sid: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Create Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" className="w-full font-press-start-2p text-xs py-6">
                    Create Profile
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}