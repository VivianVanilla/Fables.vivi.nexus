// ════════════════════════════════════════════════════════════════════════════
// useAndroidBackButton.ts — makes the Android hardware/gesture back button
// behave the way users on this platform expect: close the top-most open
// modal first (see @/components/shared/modalBackStack.ts), otherwise go
// back a screen, otherwise exit the app instead of doing nothing/crashing
// to the OS home screen unexpectedly.
//
// Native Android only — Capacitor.isNativePlatform() is false both on the
// regular web build and inside a desktop/mobile browser, so this is a no-op
// there and the browser's own back button (which already works) is
// untouched.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Capacitor } from "@capacitor/core"
import { App as CapacitorApp } from "@capacitor/app"
import { closeTopModal } from "@/components/shared/modalBackStack"

export function useAndroidBackButton() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const sub = CapacitorApp.addListener("backButton", () => {
      if (closeTopModal()) return
      // canGoBack mirrors the browser back button's own behavior: only pop
      // history if there's actually somewhere to go, otherwise let the app
      // exit rather than getting stuck on a blank/duplicate screen.
      if (window.history.state?.idx > 0) {
        navigate(-1)
      } else {
        CapacitorApp.exitApp()
      }
    })

    return () => { sub.then(s => s.remove()) }
  }, [navigate])
}
