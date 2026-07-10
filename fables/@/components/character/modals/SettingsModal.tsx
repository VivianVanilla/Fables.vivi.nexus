import { Modal } from "../ui/Modal"
import type { CharacterData } from "../../character-types"
import { THEMES, DEFAULT_THEME, SLOT_THEMES, DEFAULT_SLOT_THEME, BG_OPTIONS } from "../../character-themes"

interface Props {
  data: CharacterData
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
}

export function SettingsModal({ data, onUpdate, onClose }: Props) {
  const activeThemeKey = data.theme     ?? DEFAULT_THEME
  const activeSlotKey  = data.slotTheme ?? DEFAULT_SLOT_THEME
  const activeBgKey    = data.themeBg   ?? "default"
  const mode           = data.themeMode ?? "dark"

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(520px,92vw)] max-h-[88vh] flex flex-col overflow-hidden">

        <div className="px-5 py-3 border-b border-white/10 shrink-0 flex items-center justify-between gap-3">
          <p className="text-base font-bold text-white">Settings</p>
          <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
            <button type="button" onClick={() => onUpdate({ themeMode: "dark" })}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${mode === "dark" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
              🌙 Dark
            </button>
            <button type="button" onClick={() => onUpdate({ themeMode: "light" })}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${mode === "light" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
              ☀ Bright
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">

          {/* Card style */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Card Style</p>
            <div className="grid grid-cols-5 gap-1.5">
              {Object.entries(THEMES).map(([key, t]) => {
                const isActive  = key === activeThemeKey
                const bodyClass = mode === "light" ? t.lightBody : t.body
                const boxClass  = mode === "light" ? t.lightBox  : t.box
                return (
                  <button key={key} type="button" onClick={() => onUpdate({ theme: key })}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${isActive ? "border-white/50 bg-white/10" : "border-white/10 hover:border-white/25 hover:bg-white/5"}`}>
                    <div className="size-6 rounded-full border border-white/20 shrink-0 relative overflow-hidden">
                      <div className={`absolute inset-0 ${bodyClass}`} />
                      <div className={`absolute inset-0.5 rounded-full ${boxClass}`} />
                    </div>
                    <span className={`text-[10px] font-semibold leading-tight truncate w-full text-center ${isActive ? "text-white" : "text-white/50"}`}>{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Background */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Background</p>
            <div className="grid grid-cols-5 gap-1.5">
              {Object.entries(BG_OPTIONS).map(([key, bg]) => {
                const isActive    = key === activeBgKey
                const swatchClass = bg.body || (mode === "light" ? THEMES[activeThemeKey]?.lightBody : THEMES[activeThemeKey]?.body) || "bg-zinc-950"
                return (
                  <button key={key} type="button" onClick={() => onUpdate({ themeBg: key })}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${isActive ? "border-white/50 bg-white/10" : "border-white/10 hover:border-white/25 hover:bg-white/5"}`}>
                    <div className={`size-6 rounded-full border border-white/20 shrink-0 ${swatchClass}`} />
                    <span className={`text-[10px] font-semibold leading-tight truncate w-full text-center ${isActive ? "text-white" : "text-white/50"}`}>{bg.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Spell slot color */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Spell Slot Color</p>
            <div className="grid grid-cols-5 gap-1.5">
              {Object.entries(SLOT_THEMES).map(([key, st]) => {
                const isActive = key === activeSlotKey
                return (
                  <button key={key} type="button" onClick={() => onUpdate({ slotTheme: key })}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${isActive ? "border-white/50 bg-white/10" : "border-white/10 hover:border-white/25 hover:bg-white/5"}`}>
                    <div className="size-6 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: st.accent }} />
                    <span className={`text-[10px] font-semibold leading-tight truncate w-full text-center ${isActive ? "text-white" : "text-white/50"}`}>{st.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Interface options */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Options</p>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={!(data.plainSkills ?? false)}
                onChange={e => onUpdate({ plainSkills: !e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className="text-sm text-white/70">Color-code skills by ability</span>
            </label>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={data.hideDiceRoller ?? false}
                onChange={e => onUpdate({ hideDiceRoller: e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className="text-sm text-white/70">Remove dice roller</span>
            </label>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={data.hideJumpCalculator ?? false}
                onChange={e => onUpdate({ hideJumpCalculator: e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className="text-sm text-white/70">Remove jump calculator</span>
            </label>
          </div>

        </div>
      </div>
    </Modal>
  )
}
