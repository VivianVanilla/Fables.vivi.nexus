"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../supabase"

type User = any

const UserContext = createContext<User | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }

    loadUser()
  }, [])

  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  return context
}
