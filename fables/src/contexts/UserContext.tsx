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

  // Notes someone else owns but has invited this user to collaborate on
  // (data.collaboratorIds contains our id). Requires an RLS policy allowing
  // SELECT on `objects` when auth.uid() appears in data->collaboratorIds —
  // without it this simply returns nothing, same as before.
  const { data: shared, error: sharedError } = await supabase
    .from("objects")
    .select("*")
    .eq("type", "note")
    .neq("owner_id", userId)
    .filter("data->collaboratorIds", "cs", JSON.stringify([userId]))

  if (sharedError) console.error("Error loading shared notes:", sharedError)

  return [...(data as userInfo.Objects[]), ...((shared ?? []) as userInfo.Objects[])]
}

type User = any

interface UserContextType {
  user: User | null
  objects: userInfo.Objects[]
  loading: boolean
  refreshObjects: () => Promise<void>
  createObject: (payload: { name: string; type: string; parent_id?: string | null; data?: Record<string, unknown> }) => Promise<userInfo.Objects>
  updateObject: (id: string, updates: userInfo.ObjectsUpdate) => Promise<userInfo.Objects>
  updateSharedObject: (id: string, updates: userInfo.ObjectsUpdate) => Promise<userInfo.Objects>
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

  async function createObject({
    name,
    type,
    parent_id = null,
    data = {},
  }: {
    name: string
    type: string
    parent_id?: string | null
    data?: Record<string, unknown>
  }) {
    if (!user?.id) throw new Error("No authenticated user")

    // Position = end of sibling list
    const siblings = objects.filter((o) => (o.parent_id ?? null) === (parent_id ?? null))
    const position = siblings.length

    const { data: row, error } = await supabase
      .from("objects")
      .insert({
        name,
        type,
        parent_id: parent_id ?? null,
        data,
        owner_id: user.id,
        position,
        created_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single()

    if (error) throw error

    const created = row as userInfo.Objects
    setObjects((prev) => [...prev, created])
    return created
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

  // Like updateObject, but without the owner_id filter — needed so a note
  // collaborator (not the owner) can save their edits. Only ever call this
  // for fields gated behind an explicit collaborator check (see NoteView),
  // and it only actually works once a matching RLS policy exists on
  // `objects` allowing UPDATE when auth.uid() is listed in data.collaboratorIds.
  async function updateSharedObject(id: string, updates: userInfo.ObjectsUpdate) {
    const { data, error } = await supabase
      .from("objects")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("No matching object found for update (missing RLS permission?)")

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
        createObject,
        updateObject,
        updateSharedObject,
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
