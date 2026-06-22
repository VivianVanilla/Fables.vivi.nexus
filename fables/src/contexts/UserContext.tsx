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
  refreshObjects: () => Promise<void>
  updateObject: (id: string, updates: userInfo.ObjectsUpdate) => Promise<userInfo.Objects>
  deleteObject: (id: string) => Promise<void>
  batchUpdateObjects: (changes: Array<userInfo.ObjectsUpdate & { id: string }>) => Promise<userInfo.Objects[]>
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

  async function refreshObjects() {
    setLoading(true)
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      const objs = await getObjectsForUser(user.id)
      setObjects(objs)
    } catch (err) {
      console.error("Error refreshing objects:", err)
    }

    setLoading(false)
  }

  async function updateObject(id: string, updates: userInfo.ObjectsUpdate) {
    if (!user?.id) throw new Error("No authenticated user")

    const { data, error } = await supabase
      .from("objects")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("No matching object found for update")

    const updated = data as userInfo.Objects
    setObjects((prev) => prev.map((item) => (item.id === id ? updated : item)))
    return updated
  }

  async function deleteObject(id: string) {
    if (!user?.id) throw new Error("No authenticated user")

    const { error } = await supabase
      .from("objects")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)

    if (error) throw error
    setObjects((prev) => prev.filter((item) => item.id !== id))
  }

  async function batchUpdateObjects(changes: Array<userInfo.ObjectsUpdate & { id: string }>) {
    if (!changes.length) return []

    const updatedRows: userInfo.Objects[] = []

    for (const change of changes) {
      const { id, ...rowUpdates } = change
      const { data, error } = await supabase
        .from("objects")
        .update(rowUpdates)
        .eq("id", id)
        .eq("owner_id", user.id)
        .select()
        .single()

      if (error) {
        console.error("batch update row failed", change, error)
        throw error
      }

      updatedRows.push(data as userInfo.Objects)
    }

    // FIX: was using `updates` (always empty) instead of `updatedRows`
    setObjects((prev) =>
      prev.map((item) => {
        const match = updatedRows.find((u) => u.id === item.id)
        return match ? match : item
      })
    )

    return updatedRows
  }

  return (
    <UserContext.Provider
      value={{
        user,
        objects,
        loading,
        refreshObjects,
        updateObject,
        deleteObject,
        batchUpdateObjects,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error("useUser must be used within UserProvider")
  return context.user
}

export function useObjects() {
  const context = useContext(UserContext)
  if (!context) throw new Error("useObjects must be used within UserProvider")
  return context.objects
}

export function useUserContext() {
  const context = useContext(UserContext)
  if (!context) throw new Error("useUserContext must be used within UserProvider")
  return context
}
