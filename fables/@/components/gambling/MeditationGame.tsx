// ════════════════════════════════════════════════════════════════════════════
// MeditationGame.tsx — a breathing timer with inspiring quotes. No tokens, no
// wager, no way to lose — the one tab in gamVIVIling that's just here to help
// you put the controller down for sixty seconds.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"

type Phase = "in" | "hold" | "out"

const PHASE_SECONDS: Record<Phase, number> = { in: 4, hold: 4, out: 6 }
const PHASE_LABEL: Record<Phase, string> = { in: "Breathe in…", hold: "Hold…", out: "Breathe out…" }
const NEXT_PHASE: Record<Phase, Phase> = { in: "hold", hold: "out", out: "in" }

const QUOTES = [
  "The house always wins eventually. Peace doesn't roll dice.",
  "You are not your last spin.",
  "Nothing is won or lost in this breath. It just is.",
  "Slow down. The tokens will still be there in a minute.",
  "Luck is a story you tell about randomness. Breathe instead.",
  "The best bet is the one you don't need to make.",
  "Stillness pays out every single time.",
  "Inhale calm. Exhale the urge to chase it.",
  "You already have enough.",
  "This moment isn't a wager — you can't lose it.",
]

interface Session {
  phase: Phase
  secondsLeft: number
  cyclesDone: number
}

function freshSession(): Session {
  return { phase: "in", secondsLeft: PHASE_SECONDS.in, cyclesDone: 0 }
}

export function MeditationGame() {
  const [running, setRunning] = useState(false)
  const [session, setSession] = useState<Session>(freshSession)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setSession(prev => {
        if (prev.secondsLeft > 1) return { ...prev, secondsLeft: prev.secondsLeft - 1 }
        const nextPhase = NEXT_PHASE[prev.phase]
        return {
          phase: nextPhase,
          secondsLeft: PHASE_SECONDS[nextPhase],
          cyclesDone: nextPhase === "in" ? prev.cyclesDone + 1 : prev.cyclesDone,
        }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  function toggle() {
    if (!running) setSession(freshSession())
    setRunning(r => !r)
  }

  const progress = 1 - (session.secondsLeft - 1) / PHASE_SECONDS[session.phase]
  const scale = session.phase === "in" ? 0.6 + progress * 0.4 : session.phase === "out" ? 1 - progress * 0.4 : 1

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="relative size-32 flex items-center justify-center">
        <div
          className="absolute rounded-full bg-gradient-to-br from-sky-400/30 to-purple-400/30 border border-white/20 transition-transform ease-linear"
          style={{ width: "100%", height: "100%", transform: `scale(${running ? scale : 0.6})`, transitionDuration: "980ms" }}
        />
        <span className="relative text-sm font-semibold text-white/80 text-center px-2">
          {running ? PHASE_LABEL[session.phase] : "Ready?"}
        </span>
      </div>

      {running && (
        <p className="text-xs text-white/40 tabular-nums">{session.secondsLeft}s · cycle {session.cyclesDone + 1}</p>
      )}

      <button type="button" onClick={toggle}
        className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors">
        {running ? "Stop" : "Start Breathing"}
      </button>

      <p className="text-sm text-white/60 italic text-center max-w-xs leading-relaxed">"{quote}"</p>

      <p className="text-[10px] text-white/25 text-center max-w-xs">4s in · 4s hold · 6s out — no tokens, no wager, just breathing</p>
    </div>
  )
}
