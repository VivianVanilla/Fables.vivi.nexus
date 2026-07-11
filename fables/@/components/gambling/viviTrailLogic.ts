// ════════════════════════════════════════════════════════════════════════════
// viviTrailLogic.ts — "The Vivi Trail" (Oregon Trail parody) survival math.
// Wager, then click through TRAIL_LEGS legs of the journey; each leg rolls a
// weighted random event that costs, spares, or restores a point of health
// (capped at TRAIL_MAX_HEALTH — no stockpiling). Hit 0 health and the run
// ends early with the wager lost; reach the end with health left and the
// wager pays out at TRAIL_PAYOUT_MULTIPLIER. Event weights were Monte-Carlo'd
// to land around a ~58% survival rate — risky enough to feel like a real
// trail. The payout itself (8x) is a deliberately generous jackpot rather
// than a break-even number.
// ════════════════════════════════════════════════════════════════════════════

export const TRAIL_LEGS = 8
export const TRAIL_START_HEALTH = 3
export const TRAIL_MAX_HEALTH = 3
export const TRAIL_PAYOUT_MULTIPLIER = 8

export interface TrailEvent {
  text: string
  hpDelta: number
  weight: number
}

export const TRAIL_EVENTS: TrailEvent[] = [
  // Bad — lose a point of health
  { text: "A wagon wheel snaps on a rock.",                    hpDelta: -1, weight: 8 },
  { text: "You catch dysentery.",                              hpDelta: -1, weight: 8 },
  { text: "The river crossing goes badly.",                    hpDelta: -1, weight: 6 },
  { text: "Bandits raid the camp overnight.",                  hpDelta: -1, weight: 6 },
  { text: "A sudden hailstorm batters the wagon.",              hpDelta: -1, weight: 5 },
  { text: "You spent too much at the last gamVIVIling stop.",   hpDelta: -1, weight: 4 },
  // Neutral
  { text: "An uneventful day on the trail.",                   hpDelta: 0,  weight: 22 },
  { text: "You make good time along a flat stretch.",          hpDelta: 0,  weight: 18 },
  // Good — recover a point of health (capped at TRAIL_MAX_HEALTH)
  { text: "You find a berry patch.",                           hpDelta: 1,  weight: 9 },
  { text: "A friendly trader shares supplies.",                hpDelta: 1,  weight: 8 },
  { text: "You rest a full day and recover.",                  hpDelta: 1,  weight: 6 },
]

const TRAIL_EVENT_WEIGHT_TOTAL = TRAIL_EVENTS.reduce((s, e) => s + e.weight, 0)

export function rollEvent(): TrailEvent {
  let r = Math.random() * TRAIL_EVENT_WEIGHT_TOTAL
  for (const e of TRAIL_EVENTS) {
    if (r < e.weight) return e
    r -= e.weight
  }
  return TRAIL_EVENTS[TRAIL_EVENTS.length - 1]
}

// Flavor text only, shown once health hits 0 — doesn't affect payout math.
export const DEATH_CAUSES = [
  "dysentery", "a rattlesnake bite", "drowning at a river crossing",
  "measles", "sheer exhaustion", "a bad batch of trail mix",
]

export function rollDeathCause(): string {
  return DEATH_CAUSES[Math.floor(Math.random() * DEATH_CAUSES.length)]
}
