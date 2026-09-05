import { useState } from "react"
import { Sun, Moon } from "lucide-react"
import { Modal } from "@/components/shared/ui/Modal"
import { ColorSwatchInput } from "@/components/shared/ui/ColorSwatchInput"
import type { CharacterData } from "@/components/shared/types"
import { THEMES, DEFAULT_THEME, CUSTOM_THEME_KEY, SLOT_THEMES, DEFAULT_SLOT_THEME, CUSTOM_SLOT_THEME_KEY, BG_OPTIONS, DEFAULT_BG_THEME } from "@/components/shared/themes"
import { FAVORITE_CATEGORY_LABELS, STYLING_CATEGORIES, DEFAULT_ACCENT_COLOR, DEFAULT_RARITY_HEX, UI_SCALES, TEXT_COLOR_OPTIONS, type CardStyle } from "@/components/shared/constants"
import { deriveCharacterClassNames, classLabel } from "@/components/shared/classColors"
import { nanoid } from "@/components/shared/utils"

interface Props {
  data: CharacterData
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
  isWarlock: boolean    // gates the Invocations Feature Styling row below
  isArtificer: boolean  // gates the Infusions Feature Styling row below
  characterId: string   // for building the /share/<id>/<token> link below
  card: string           // this character's own card styling (theme.box + ring) — this modal's shell inherits it instead of a fixed generic look
}

// One None/Outline(or Flat)/Animated(Dark)/Animated(Light) toggle group,
// shared by every Feature Styling row's Background and Tracking Slider
// sub-controls — "outline" reads as "Flat" for the slider since there's no
// border to outline there. "Dark" ("galaxy") blends toward the sheet's real
// card color, which is usually dark; "Light" ("galaxy-light") is a fixed
// light-toward-white nebula instead, for light-built sheets (or anyone who
// just wants a brighter animated look) the dark variant doesn't serve well.
function StyleToggle({ label, value, onChange, slider, dark }: { label: string; value: CardStyle; onChange: (s: CardStyle) => void; slider?: boolean; dark?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 pl-2">
      <span className={`text-[10px] ${dark ? "text-black/50" : "text-white/40"} shrink-0`}>{label}</span>
      <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
        {(["none", "outline", "galaxy", "galaxy-light"] as CardStyle[]).map(s => (
          <button key={s} type="button" title={s === "galaxy" ? "Animated (Dark)" : s === "galaxy-light" ? "Animated (Light)" : undefined}
            onClick={() => onChange(s)}
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${value === s ? "bg-purple-500/30 text-purple-200" : "text-white/40 hover:text-white/70"}`}>
            {s === "galaxy" && <Moon size={10} className="shrink-0" />}
            {s === "galaxy-light" && <Sun size={10} className="shrink-0" />}
            {s === "none" ? "None" : s === "outline" ? (slider ? "Flat" : "Outline") : s === "galaxy" ? "Dark" : "Light"}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsModal({ data, onUpdate, onClose, isWarlock, isArtificer, characterId, card }: Props) {
  const activeThemeKey = data.theme     ?? DEFAULT_THEME
  const activeSlotKey  = data.slotTheme ?? DEFAULT_SLOT_THEME
  const activeBgKey    = data.themeBg   ?? DEFAULT_BG_THEME
  const themeCustomColor = data.themeCustomColor ?? DEFAULT_ACCENT_COLOR
  const themeBgCustomColor = data.themeBgCustomColor ?? DEFAULT_ACCENT_COLOR
  const slotCustomColor = data.slotCustomColor ?? DEFAULT_ACCENT_COLOR
  const classNames      = deriveCharacterClassNames(data)
  const uiScale         = data.uiScale ?? 100
  // Same convention already used elsewhere for the sheet-wide Text Color
  // setting (tagTextColor/bodyTextColor in InfoTab.tsx etc.) — this modal's
  // own shell already inherits the character's Card Style background (see
  // the `card` prop), instead of a fixed color, so its own labels should
  // follow the same text-color choice rather than always being white.
  // Written as full literal class strings (not built from a template) so
  // Tailwind's scanner actually generates them — deliberately left off of
  // swatch/toggle active-state text below, which has its own selection-
  // state meaning independent of this setting, same scoping every other
  // use of this pattern in the app already follows.
  const dark    = data.textColorOverride === "dark"
  const cTitle  = dark ? "text-black"    : "text-white"
  const cHead   = dark ? "text-black/70" : "text-white/40"
  const c70     = dark ? "text-black/80" : "text-white/70"
  const c50     = dark ? "text-black/60" : "text-white/50"
  const c40     = dark ? "text-black/50" : "text-white/40"
  const c30     = dark ? "text-black/40" : "text-white/30"
  const cHover  = dark ? "hover:text-black" : "hover:text-white"
  const cHover60 = dark ? "hover:text-black/70" : "hover:text-white/60"
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
      <div className={`${card} shadow-2xl w-[min(520px,92vw)] max-h-[88vh] flex flex-col overflow-hidden`}>

        <div className="px-5 py-3 border-b border-white/10 shrink-0 flex items-center justify-between gap-3">
          <p className={`text-base font-bold ${cTitle}`}>Settings</p>
          <button type="button" onClick={onClose}
            className={`size-7 flex items-center justify-center rounded-lg hover:bg-white/10 ${c40} ${cHover} shrink-0`}>✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">

          {/* Share Link */}
          <div className="flex flex-col gap-2">
            <p className={`text-xs uppercase tracking-widest ${cHead} font-semibold`}>Share Link</p>
            <p className={`text-[10px] ${c30} -mt-1`}>
              Anyone with this link can view this character/
            </p>
            {data.shareToken ? (
              <>
                <div className="flex items-center gap-1.5">
                  <input readOnly value={shareUrl} onFocus={e => e.target.select()}
                    className={`flex-1 min-w-0 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs ${c70} outline-none truncate`} />
                  <button type="button" onClick={copyLink}
                    className={`text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 ${c70} ${cHover} transition-colors shrink-0`}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => onUpdate({ shareToken: nanoid() })}
                    className={`text-[10px] ${c30} ${cHover60} transition-colors`}>
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
                className={`text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 ${c70} ${cHover} transition-colors self-start`}>
                Generate Share Link
              </button>
            )}
          </div>

          {/* Interface options */}
          <div className="flex flex-col gap-2">
            <p className={`text-xs uppercase tracking-widest ${cHead} font-semibold`}>Options</p>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={!(data.plainSkills ?? false)}
                onChange={e => onUpdate({ plainSkills: !e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className={`text-sm ${c70}`}>Color-code skills by ability</span>
            </label>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={data.hideJumpCalculator ?? false}
                onChange={e => onUpdate({ hideJumpCalculator: e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className={`text-sm ${c70}`}>Remove jump calculator</span>
            </label>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={data.showResistanceTracker ?? false}
                onChange={e => onUpdate({ showResistanceTracker: e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className={`text-sm ${c70}`}>Add resistance/vulnerability tracker</span>
            </label>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={data.hideSpellsSection ?? false}
                onChange={e => onUpdate({ hideSpellsSection: e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className={`text-sm ${c70}`}>Hide Spells (Martial-only character)</span>
            </label>
            <label className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 cursor-pointer select-none">
              <input type="checkbox" checked={data.hideMartialSection ?? false}
                onChange={e => onUpdate({ hideMartialSection: e.target.checked })}
                className="accent-primary size-4 rounded" />
              <span className={`text-sm ${c70}`}>Hide Martial (spellcaster-only character)</span>
            </label>
          </div>

          {/* Modules and Font Size — shrinks/grows the whole sheet (fonts,
              padding, cards — everything) so more or less fits on screen at
              once. 100% is the default/current size; 75% zooms out, 125%
              zooms in. Also home to the sheet-wide text color switch below. */}
          <div className="flex flex-col gap-2">
            <p className={`text-xs uppercase tracking-widest ${cHead} font-semibold`}>Modules and Font Size</p>
            <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit">
              {UI_SCALES.map(scale => (
                <button key={scale} type="button" onClick={() => onUpdate({ uiScale: scale })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${uiScale === scale ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                  {scale}%{scale === 100 ? " (Default)" : ""}
                </button>
              ))}
            </div>
            {/* Text stays white by default (Auto) — every card/panel background
                is still always dark, so this only reads correctly with a
                matching light background theme, which doesn't exist yet.
                "Dark" is here as groundwork for that. */}
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs ${c50}`}>Text Color</span>
              <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit">
                {TEXT_COLOR_OPTIONS.map(opt => (
                  <button key={opt} type="button" onClick={() => onUpdate({ textColorOverride: opt })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${(data.textColorOverride ?? "white") === opt ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Styling below — Card Style, Background, Spell Slot Color, Feature Styling ── */}

          {/* Card style */}
          <div className="flex flex-col gap-2">
            <p className={`text-xs uppercase tracking-widest ${cHead} font-semibold`}>Card Style</p>
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
              <label className={`flex items-center gap-2 text-xs ${c50} cursor-pointer px-1`}>
                Custom color
                <ColorSwatchInput value={themeCustomColor} onChange={v => onUpdate({ themeCustomColor: v })} />
              </label>
            )}
          </div>

          {/* Background */}
          <div className="flex flex-col gap-2">
            <p className={`text-xs uppercase tracking-widest ${cHead} font-semibold`}>Background</p>
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
              <label className={`flex items-center gap-2 text-xs ${c50} cursor-pointer px-1`}>
                Custom color
                <ColorSwatchInput value={themeBgCustomColor} onChange={v => onUpdate({ themeBgCustomColor: v })} />
              </label>
            )}
          </div>

          {/* Spell slot color */}
          <div className="flex flex-col gap-2">
            <p className={`text-xs uppercase tracking-widest ${cHead} font-semibold`}>Spell Slot Color</p>
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
                <label className={`flex items-center gap-2 text-xs ${c50} cursor-pointer`}>
                  Custom color
                  <ColorSwatchInput value={slotCustomColor} onChange={v => onUpdate({ slotCustomColor: v })} />
                </label>
              ) : <span />}
              <label className={`flex items-center gap-2 text-xs ${c50} cursor-pointer select-none`}>
                <input type="checkbox" checked={data.slotAnimated ?? false}
                  onChange={e => onUpdate({ slotAnimated: e.target.checked })}
                  className="accent-primary size-4 rounded" />
                Animated
              </label>
            </div>
          </div>

          {/* Feature Styling — one row per category, Magical Items first
              (its style only ever applies to items individually flagged
              Magic Item in their own edit form; every other row applies to
              every card of that category automatically, not just when
              favorited — see FeatureEntry.tsx's categoryAccentStyle). Each
              row has its own Background (card) look and a separate Tracking
              Slider look for that category's "Track uses" bars — the two
              are independent */}
          <div className="flex flex-col gap-2">
            <p className={`text-xs uppercase tracking-widest ${cHead} font-semibold`}>Feature Styling</p>
            
            <div className="flex flex-col gap-2">
              {/* Magical Items row — flat single accent color by default
                  (Card + Slider both follow it, same as any other category),
                  or per-rarity Card+Slider colors instead when "Separate
                  color per rarity" is checked. */}
              <div className="flex flex-col gap-1 px-1 py-1.5 rounded-lg bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm ${c70} shrink-0`}>Magical Items</span>
                  {!(data.magicItemColorsByRarity ?? false) && (
                    <label className="flex flex-col items-center gap-0.5 cursor-pointer shrink-0">
                      <ColorSwatchInput value={data.magicItemColor ?? DEFAULT_ACCENT_COLOR} title="Accent color"
                        onChange={v => onUpdate({ magicItemColor: v })} />
                      <span className={`text-[8px] ${c30}`}>Color</span>
                    </label>
                  )}
                </div>

                <StyleToggle label="Background" value={data.magicItemStyle ?? "galaxy"}
                  onChange={s => onUpdate({ magicItemStyle: s })} dark={dark} />

                {/* Mirrors Background until explicitly set otherwise — see
                    FeatureEntry.tsx's sliderSource for why. */}
                <StyleToggle label="Tracking Slider" value={data.magicItemSliderStyle ?? data.magicItemStyle ?? "galaxy"}
                  onChange={s => onUpdate({ magicItemSliderStyle: s })} slider dark={dark} />

                <label className={`flex items-center gap-2 text-[11px] ${c50} cursor-pointer select-none pl-2`}>
                  <input type="checkbox" checked={data.showMagicItemStar ?? true}
                    onChange={e => onUpdate({ showMagicItemStar: e.target.checked })}
                    className="accent-primary size-3.5 rounded" />
                  ✨ Star on magic items
                </label>

                <label className={`flex items-center gap-2 text-[11px] ${c50} cursor-pointer select-none pl-2`}>
                  <input type="checkbox" checked={data.magicItemColorsByRarity ?? false}
                    onChange={e => onUpdate({ magicItemColorsByRarity: e.target.checked })}
                    className="accent-primary size-3.5 rounded" />
                  Separate color per rarity
                </label>

                {(data.magicItemColorsByRarity ?? false) && (
                  <div className="flex flex-col gap-1.5 pl-2 py-1">
                    {(["Common","Uncommon","Rare","Very Rare","Legendary","Artifact"] as const).map(tier => (
                      <div key={tier} className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] ${c50}`}>{tier}</span>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                            <ColorSwatchInput value={data.magicItemRarityColors?.[tier] ?? DEFAULT_RARITY_HEX[tier]} title={`${tier} card color`}
                              onChange={v => onUpdate({ magicItemRarityColors: { ...data.magicItemRarityColors, [tier]: v } })} />
                            <span className={`text-[8px] ${c30}`}>Card</span>
                          </label>
                          <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                            <ColorSwatchInput value={data.magicItemRaritySliderColors?.[tier] ?? data.magicItemRarityColors?.[tier] ?? DEFAULT_RARITY_HEX[tier]} title={`${tier} tracking slider color`}
                              onChange={v => onUpdate({ magicItemRaritySliderColors: { ...data.magicItemRaritySliderColors, [tier]: v } })} />
                            <span className={`text-[8px] ${c30}`}>Slider</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* One row per Feature Stylings category */}
              {STYLING_CATEGORIES.filter(cat => (cat !== "invocation" || isWarlock) && (cat !== "infusion" || isArtificer)).map(cat => {
                const style       = data.favoriteCategoryStyle?.[cat] ?? "none"
                const sliderStyle = data.favoriteCategorySliderStyle?.[cat] ?? style
                const color       = data.favoriteCategoryColors?.[cat] ?? DEFAULT_ACCENT_COLOR
                const sliderColor = data.favoriteCategorySliderColors?.[cat] ?? DEFAULT_ACCENT_COLOR
                const perClass    = cat === "class" && (data.classFeatureColorsByClass ?? false)
                return (
                  <div key={cat} className="flex flex-col gap-1 px-1 py-1.5 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${c70} shrink-0`}>{FAVORITE_CATEGORY_LABELS[cat]}</span>
                      {!perClass && (
                        <div className="flex items-center gap-2.5 shrink-0">
                          <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                            <ColorSwatchInput value={color} title="Card color"
                              onChange={v => onUpdate({ favoriteCategoryColors: { ...data.favoriteCategoryColors, [cat]: v } })} />
                            <span className={`text-[8px] ${c30}`}>Card</span>
                          </label>
                          <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                            <ColorSwatchInput value={sliderColor} title="Tracking slider color"
                              onChange={v => onUpdate({ favoriteCategorySliderColors: { ...data.favoriteCategorySliderColors, [cat]: v } })} />
                            <span className={`text-[8px] ${c30}`}>Slider</span>
                          </label>
                        </div>
                      )}
                    </div>
                
                    <StyleToggle label="Background" value={style}
                      onChange={s => onUpdate({ favoriteCategoryStyle: { ...data.favoriteCategoryStyle, [cat]: s } })} dark={dark} />
                    <StyleToggle label="Tracking Slider" value={sliderStyle}
                      onChange={s => onUpdate({ favoriteCategorySliderStyle: { ...data.favoriteCategorySliderStyle, [cat]: s } })} slider dark={dark} />
                      {cat === "class" && (
                      <label className={`flex items-center gap-2 text-[11px] ${c50} cursor-pointer select-none pl-2`}>
                        <input type="checkbox" checked={data.classFeatureColorsByClass ?? false}
                          onChange={e => onUpdate({ classFeatureColorsByClass: e.target.checked })}
                          className="accent-primary size-3.5 rounded" />
                        Separate by Class/Subclass
                      </label>
                    )}
                    {perClass && (
                      <div className="flex flex-col gap-1.5 pl-2 py-1">
                        <p className={`text-[10px] ${c30} pb-0.5`}>
                          One color per Source written on a Class Feature.
                        </p>
                        {classNames.map(key => (
                          <div key={key} className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] ${c50}`}>{classLabel(key)}</span>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                                <ColorSwatchInput value={data.classFeatureColors?.[key] ?? DEFAULT_ACCENT_COLOR} title={`${classLabel(key)} card color`}
                                  onChange={v => onUpdate({ classFeatureColors: { ...data.classFeatureColors, [key]: v } })} />
                                <span className={`text-[8px] ${c30}`}>Card</span>
                              </label>
                              <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                                <ColorSwatchInput value={data.classFeatureSliderColors?.[key] ?? data.classFeatureColors?.[key] ?? DEFAULT_ACCENT_COLOR} title={`${classLabel(key)} tracking slider color`}
                                  onChange={v => onUpdate({ classFeatureSliderColors: { ...data.classFeatureSliderColors, [key]: v } })} />
                                <span className={`text-[8px] ${c30}`}>Slider</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </Modal>
  )
}
