// ════════════════════════════════════════════════════════════════════════════
// haptics.ts — one tiny "did that register" tap for long-press affordances
// (message context menu, custom-skill right-click, etc.), native-first with
// a web fallback so nothing regresses outside Capacitor.
//
// @capacitor/haptics calls straight into the OS's real haptic engine on
// native Android (distinctly better than the web Vibration API's buzz-motor
// pulse) and simply no-ops on unsupported platforms rather than throwing, so
// no Capacitor.isNativePlatform() gate is needed here — the plugin already
// does the right thing everywhere; the vibrate() fallback only exists for
// the plain web build, which has no Capacitor bridge to answer at all.
// ════════════════════════════════════════════════════════════════════════════

import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { Capacitor } from "@capacitor/core"

export function tapHaptic() {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
  } else {
    navigator.vibrate?.(10)
  }
}
