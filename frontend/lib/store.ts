"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import Cookies from "js-cookie"

interface User {
  username: string
  sid: string // Added to support legacy participant ID requirements
  badges: Badge[]
  email: string
}

interface Badge {
  gameId: string
  name: string
  level: number // 1-5 stars
  earnedAt: string
}

interface UserState {
  user: User | null
  users: { [username: string]: { password: string; sid: string; badges: Badge[] } }
  login: (username: string, password: string) => boolean
  signup: (username: string, password: string, email: string, sid: string) => boolean
  logout: () => void
  addBadge: (gameId: string, name: string, level: number) => void
  getBadges: () => Badge[]
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      users: {},
      login: (username, password) => {
        const users = get().users
        if (users[username] && users[username].password === password) {
          const userData = {
            username,
            sid: users[username].sid, // Retrieve the SID during login
            badges: users[username].badges || [],
            email: username,
          }
          set({ user: userData })
          // Sync with GameLayout's cookie requirement
          Cookies.set("user", JSON.stringify(userData), { expires: 7 }) 
          return true
        }
        return false
      },
      signup: (username, password, email, sid) => {
        const users = get().users
        if (users[username]) {
          return false
        }

        const newUser = {
          username,
          sid,
          badges: [],
          email: email,
        }

        set({
          users: {
            ...users,
            [username]: { password, sid, badges: [] },
          },
          user: newUser,
        })
        
        Cookies.set("user", JSON.stringify(newUser), { expires: 7 })
        return true
      },
      logout: () => {
        set({ user: null })
        Cookies.remove("user")
      },
      addBadge: (gameId: string, name: string, level: number) => {
        const user = get().user
        if (!user) return

        const existingBadgeIndex = user.badges.findIndex((b) => b.gameId === gameId)
        let updatedBadges = [...user.badges]

        if (existingBadgeIndex >= 0) {
          if (user.badges[existingBadgeIndex].level < level) {
            updatedBadges[existingBadgeIndex] = {
              gameId,
              name,
              level,
              earnedAt: new Date().toISOString(),
            }
          } else {
            return 
          }
        } else {
          updatedBadges = [
            ...user.badges,
            {
              gameId,
              name,
              level,
              earnedAt: new Date().toISOString(),
            },
          ]
        }

        set({
          user: {
            ...user,
            badges: updatedBadges,
          },
        })

        // Persistence in cookies for layout sync
        const existingUsers = get().users
        if (existingUsers[user.username]) {
          existingUsers[user.username].badges = updatedBadges
          Cookies.set("users", JSON.stringify(existingUsers), { expires: 365 })
        }
      },
      getBadges: () => {
        return get().user?.badges || []
      },
    }),
    {
      name: "user-storage",
    },
  ),
)