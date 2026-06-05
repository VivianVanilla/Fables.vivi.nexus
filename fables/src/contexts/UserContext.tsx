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

const UserContext = createContext<User | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
      // fetch objects for this user so we can inspect them in the console
      if (data.user?.id) {
        try {
          const objs = await getObjectsForUser(data.user.id)
          console.log("getObjectsForUser AWAITED:", objs)
        } catch (err) {
          console.error("Error calling getObjectsForUser:", err)
        }
      }
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
