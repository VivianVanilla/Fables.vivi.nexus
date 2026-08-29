// ════════════════════════════════════════════════════════════════════════════
// useOAuthDeepLink.ts — completes Discord sign-in on native Android.
//
// The OAuth flow opens Discord in the system browser (Capacitor can't do it
// inside its own WebView), so Supabase's callback has nowhere to land back
// in-app the way it does on web (where the browser just navigates the same
// page). Instead, login-form.tsx sends Supabase a custom-scheme redirect
// (nexus.fables.vivi://login-callback); Android hands that back to this app
// via an intent (see AndroidManifest.xml's intent-filter), which Capacitor
// surfaces as an appUrlOpen event carrying the same
// #access_token=...&refresh_token=... fragment the web flow would've landed
// on directly. This hook is what turns that into an actual session.
//
// Native Android only — Capacitor.isNativePlatform() is false on web, where
// supabase-js's own detectSessionInUrl already handles this without any of
// this file's help.
//
// Checks App.getLaunchUrl() on mount *in addition to* the live appUrlOpen
// listener below — Chrome handing back to the app forces this activity
// through pause/stop/restart, and the callback URL can arrive as the
// relaunch's own intent before this effect has (re)subscribed its listener.
// getLaunchUrl() is Capacitor's own answer to that exact race: it returns
// whatever URL the app was just launched/resumed with, independent of
// whether a listener happened to be attached at that instant.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Capacitor } from "@capacitor/core"
import { App as CapacitorApp } from "@capacitor/app"
import { supabase } from "../supabase"

async function completeSignInFromUrl(url: string): Promise<boolean> {
  const hash = url.split("#")[1]
  if (!hash) return false

  const params = new URLSearchParams(hash)
  const access_token = params.get("access_token")
  const refresh_token = params.get("refresh_token")
  if (!access_token || !refresh_token) return false

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) { console.error("Failed to complete Discord sign-in:", error); return false }

  return true
}

export function useOAuthDeepLink() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cancelled = false

    CapacitorApp.getLaunchUrl().then(async result => {
      if (cancelled || !result?.url) return
      if (await completeSignInFromUrl(result.url)) navigate("/dashboard")
    })

    const sub = CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
      if (await completeSignInFromUrl(url)) navigate("/dashboard")
    })

    return () => { cancelled = true; sub.then(s => s.remove()) }
  }, [navigate])
}
