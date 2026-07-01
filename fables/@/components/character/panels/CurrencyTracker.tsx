import { useState } from "react"
import { Settings2 } from "lucide-react"
import { Modal } from "../ui/Modal"
import type { CharacterData } from "../../character-types"

// ── Slot definitions (highest → lowest value) ─────────────────────────────────

type CoinKey = "pp" | "gp" | "ep" | "sp" | "cp"
type CurrencyMode = "classic" | "simple" | "custom"

const SLOTS: { key: CoinKey; defaultLabel: string; abbrev: string; color: string; bg: string }[] = [
  { key: "pp", defaultLabel: "Platinum", abbrev: "PP", color: "text-violet-300", bg: "bg-violet-500/10" },
  { key: "gp", defaultLabel: "Gold",     abbrev: "GP", color: "text-amber-400",  bg: "bg-amber-500/10"  },
  { key: "ep", defaultLabel: "Electrum", abbrev: "EP", color: "text-cyan-300",   bg: "bg-cyan-500/10"   },
  { key: "sp", defaultLabel: "Silver",   abbrev: "SP", color: "text-slate-300",  bg: "bg-slate-500/10"  },
  { key: "cp", defaultLabel: "Copper",   abbrev: "CP", color: "text-orange-400", bg: "bg-orange-500/10" },
]

// key → index in currencyNames array
const NAME_INDEX: Record<CoinKey, number> = { cp: 0, sp: 1, ep: 2, gp: 3, pp: 4 }
const DEFAULT_NAMES = ["Copper", "Silver", "Electrum", "Gold", "Platinum"]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  card: string
  data: CharacterData
  readOnly?: boolean
  update: (patch: Partial<CharacterData>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CurrencyTracker({ card, data, readOnly, update }: Props) {
  const [showModal, setShowModal] = useState(false)

  const mode: CurrencyMode = (data.currencyMode as CurrencyMode) ?? "classic"
  const coins = data.currency ?? {}
  const customNames: string[] = data.currencyNames ?? [...DEFAULT_NAMES]

  const visibleSlots = SLOTS.filter(s => mode !== "simple" || s.key !== "ep")

  function getLabel(s: typeof SLOTS[0]) {
    if (mode !== "custom") return s.abbrev
    const name = customNames[NAME_INDEX[s.key]] ?? s.defaultLabel
    // Abbreviate: up to 4 chars
    return name.length <= 4 ? name : name.slice(0, 3).toUpperCase()
  }

  function setAmount(key: CoinKey, raw: string) {
    const val = Math.max(0, parseInt(raw) || 0)
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
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(380px,calc(100vw-2rem))] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Wallet Settings</h3>
              <button
                onClick={() => setShowModal(false)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >✕</button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Mode selector */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Currency System</span>
                <div className="flex gap-2">
                  {(["classic", "simple", "custom"] as CurrencyMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => update({ currencyMode: m })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${
                        mode === m
                          ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                          : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10"
                      }`}
                    >{m}</button>
                  ))}
                </div>
                <p className="text-xs text-white/30 leading-relaxed">
                  {mode === "classic" && "CP · SP · EP · GP · PP — standard D&D denominations."}
                  {mode === "simple"  && "CP · SP · GP · PP — electrum removed from the system."}
                  {mode === "custom"  && "Rename each denomination to fit your campaign's currency."}
                </p>
              </div>

              {/* Custom name inputs */}
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

      {/* ── Wallet card ─────────────────────────────────────────────────── */}
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-amber-400/70 font-semibold">Wallet</span>
          {!readOnly && (
            <button
              onClick={() => setShowModal(true)}
              className="size-5 flex items-center justify-center rounded text-white/20 hover:text-white/60 transition-colors"
              title="Wallet settings"
            >
              <Settings2 className="size-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {visibleSlots.map(s => (
            <div
              key={s.key}
              className={`flex items-center gap-2 rounded-lg ${s.bg} border border-white/5 px-2 py-1.5`}
            >
              <span className={`text-[10px] font-bold tracking-wide ${s.color} shrink-0 min-w-[1.5rem]`}>
                {getLabel(s)}
              </span>
              <input
                type="number"
                min={0}
                value={coins[s.key] ?? 0}
                onChange={e => setAmount(s.key, e.target.value)}
                disabled={readOnly}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white tabular-nums text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:cursor-default"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
