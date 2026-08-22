import { useState } from "react"
import { Modal } from "@/components/shared/ui/Modal"
import type { CharacterData } from "@/components/shared/types"
import { THEMES, DEFAULT_THEME, CUSTOM_THEME_KEY, SLOT_THEMES, DEFAULT_SLOT_THEME, CUSTOM_SLOT_THEME_KEY, BG_OPTIONS, DEFAULT_BG_THEME } from "@/components/shared/themes"
import { FAVORITE_CATEGORY_LABELS, STYLING_CATEGORIES, DEFAULT_ACCENT_COLOR, UI_SCALES, type CardStyle } from "@/components/shared/constants"
import { deriveCharacterClassNames, classLabel } from "@/components/shared/classColors"
import { nanoid } from "@/components/shared/utils"

interface Props {
  data: CharacterData
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
  isWarlock: boolean    // gates the Invocations Feature Styling row below
  isArtificer: boolean  // gates the Infusions Feature Styling row below
  characterId: string   // for building the /share/<id>/<token> link below
}

// One None/Outline(or Flat)/Animated toggle group, shared by every Feature
// Styling row's Background and Tracking Slider sub-controls — "outline"
// reads as "Flat" for the slider since there's no border to outline there.
function StyleToggle({ label, value, onChange, slider }: { label: string; value: CardStyle; onChange: (s: CardStyle) => void; slider?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 pl-2">
      <span className="text-[10px] text-white/40 shrink-0">{label}</span>
      <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
        {(["none", "outline", "galaxy"] as CardStyle[]).map(s => (
          <button key={s} type="button" title={s === "galaxy" ? "Animated" : undefined}
            onClick={() => onChange(s)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${value === s ? "bg-purple-500/30 text-purple-200" : "text-white/40 hover:text-white/70"}`}>
            {s === "none" ? "None" : s === "outline" ? (slider ? "Flat" : "Outline") : "Animated"}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsModal({ data, onUpdate, onClose, isWarlock, isArtificer, characterId }: Props) {
  const activeThemeKey = data.theme     ?? DEFAULT_THEME
  const activeSlotKey  = data.slotTheme ?? DEFAULT_SLOT_THEME
  const activeBgKey    = data.themeBg   ?? DEFAULT_BG_THEME
  const themeCustomColor = data.themeCustomColor ?? DEFAULT_ACCENT_COLOR
  const themeBgCustomColor = data.themeBgCustomColor ?? DEFAULT_ACCENT_COLOR
  const slotCustomColor = data.slotCustomColor ?? DEFAULT_ACCENT_COLOR
  const classNames      = deriveCharacterClassNames(data)
  const uiScale         = data.uiScale ?? 100
  const [copied, setCopied] = useState(false)
  const shareUrl = data.shareToken ? `${window.location.origin}/share/${characterId}/${data.shareToken}` : ""

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(520px,92vw)] max-h-[88vh] flex flex-col overflow-hidden">

        <div className="px-5 py-3 border-b border-white/10 shrink-0 flex items-center justify-between gap-3">
          <p className="text-base font-bold text-white">Settings</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">

          {/* Share Link */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Share Link</p>
            <p className="text-[10px] text-white/30 -mt-1">
              Anyone with this link can view (never edit) this character — no account or party invite needed.
            </p>
            {data.shareToken ? (
              <>
                <div className="flex items-center gap-1.5">
                  <input readOnly value={shareUrl} onFocus={e => e.target.select()}
                    className="flex-1 min-w-0 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 outline-none truncate" />
                  <button type="button" onClick={copyLink}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors shrink-0">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => onUpdate({ shareToken: nanoid() })}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors">
                    Regenerate (invalidates the old link)
                  </button>
                  <button type="button" onClick={() => onUpdate({ shareToken: undefined })}
                    className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">
                    Revoke
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => onUpdate({ shareToken: nanoid() })}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors self-start">
                Generate Share Link
              </button>
            )}
          </div>

          {/* Card style */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Card Style</p>
            <div className="grid grid-cols-5 gap-1.5">
              {Object.entries(THEMES).map(([key, t]) => {
                const isActive = key === activeThemeKey
                const isCustom = key === CUSTOM_THEME_KEY
                return (
                  <button key={key} type="button" onClick={() => onUpdate({ theme: key })}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${isActive ? "border-white/50 bg-white/10" : "border-white/10 hover:border-white/25 hover:bg-white/5"}`}>
                    <div className="size-6 rounded-full border border-white/20 shrink-0 relative overflow-hidden">
                      {isCustom ? (
                        <>
                          <div className="absolute inset-0" style={{ backgroundColor: themeCustomColor }} />
                          <div className="absolute inset-0.5 rounded-full" style={{ backgroundColor: themeCustomColor }} />
                        </>
                      ) : (
                        <>
                          <div className={`absolute inset-0 ${t.body}`} />
                          <div className={`absolute inset-0.5 rounded-full ${t.box}`} />
                        </>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold leading-tight truncate w-full text-center ${isActive ? "text-white" : "text-white/50"}`}>{t.label}</span>
                  </button>
                )
              })}
            </div>
            {activeThemeKey === CUSTOM_THEME_KEY && (
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer px-1">
                Custom color
                <input type="color" value={themeCustomColor}
                  onChange={e => onUpdate({ themeCustomColor: e.target.value })}
                  className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
              </label>
            )}
          </div>

          {/* Background */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Background</p>
            <div className="grid grid-cols-5 gap-1.5">
              {Object.entries(BG_OPTIONS).map(([key, bg]) => {
                const isActive = key === activeBgKey
                const isCustom = key === CUSTOM_THEME_KEY
                return (
                  <button key={key} type="button" onClick={() => onUpdate({ themeBg: key })}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${isActive ? "border-white/50 bg-white/10" : "border-white/10 hover:border-white/25 hover:bg-white/5"}`}>
                    <div className={`size-6 rounded-full border border-white/20 shrink-0 ${isCustom ? "" : bg.body}`}
                      style={isCustom ? { backgroundColor: themeBgCustomColor } : undefined} />
                    <span className={`text-[10px] font-semibold leading-tight truncate w-full text-center ${isActive ? "text-white" : "text-white/50"}`}>{bg.label}</span>
                  </button>
                )
              })}
            </div>
            {activeBgKey === CUSTOM_THEME_KEY && (
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer px-1">
                Custom color
                <input type="color" value={themeBgCustomColor}
                  onChange={e => onUpdate({ themeBgCustomColor: e.target.value })}
                  className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
              </label>
            )}
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
              {(() => {
                const isActive = activeSlotKey === CUSTOM_SLOT_THEME_KEY
                return (
                  <button type="button" onClick={() => onUpdate({ slotTheme: CUSTOM_SLOT_THEME_KEY })}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${isActive ? "border-white/50 bg-white/10" : "border-white/10 hover:border-white/25 hover:bg-white/5"}`}>
                    <div className="size-6 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: slotCustomColor }} />
                    <span className={`text-[10px] font-semibold leading-tight truncate w-full text-center ${isActive ? "text-white" : "text-white/50"}`}>Custom</span>
                  </button>
                )
              })()}
            </div>
            <div className="flex items-center justify-between px-1">
              {activeSlotKey === CUSTOM_SLOT_THEME_KEY ? (
                <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                  Custom color
                  <input type="color" value={slotCustomColor}
                    onChange={e => onUpdate({ slotCustomColor: e.target.value })}
                    className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
                </label>
              ) : <span />}
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
                <input type="checkbox" checked={data.slotAnimated ?? false}
                  onChange={e => onUpdate({ slotAnimated: e.target.checked })}
                  className="accent-primary size-4 rounded" />
                Animated
              </label>
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
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={data.showResistanceTracker ?? false}
                onChange={e => onUpdate({ showResistanceTracker: e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className="text-sm text-white/70">Add resistance/vulnerability tracker</span>
            </label>
          </div>

          {/* Feature Styling — one row per category, Magical Items first
              (its style only ever applies to items individually flagged
              Magic Item in their own edit form; every other row applies to
              every card of that category automatically, not just when
              favorited — see FeatureEntry.tsx's categoryAccentStyle). Each
              row has its own Background (card) look and a separate Tracking
              Slider look for that category's "Track uses" bars — the two
              are independent (e.g. an outlined card with an animated bar),
              sharing one accent color. No more setting a bar color per
              individual feature. */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Feature Styling</p>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={data.showMagicItemStar ?? true}
                onChange={e => onUpdate({ showMagicItemStar: e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className="text-sm text-white/70">✨ Star on magic items</span>
            </label>
            <div className="flex flex-col gap-2">
              {/* Magical Items row */}
              <div className="flex flex-col gap-1 px-1 py-1.5 rounded-lg bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white/70 shrink-0">Magical Items</span>
                  <input type="color" value={data.magicItemColor ?? DEFAULT_ACCENT_COLOR} title="Accent color"
                    onChange={e => onUpdate({ magicItemColor: e.target.value })}
                    className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
                </div>
                <StyleToggle label="Background" value={data.magicItemStyle ?? "galaxy"}
                  onChange={s => onUpdate({ magicItemStyle: s })} />
                {/* Mirrors Background until explicitly set otherwise — see
                    FeatureEntry.tsx's sliderSource for why. */}
                <StyleToggle label="Tracking Slider" value={data.magicItemSliderStyle ?? data.magicItemStyle ?? "galaxy"}
                  onChange={s => onUpdate({ magicItemSliderStyle: s })} slider />
              </div>

              {/* One row per Feature Stylings category */}
              {STYLING_CATEGORIES.filter(cat => (cat !== "invocation" || isWarlock) && (cat !== "infusion" || isArtificer)).map(cat => {
                const style       = data.favoriteCategoryStyle?.[cat] ?? "none"
                const sliderStyle = data.favoriteCategorySliderStyle?.[cat] ?? style
                const color       = data.favoriteCategoryColors?.[cat] ?? DEFAULT_ACCENT_COLOR
                const perClass    = cat === "class" && (data.classFeatureColorsByClass ?? false)
                return (
                  <div key={cat} className="flex flex-col gap-1 px-1 py-1.5 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-white/70 shrink-0">{FAVORITE_CATEGORY_LABELS[cat]}</span>
                      {!perClass && (
                        <input type="color" value={color} title="Accent color"
                          onChange={e => onUpdate({ favoriteCategoryColors: { ...data.favoriteCategoryColors, [cat]: e.target.value } })}
                          className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
                      )}
                    </div>
                    {cat === "class" && (
                      <label className="flex items-center gap-2 text-[11px] text-white/50 cursor-pointer select-none pl-2">
                        <input type="checkbox" checked={data.classFeatureColorsByClass ?? false}
                          onChange={e => onUpdate({ classFeatureColorsByClass: e.target.checked })}
                          className="accent-primary size-3.5 rounded" />
                        Separate color per class
                      </label>
                    )}
                    {perClass && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 pl-2 py-1">
                        {classNames.map(key => (
                          <label key={key} className="flex items-center gap-1.5 text-[10px] text-white/50 cursor-pointer select-none">
                            <input type="color" value={data.classFeatureColors?.[key] ?? DEFAULT_ACCENT_COLOR} title={`${classLabel(key)} accent color`}
                              onChange={e => onUpdate({ classFeatureColors: { ...data.classFeatureColors, [key]: e.target.value } })}
                              className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
                            {classLabel(key)}
                          </label>
                        ))}
                      </div>
                    )}
                    <StyleToggle label="Background" value={style}
                      onChange={s => onUpdate({ favoriteCategoryStyle: { ...data.favoriteCategoryStyle, [cat]: s } })} />
                    <StyleToggle label="Tracking Slider" value={sliderStyle}
                      onChange={s => onUpdate({ favoriteCategorySliderStyle: { ...data.favoriteCategorySliderStyle, [cat]: s } })} slider />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Modules and Font Size — shrinks the whole sheet (fonts, padding,
              cards — everything) so more fits on screen at once. 100% is the
              default/current size; 75%/50% zoom out from there. */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Modules and Font Size</p>
            <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit">
              {UI_SCALES.map(scale => (
                <button key={scale} type="button" onClick={() => onUpdate({ uiScale: scale })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${uiScale === scale ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                  {scale}%{scale === 100 ? " (Default)" : ""}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </Modal>
  )
}
