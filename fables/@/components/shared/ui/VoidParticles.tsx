// ════════════════════════════════════════════════════════════════════════════
// VoidParticles.tsx — Settings' "Animated Particles" toggle: drifting,
// twinkling star points behind the whole sheet.
//
// A genuinely different thing from every other Background Image option —
// those are all flat CSS (a gradient recipe or an uploaded photo, painted
// identically by every card through a shared CSS custom property; see
// CharacterSheet.tsx/themes.ts's BG_IMAGE_THEMES). This is a real <canvas>,
// animating continuously via tsParticles, rendered ONCE at the sheet root.
// It can't be "windowed" per card the way the CSS presets are — it just
// drifts behind everything as its own layer, on top of whatever
// Background/Background Image color or preset is already showing. Kept as
// its own opt-in toggle rather than folded into the preset grid for
// exactly that reason: it's not interchangeable with the others, it stacks
// with them.
//
// fullScreen MUST stay disabled — tsParticles' default is to build its own
// position: fixed canvas covering the entire browser viewport regardless of
// where it's mounted, which would bleed across the sidebar/tabs outside
// the character sheet entirely, not just this component. Disabling it
// makes the canvas fill whatever container it's actually rendered into
// instead (see the inline position/inset styles below) — this app already
// hit the exact same "position: fixed escapes its own component" problem
// once before with a different CSS technique (see CharacterSheet.tsx's own
// comments on Background Image's "window" mode).
// ════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react"
import { Particles, ParticlesProvider } from "@tsparticles/react"
import { loadStarsPreset } from "@tsparticles/preset-stars"
import type { Engine } from "@tsparticles/engine"

async function initEngine(engine: Engine) {
  await loadStarsPreset(engine)
}

export function VoidParticles() {
  // Transparent background — this layers ON TOP of whatever's already
  // there (the plain Background color, or a Background Image preset like
  // Void Corruption/Galaxy), it doesn't replace it. Slow drift and a light
  // violet tint instead of the stars preset's own defaults (white, a
  // little faster) to actually read as "void," not just "stock starfield."
  const options = useMemo(() => ({
    preset: "stars",
    fullScreen: { enable: false },
    background: { color: "transparent" },
    particles: {
      number: { value: 60 },
      move: { speed: 0.15 },
      paint: { fill: { color: { value: "#c4b5fd" } } },
    },
  }), [])

  return (
    <ParticlesProvider init={initEngine}>
      <Particles
        id="fables-void-particles"
        options={options}
        style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none" }}
      />
    </ParticlesProvider>
  )
}
