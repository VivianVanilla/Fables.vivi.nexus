import { useState } from "react"
import { Settings2, X } from "lucide-react"
import { Modal } from "../ui/Modal"
import type { CharacterData } from "../../character-types"

// ── Types & constants ─────────────────────────────────────────────────────────

type CoinKey      = "pp" | "gp" | "ep" | "sp" | "cp"
type CurrencyMode = "classic" | "simple" | "custom"

const SLOTS: { key: CoinKey; defaultLabel: string; abbrev: string; color: string; bg: string }[] = [
  { key: "pp", defaultLabel: "Platinum", abbrev: "PP", color: "text-violet-300", bg: "bg-violet-500/10" },
  { key: "gp", defaultLabel: "Gold",     abbrev: "GP", color: "text-amber-400",  bg: "bg-amber-500/10"  },
  { key: "ep", defaultLabel: "Electrum", abbrev: "EP", color: "text-cyan-300",   bg: "bg-cyan-500/10"   },
  { key: "sp", defaultLabel: "Silver",   abbrev: "SP", color: "text-slate-300",  bg: "bg-slate-500/10"  },
  { key: "cp", defaultLabel: "Copper",   abbrev: "CP", color: "text-orange-400", bg: "bg-orange-500/10" },
]

const NAME_INDEX: Record<CoinKey, number> = { cp: 0, sp: 1, ep: 2, gp: 3, pp: 4 }
const DEFAULT_NAMES = ["Copper", "Silver", "Electrum", "Gold", "Platinum"]

// CP value of each denomination (standard 5e)
const CP_VALUE: Record<CoinKey, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("en-US") }
function parseRaw(s: string) { return Math.max(0, parseInt(s.replace(/,/g, "").replace(/[^0-9]/g, "")) || 0) }

function orderFor(mode: CurrencyMode): CoinKey[] {
  return mode === "simple" ? ["pp", "gp", "sp", "cp"] : ["pp", "gp", "ep", "sp", "cp"]
}

interface SpendResult {
  canAfford: true
  spent:  Partial<Record<CoinKey, number>>
  change: Partial<Record<CoinKey, number>>
  needsBreaking: boolean
}

function calcSpend(
  coins: Partial<Record<CoinKey, number>>,
  amountCP: number,
  order: CoinKey[],
): { canAfford: false } | SpendResult {
  const totalCP = order.reduce((s, k) => s + (coins[k] ?? 0) * CP_VALUE[k], 0)
  if (amountCP > totalCP) return { canAfford: false }

  let remaining = amountCP
  const spent: Partial<Record<CoinKey, number>> = {}

  // Pass 1: use exact coins highest→lowest
  for (const k of order) {
    if (remaining <= 0) break
    const have = coins[k] ?? 0
    const use  = Math.min(have, Math.floor(remaining / CP_VALUE[k]))
    if (use > 0) { spent[k] = use; remaining -= use * CP_VALUE[k] }
  }

  // Pass 2: if still remaining, overpay with smallest coin that covers it
  if (remaining > 0) {
    for (const k of [...order].reverse()) {
      const have = (coins[k] ?? 0) - (spent[k] ?? 0)
      if (have > 0 && CP_VALUE[k] >= remaining) {
        spent[k] = (spent[k] ?? 0) + 1
        remaining -= CP_VALUE[k]
        break
      }
    }
    // Fallback: use largest available (shouldn't reach here since totalCP was enough)
    if (remaining > 0) {
      for (const k of order) {
        const have = (coins[k] ?? 0) - (spent[k] ?? 0)
        if (have > 0) { spent[k] = (spent[k] ?? 0) + 1; remaining -= CP_VALUE[k] }
        if (remaining <= 0) break
      }
    }
  }

  // Change = overpayment
  const changeCP = -remaining
  const change: Partial<Record<CoinKey, number>> = {}
  if (changeCP > 0) {
    let left = changeCP
    for (const k of order) {
      const val = CP_VALUE[k]
      if (left >= val) { change[k] = Math.floor(left / val); left -= change[k]! * val }
    }
  }

  return { canAfford: true, spent, change, needsBreaking: changeCP > 0 }
}

// ── SpendGainModal ────────────────────────────────────────────────────────────

interface SGProps {
  mode:       "spend" | "gain"
  coins:      Partial<Record<CoinKey, number>>
  slotMode:   CurrencyMode
  customNames: string[]
  getLabel:   (key: CoinKey) => string
  slots:      typeof SLOTS
  onApply:    (next: Partial<Record<CoinKey, number>>) => void
  onClose:    () => void
}

function SpendGainModal({ mode, coins, slotMode, getLabel, slots, onApply, onClose }: SGProps) {
  const [rawAmount, setRawAmount] = useState("")
  const [denom,     setDenom]     = useState<CoinKey>("gp")
  const order = orderFor(slotMode)
  const visSlots = slots.filter(s => slotMode !== "simple" || s.key !== "ep")

  const amount = parseRaw(rawAmount)
  const amountCP = amount * CP_VALUE[denom]

  const totalCP = order.reduce((s, k) => s + (coins[k] ?? 0) * CP_VALUE[k], 0)

  const spendResult = mode === "spend" && amount > 0 ? calcSpend(coins, amountCP, order) : null

  function apply() {
    if (mode === "gain") {
      onApply({ ...coins, [denom]: (coins[denom] ?? 0) + amount })
    } else if (spendResult?.canAfford) {
      const next = { ...coins }
      // Remove spent
      for (const [k, v] of Object.entries(spendResult.spent) as [CoinKey, number][]) {
        next[k] = (next[k] ?? 0) - v
      }
      // Add change
      for (const [k, v] of Object.entries(spendResult.change) as [CoinKey, number][]) {
        next[k] = (next[k] ?? 0) + v
      }
      onApply(next)
    }
    onClose()
  }

  const canConfirm = amount > 0 && (mode === "gain" || (spendResult?.canAfford ?? false))

  const accentGain  = "bg-emerald-600/20 border-emerald-500/30 text-emerald-300"
  const accentSpend = "bg-red-600/20 border-red-500/30 text-red-300"
  const accent = mode === "gain" ? accentGain : accentSpend

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(340px,calc(100vw-2rem))] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-bold text-white capitalize">{mode} Currency</h3>
          <button onClick={onClose} className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Amount */}
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={rawAmount}
            onChange={e => setRawAmount(e.target.value.replace(/[^0-9,]/g, ""))}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-2xl font-bold text-white tabular-nums outline-none focus:border-white/30 placeholder:text-white/20"
          />

          {/* Denomination selector */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Denomination</p>
            <div className={`grid gap-1.5 ${visSlots.length <= 4 ? "grid-cols-4" : "grid-cols-5"}`}>
              {visSlots.map(s => (
                <button
                  key={s.key}
                  onClick={() => setDenom(s.key)}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    denom === s.key
                      ? `${s.bg} border border-white/15 ${s.color}`
                      : "bg-white/5 border border-white/5 text-white/30 hover:text-white/60"
                  }`}
                >
                  {getLabel(s.key)}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {amount > 0 && (
            <div className={`rounded-xl border p-3 flex flex-col gap-2 ${accent}`}>
              {mode === "gain" ? (
                <p className="text-sm">
                  Add <span className="font-bold">{fmt(amount)}</span> {getLabel(denom)} to your wallet.
                </p>
              ) : spendResult == null ? null : !spendResult.canAfford ? (
                <div>
                  <p className="text-sm font-semibold">Can't afford this.</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    You have {fmt(Math.floor(totalCP / CP_VALUE[denom]))} {getLabel(denom)} worth of coins total.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] uppercase tracking-widest opacity-60 font-semibold">Spending</p>
                    {(Object.entries(spendResult.spent) as [CoinKey, number][]).map(([k, v]) => (
                      <p key={k} className="text-sm">− <span className="font-bold">{fmt(v)}</span> {getLabel(k)}</p>
                    ))}
                  </div>
                  {Object.keys(spendResult.change).length > 0 && (
                    <div className="flex flex-col gap-0.5 border-t border-white/10 pt-1.5">
                      <p className="text-[10px] uppercase tracking-widest opacity-60 font-semibold">Change back</p>
                      {(Object.entries(spendResult.change) as [CoinKey, number][]).map(([k, v]) => (
                        <p key={k} className="text-sm">+ <span className="font-bold">{fmt(v)}</span> {getLabel(k)}</p>
                      ))}
                      <p className="text-[10px] opacity-50 mt-0.5">A larger denomination will be broken to make change.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm text-white/40 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors">
            Cancel
          </button>
          <button onClick={apply} disabled={!canConfirm}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-30 ${accent}`}>
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  card: string
  data: CharacterData
  readOnly?: boolean
  update: (patch: Partial<CharacterData>) => void
}

// ── CurrencyTracker ───────────────────────────────────────────────────────────

export function CurrencyTracker({ card, data, readOnly, update }: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const [sgMode,       setSgMode]       = useState<"spend" | "gain" | null>(null)
  const [inputFocus,   setInputFocus]   = useState<Partial<Record<CoinKey, boolean>>>({})

  const mode: CurrencyMode  = (data.currencyMode as CurrencyMode) ?? "classic"
  const coins               = data.currency ?? {}
  const customNames: string[] = data.currencyNames ?? [...DEFAULT_NAMES]
  const visibleSlots = SLOTS.filter(s => mode !== "simple" || s.key !== "ep")

  function getLabel(key: CoinKey) {
    const s = SLOTS.find(sl => sl.key === key)!
    if (mode !== "custom") return s.abbrev
    const name = customNames[NAME_INDEX[key]] ?? s.defaultLabel
    return name.length <= 4 ? name : name.slice(0, 3).toUpperCase()
  }

  function setAmount(key: CoinKey, raw: string) {
    const val = parseRaw(raw)
    update({ currency: { ...coins, [key]: val } })
  }

  function setCustomName(idx: number, name: string) {
    const next = [...customNames]
    while (next.length < 5) next.push(DEFAULT_NAMES[next.length] ?? "")
    next[idx] = name
    update({ currencyNames: next })
  }

  return (
    <>
      {/* ── Settings modal ──────────────────────────────────────────────── */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(380px,calc(100vw-2rem))] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Wallet Settings</h3>
              <button onClick={() => setShowSettings(false)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Currency System</span>
                <div className="flex gap-2">
                  {(["classic", "simple", "custom"] as CurrencyMode[]).map(m => (
                    <button key={m} onClick={() => update({ currencyMode: m })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${
                        mode === m
                          ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                          : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10"
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/30 leading-relaxed">
                  {mode === "classic" && "CP · SP · EP · GP · PP — standard D&D denominations."}
                  {mode === "simple"  && "CP · SP · GP · PP — electrum removed from the system."}
                  {mode === "custom"  && "Rename each denomination to fit your campaign's currency."}
                </p>
              </div>
              {mode === "custom" && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Denomination Names</span>
                  <div className="flex flex-col gap-1.5">
                    {SLOTS.map(s => (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className={`text-xs font-bold font-mono ${s.color} w-8 shrink-0`}>{s.abbrev}</span>
                        <input
                          value={customNames[NAME_INDEX[s.key]] ?? s.defaultLabel}
                          onChange={e => setCustomName(NAME_INDEX[s.key], e.target.value)}
                          placeholder={s.defaultLabel}
                          className="flex-1 bg-white/8 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-amber-500/40 placeholder:text-white/20"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Spend / Gain modal ──────────────────────────────────────────── */}
      {sgMode && (
        <SpendGainModal
          mode={sgMode}
          coins={coins}
          slotMode={mode}
          customNames={customNames}
          getLabel={getLabel}
          slots={SLOTS}
          onApply={next => update({ currency: next })}
          onClose={() => setSgMode(null)}
        />
      )}

      {/* ── Wallet card ─────────────────────────────────────────────────── */}
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-white font-semibold">Wallet</span>
            {!readOnly && (
              <>
                <button onClick={() => setSgMode("gain")}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-white hover:text-emerald-300 hover:bg-emerald-500/25 transition-colors font-semibold">
                  Gain
                </button>
                <button onClick={() => setSgMode("spend")}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-white-hover:text-red-300 hover:bg-red-500/25 transition-colors font-semibold">
                  Spend
                </button>
              </>
            )}
          </div>
          {!readOnly && (
            <button onClick={() => setShowSettings(true)}
              className="size-5 flex items-center justify-center rounded text-white/20 hover:text-white/60 transition-colors"
              title="Wallet settings">
              <Settings2 className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {visibleSlots.map(s => (
            <div key={s.key}
              className={`flex items-center gap-2 rounded-lg ${s.bg} border border-white/5 px-2.5 py-1.5`}>
              <span className={`text-[10px] font-bold tracking-wide ${s.color} shrink-0 w-7`}>
                {getLabel(s.key)}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={inputFocus[s.key] ? (coins[s.key] ?? 0).toString() : fmt(coins[s.key] ?? 0)}
                onFocus={e => { setInputFocus(p => ({ ...p, [s.key]: true })); e.target.select() }}
                onBlur={() => setInputFocus(p => ({ ...p, [s.key]: false }))}
                onChange={e => setAmount(s.key, e.target.value)}
                disabled={readOnly}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white tabular-nums text-right disabled:cursor-default"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
