"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../supabase"
import type { userInfo } from "@/types/userInfo"


export async function getObjectsForUser(userId: string) {
  const { data, error } = await supabase
    .from("objects")
    .select("*")
    .eq("owner_id", userId)


  if (error) throw error
   
  return data as userInfo.Objects[]

}

type User = any

interface UserContextType {
  user: User | null
  objects: userInfo.Objects[]
  loading: boolean
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [objects, setObjects] = useState<userInfo.Objects[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      setLoading(true)

      const { data } = await supabase.auth.getUser()
      setUser(data.user)

      if (data.user?.id) {
        try {
          const objs = await getObjectsForUser(data.user.id)
          setObjects(objs)
        } catch (err) {
          console.error("Error calling getObjectsForUser:", err)
        }
      }

      setLoading(false)
    }

    loadUser()
  }, [])

  return (
    <UserContext.Provider value={{ user, objects, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useUser must be used within UserProvider")
  }
  return context.user
}

export function useObjects() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useObjects must be used within UserProvider")
  }
  return context.objects
}

export function useUserContext() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useUserContext must be used within UserProvider")
  }
  return context
}
