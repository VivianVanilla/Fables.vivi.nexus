import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { DndContext, DragOverlay, closestCenter, pointerWithin, useDraggable, type DragEndEvent, type CollisionDetection } from "@dnd-kit/core"
import { DropZone, DragOverlayCard, useDragSensors } from "@/components/shared/SortableItem"
import { Store, Eye, ImageIcon, Settings2, ChevronDown, ChevronUp, Pencil, Plus, Check } from "lucide-react"
import type { SidebarObject } from "@/components/shell/sidebar-utils"
import { safeParseJson, computeAc, nanoid } from "@/components/shared/utils"
import type { Feature } from "@/components/shared/types"
import { SAVE_TO_ABILITY, ALL_CONDITIONS, MAP_PARTY_CODES, DEFAULT_ACCENT_COLOR, type CardStyle } from "@/components/shared/constants"
import { CharacterSheet } from "@/components/character/CharacterSheet"
import { FeatureSuggestionPickerModal } from "@/components/character/tabs/InfoTab"
import { FeatureEntry, itemPatchFromSuggestion, getSuggestions, categoryAccentStyle, type Suggestion } from "@/components/character/entries/FeatureEntry"
import { DamagePills } from "@/components/character/ui/DamageFields"
import { computeWeaponDamageSegments } from "@/components/shared/damageTypes"
import { THEMES, DEFAULT_THEME } from "@/components/shared/themes"
import { FloatingPanel } from "@/components/shared/ui/FloatingPanel"
import { Modal } from "@/components/shared/ui/Modal"
import { StyleToggle } from "@/components/shared/ui/StyleToggle"
import { ColorSwatchInput } from "@/components/shared/ui/ColorSwatchInput"
import { PartyServer } from "@/components/party/PartyServer"
import { usePartyLatestMessageAt, isPartyUnread } from "@/components/party/unread"
import { InitiativeTracker } from "./InitiativeTracker"
import { useUserContext } from "../../../src/contexts/UserContext"
import { usePopoverPosition, useClickOutside } from "@/components/shared/usePortalMenu"
import { useChannelSuffix } from "@/components/party/partyTypes"
import { supabase } from "../../../src/supabase"
import { type CoinKey, type CurrencyMode, CP_VALUE, orderFor, calcSpend, formatPrice, DEFAULT_NAMES } from "@/components/shared/currencyMath"
import { type Shop, type ShopSection, type ShopPurchaseRecord, resolveShops, resolveItemColor, shopCardStyle, groupItemsBySection } from "@/components/shops/shopTypes"
import { ShopPlayerPreview } from "@/components/shops/ShopPlayerPreview"
import { WalletChips } from "@/components/shared/ui/WalletChips"
import { PortraitModal } from "@/components/shared/PortraitModal"
import { loadUserImages, uploadUserImage, type GalleryImage } from "@/components/shared/imageGallery"

interface DmDeathSaves {
  successes: number
  failures: number
}

interface CampaignData {
  partyCode?: string
  description?: string
  rosterFields?: Partial<Record<RosterFieldKey, boolean>>  
  dmDeathSaves?: Record<string, DmDeathSaves>
  // "High Pressure Mode" — a one-off feature for the MAP_PARTY_CODES campaigns
  highPressureModeActive?: boolean
  highPressureDots?: Record<string, number>
  // The Inventory tab is opt-in per campaign, off by default — toggled from
  // the Party Members header in Overview. GA as of the sub-stash rework
  // below (used to be hardcoded to MAP_PARTY_CODES campaigns only).
  inventoryEnabled?: boolean
  // Named stash containers for the Inventory tab (see the InventoryStash
  // component) — lets a DM sort loot into groups ("Shop", "Vault", "Quest
  // Rewards") instead of one flat pile. Real Feature-shaped items, same as
  // CharData.items — a "give" moves an entry out of a stash onto a player's
  // actual character sheet, not a copy of it. `dmStash` is the old
  // single-stash shape from before sub-stashes existed; resolveStashes()
  // below reads it as a fallback (migrated to a stash named "Stash") for
  // campaigns that used the tab before this, but every write from here on
  // goes through `stashes`.
  dmStash?: Feature[]
  stashes?: ItemStash[]
  // Campaign Settings (see CampaignSettingsModal) — cosmetic only, no
  // mechanical effect. `backgroundColor` overrides CampaignView's own
  // bg-card; unset keeps the normal theme-driven background. `stashStyle`/
  // `stashAccentColor` apply to every InventoryStash card the same way a
  // Feature Styling category color applies to its cards on the character
  // sheet (same categoryAccentStyle helper, see FeatureEntry.tsx).
  backgroundColor?: string
  stashStyle?: CardStyle
  stashAccentColor?: string
  rosterCardStyle?: CardStyle
  rosterCardAccentColor?: string
  // The Shops tab — cousin feature to the Inventory tab above, same opt-in
  // pattern. A Shop's `items` are real Features (full stats), priced via
  // their own `value` (gp) and stocked via `amount`/`trackAmount` — no
  // separate price/quantity fields, reusing exactly what Items tab items
  // already carry. `currentShopId` is which shop (if any) party members
  // currently see in their own Shop panel; `shopHistory` is campaign-wide
  // (not per-shop) so a completed sale survives that shop being deleted.
  shopsEnabled?: boolean
  shops?: Shop[]
  currentShopId?: string | null
  shopHistory?: ShopPurchaseRecord[]
}

interface ItemStash {
  id: string
  name: string
  items: Feature[]
}

// Migration shim for campaigns that used the Inventory tab before
// sub-stashes existed — treats an old flat `dmStash` as one stash named
// "Stash". Read-only; every mutator in useCampaignRoster always writes
// `stashes`, so the first write after this lands migrates it for good.
function resolveStashes(data: CampaignData): ItemStash[] {
  if (data.stashes) return data.stashes
  if (data.dmStash?.length) return [{ id: "stash:legacy", name: "Stash", items: data.dmStash }]
  return []
}

interface CharData {
  race?: string
  class?: string
  level?: number
  hp?: number
  maxHp?: number
  portrait?: string
  ac?: number
  acAbility?: "str" | "dex" | "con" | "int" | "wis" | "cha"
  acAbility2?: "str" | "dex" | "con" | "int" | "wis" | "cha"
  acMiscBonus?: number
  items?: Feature[]
  allowDmItemChanges?: boolean  // Settings (character-side) — default true. Off = the Inventory tab's column for this character is locked (🔒), see InventoryColumn/moveItem below.
  speed?: number
  wisdom?: number
  intelligence?: number
  dexterity?: number
  strength?: number
  charisma?: number
  constitution?: number
  skillProfs?: Record<string, "half" | "prof" | "exp">
  skillBonuses?: Record<string, number>
  conditions?: Array<{ id: string; name: string }>
  partyCode?: string
  spellcastingAbility?: string
  spellSaveDCBonus?: number
  initiativeStat?: string
  initiativeBonus?: number
  hitDicePools?: Array<{ id: string; dieType: string; total: number; used: number }>
  // Gold panel (Shops tab) reads/sets these exactly like CurrencyTracker.tsx
  // does on the character sheet itself — same shape, same fields.
  currency?: Partial<Record<CoinKey, number>>
  currencyMode?: CurrencyMode
  currencyNames?: string[]
}

interface Props {
  campaign: SidebarObject
}

function profBonus(level: number) {
  return Math.ceil(level / 4) + 1
}

function abilityMod(score: number) {
  return Math.floor((score - 10) / 2)
}

function signed(n: number) {
  return n >= 0 ? `+${n}` : `${n}`
}

function passiveStat(baseScore: number, skillName: string, level: number, skillProfs?: Record<string, "half" | "prof" | "exp">, skillBonuses?: Record<string, number>) {
  const base = abilityMod(baseScore)
  const pb   = profBonus(level)
  const prof = skillProfs?.[skillName]
  const profMod = prof === "exp" ? pb * 2 : prof === "prof" ? pb : prof === "half" ? Math.floor(pb / 2) : 0
  const bonus = skillBonuses?.[skillName] ?? 0
  return 10 + base + profMod + bonus
}

// Mirrors SpellcastingModal.tsx's own formula exactly (8 + PB + ability mod +
// spellSaveDCBonus) so the roster preview never disagrees with the real sheet.
function spellSaveDC(charData: CharData, level: number): number | null {
  if (!charData.spellcastingAbility) return null
  const abilityKey = SAVE_TO_ABILITY[charData.spellcastingAbility.toLowerCase()]
  const score = abilityKey ? (charData[abilityKey as keyof CharData] as number | undefined) ?? 10 : 10
  return 8 + profBonus(level) + abilityMod(score) + (charData.spellSaveDCBonus ?? 0)
}

function initiativeMod(charData: CharData): number {
  const key = charData.initiativeStat ?? "dex"
  const abilityKey = SAVE_TO_ABILITY[key] ?? "dexterity"
  const score = (charData[abilityKey as keyof CharData] as number | undefined) ?? 10
  return abilityMod(score) + (charData.initiativeBonus ?? 0)
}

// ── Roster preview field customization ───────────────────────────────────────

// "conditions" isn't a StatCell — it renders as its own pill row (and is
// where the DM's add/remove condition control lives) — but it still goes
// through the same on/off settings menu as everything else here.
type RosterFieldKey = "ac" | "speed" | "passivePerception" | "saveDC" | "initiative" | "hitDice" | "conditions"

const ROSTER_FIELDS: { key: RosterFieldKey; label: string; shortLabel: string; default: boolean }[] = [
  { key: "ac",                label: "Armor Class",       shortLabel: "AC",    default: true },
  { key: "speed",              label: "Speed",              shortLabel: "Speed", default: true },
  { key: "passivePerception",  label: "Passive Perception", shortLabel: "Perception",  default: true },
  { key: "saveDC",             label: "Spell Save DC",      shortLabel: "DC",    default: true },
  { key: "hitDice",            label: "Hit Dice",           shortLabel: "HD",    default: true },
  { key: "initiative",         label: "Initiative",         shortLabel: "Init",  default: false },
  { key: "conditions",         label: "Current Conditions", shortLabel: "",      default: true },
]

// The subset of ROSTER_FIELDS that render as a StatCell in the stat row —
// "conditions" has its own row further down instead.
const STAT_CELL_FIELDS = ROSTER_FIELDS.filter(
  (f): f is typeof ROSTER_FIELDS[number] & { key: Exclude<RosterFieldKey, "conditions"> } => f.key !== "conditions"
)

function isRosterFieldOn(rosterFields: CampaignData["rosterFields"], key: RosterFieldKey): boolean {
  return rosterFields?.[key] ?? ROSTER_FIELDS.find(f => f.key === key)!.default
}

function hitDiceValue(charData: CharData): string {
  const pools = charData.hitDicePools ?? []
  if (pools.length === 0) return "—"
  return pools.map(p => `${Math.max(0, p.total - p.used)}/${p.total}${p.dieType}`).join(", ")
}

function rosterFieldValue(key: Exclude<RosterFieldKey, "conditions">, charData: CharData, level: number): string {
  switch (key) {
    case "ac": return String(computeAc(charData).total)
    case "speed": return charData.speed != null ? `${charData.speed}ft` : "—"
    case "passivePerception": return String(passiveStat(charData.wisdom ?? 10, "Perception", level, charData.skillProfs, charData.skillBonuses))
    case "saveDC": { const dc = spellSaveDC(charData, level); return dc != null ? String(dc) : "—" }
    case "initiative": return signed(initiativeMod(charData))
    case "hitDice": return hitDiceValue(charData)
  }
}

// Settings popover — same portaled-dropdown pattern used elsewhere (LinkMenu
// in InfoTab.tsx, MarkdownExportMenu in monster.tsx) so it isn't clipped by
// this panel's own scroll container.
function RosterFieldsMenu({ rosterFields, onChange }: { rosterFields: CampaignData["rosterFields"]; onChange: (next: CampaignData["rosterFields"]) => void }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  function toggle(key: RosterFieldKey) {
    onChange({ ...rosterFields, [key]: !isRosterFieldOn(rosterFields, key) })
  }

  return (
    <div className="relative shrink-0">
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)} title="Choose what shows on each party member's card"
        className="text-foreground/40 hover:text-foreground text-xs size-6 flex items-center justify-center rounded-md hover:bg-foreground/10 transition-colors">
        ⚙
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl overflow-hidden w-56 p-2 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
          <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold px-2 pt-1 pb-1.5">Show on party cards</p>
          {ROSTER_FIELDS.map(f => (
            <label key={f.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5 text-xs text-foreground/70 cursor-pointer select-none">
              <input type="checkbox" checked={isRosterFieldOn(rosterFields, f.key)} onChange={() => toggle(f.key)} />
              {f.label}
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// DM-only activity leaderboard — how much each party member has
// contributed to the shared map (pins dropped, NPC detail notes written).
// Gated to a single DM email rather than a general "isDM" check since this
// is a one-off ask for one campaign's DM, not a feature meant to surface for
// every DM using the app.
const ACTIVITY_STATS_EMAIL = "loganadsit@gmail.com"

function tallyByOwner(rows: { owner_id: string }[] | null): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows ?? []) counts[row.owner_id] = (counts[row.owner_id] ?? 0) + 1
  return counts
}

function usePartyActivityStats(partyCode: string) {
  const [pingCounts, setPingCounts] = useState<Record<string, number>>({})
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({})
  const [npcsAddedCounts, setNpcsAddedCounts] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!partyCode) { setPingCounts({}); setNoteCounts({}); setNpcsAddedCounts({}); setLoaded(true); return }
    let cancelled = false
    setLoaded(false)
    Promise.all([
      supabase.from("map_pins").select("owner_id").eq("party_code", partyCode),
      supabase.from("map_pin_notes").select("owner_id").eq("party_code", partyCode).not("npc_id", "is", null),
      supabase.from("npc_trackers").select("owner_id").eq("party_code", partyCode),
    ]).then(([pinsRes, notesRes, npcsRes]) => {
      if (cancelled) return
      if (pinsRes.error) console.error("activity stats: pins load error:", pinsRes.error)
      if (notesRes.error) console.error("activity stats: notes load error:", notesRes.error)
      if (npcsRes.error) console.error("activity stats: npcs load error:", npcsRes.error)
      setPingCounts(tallyByOwner(pinsRes.data as { owner_id: string }[] | null))
      setNoteCounts(tallyByOwner(notesRes.data as { owner_id: string }[] | null))
      setNpcsAddedCounts(tallyByOwner(npcsRes.data as { owner_id: string }[] | null))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [partyCode])

  return { pingCounts, noteCounts, npcsAddedCounts, loaded }
}

// "Pings" = map pins dropped; "NPC notes" = Detail Notes written on the NPC
// Tracker shelf (map_pin_notes rows with npc_id set — including ones that
// live under a linked tracker's token_id, see useNpcTrackers.notesForNpc);
// "NPCs added" = new entries created on the NPC Tracker shelf itself.
// Always lists every current party member (plus the DM) even at zero
// activity — an owner_id only shows up in the count queries once they've
// actually done something, so a purely count-driven list would silently
// drop anyone who hasn't dropped a pin or written a note yet.
function PartyActivitySection({ partyCode, partyMembers, currentUserId, cardStyle }: {
  partyCode: string
  partyMembers: SidebarObject[]
  currentUserId: string
  cardStyle?: React.CSSProperties
}) {
  const { pingCounts, noteCounts, npcsAddedCounts, loaded } = usePartyActivityStats(partyCode)
  const knownOwnerIds = Array.from(new Set(partyMembers.map(c => c.owner_id).concat(currentUserId ? [currentUserId] : [])))
  const activeOwnerIds = Array.from(new Set([...Object.keys(pingCounts), ...Object.keys(noteCounts), ...Object.keys(npcsAddedCounts)]))
  const ownerIds = Array.from(new Set([...knownOwnerIds, ...activeOwnerIds]))
  const rows = ownerIds
    .map(ownerId => ({
      ownerId,
      name: ownerId === currentUserId ? "Dungeon Master" : partyMembers.find(c => c.owner_id === ownerId)?.name ?? "Unknown",
      pings: pingCounts[ownerId] ?? 0,
      npcNotes: noteCounts[ownerId] ?? 0,
      npcsAdded: npcsAddedCounts[ownerId] ?? 0,
    }))
    .sort((a, b) => (b.pings + b.npcNotes + b.npcsAdded) - (a.pings + a.npcNotes + a.npcsAdded) || a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">Party Activity</span>
      <div className="rounded-xl bg-muted ring-1 ring-border overflow-hidden" style={cardStyle}>
        {!loaded ? (
          <p className="text-xs text-foreground/30 italic text-center py-4">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-foreground/30 italic text-center py-4">No party members yet.</p>
        ) : (
          <div className="divide-y divide-foreground/5">
            {rows.map(row => (
              <div key={row.ownerId} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 min-w-0 text-xs font-semibold text-foreground truncate">{row.name}</span>
                <span className="text-[10px] text-foreground/50 tabular-nums">{row.pings} ping{row.pings !== 1 ? "s" : ""}</span>
                <span className="text-[10px] text-foreground/50 tabular-nums">{row.npcNotes} npc note{row.npcNotes !== 1 ? "s" : ""}</span>
                <span className="text-[10px] text-foreground/50 tabular-nums">{row.npcsAdded} npc{row.npcsAdded !== 1 ? "s" : ""} added</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type CampaignTab = "overview" | "initiative" | "inventory" | "shops" | "chat"

// Everything about a campaign's live roster — fetching, realtime sync, and
// the DM write-through actions (HP, conditions, kick) — factored out so both
// the full CampaignView (Overview tab) and CampaignRosterSidebar (the compact
// "characters only" dock, see below) can share one subscription instead of
// each opening their own when both happen to be open for the same campaign.
// useChannelSuffix keeps their realtime channel topics from colliding if
// that does happen (same pattern as usePartyLatestMessageAt).
function useCampaignRoster(campaign: SidebarObject) {
  const { updateSharedObject, updateObject } = useUserContext()
  const [partyMembers, setPartyMembers] = useState<SidebarObject[]>([])
  const [kickConfirmId, setKickConfirmId] = useState<string | null>(null)
  const [kicking, setKicking] = useState(false)
  const channelSuffix = useChannelSuffix()

  const campaignData = safeParseJson(campaign.data) as CampaignData
  const partyCode = campaignData.partyCode ?? ""

  // The DM owns their own campaign object, so a plain updateObject() write is
  // enough here — same reasoning as InitiativeTracker.tsx's encounter storage
  // on this same object (no cross-user RLS write-through needed, unlike the
  // party-member HP/kick writes below which touch someone else's character).
  function updateRosterFields(next: CampaignData["rosterFields"]) {
    updateObject(campaign.id, { data: { ...campaignData, rosterFields: next } as unknown as JSON }).catch(e => console.error(e))
  }

  // The DM's own death save tally, stored on the campaign object (see
  // CampaignData.dmDeathSaves) rather than the character — a deliberately
  // separate, DM-only count that never touches (or is visible from) what
  // the player rolls and tracks on their own sheet.
  function updateDmDeathSaves(characterId: string, next: DmDeathSaves) {
    const current = campaignData.dmDeathSaves ?? {}
    updateObject(campaign.id, { data: { ...campaignData, dmDeathSaves: { ...current, [characterId]: next } } as unknown as JSON }).catch(e => console.error(e))
  }

  // "High Pressure Mode" (MAP_PARTY_CODES campaigns only, see constants.ts) —
  // same storage shape as updateDmDeathSaves above, just a single 0-3 count
  // per character instead of a successes/failures pair.
  function toggleHighPressureMode() {
    updateObject(campaign.id, { data: { ...campaignData, highPressureModeActive: !campaignData.highPressureModeActive } as unknown as JSON }).catch(e => console.error(e))
  }
  function updateHighPressureDots(characterId: string, next: number) {
    const current = campaignData.highPressureDots ?? {}
    updateObject(campaign.id, { data: { ...campaignData, highPressureDots: { ...current, [characterId]: next } } as unknown as JSON }).catch(e => console.error(e))
  }

  // Inventory tab (opt-in, see CampaignData.inventoryEnabled and the toggle
  // in Overview) — stashes live on campaign.data (same storage pattern as
  // everything else in this hook), but a party member's items are their
  // REAL CharData.items, written through the same RLS-backed path as
  // updatePartyMemberHp/addConditionToMember above. A "give"/"take"/"trade"
  // drag in the tab below is just one or two of these calls — nothing here
  // decides which; see InventoryTab's moveItem.
  function toggleInventoryEnabled() {
    updateObject(campaign.id, { data: { ...campaignData, inventoryEnabled: !campaignData.inventoryEnabled } as unknown as JSON }).catch(e => console.error(e))
  }
  function addStash(name: string) {
    const stashes = resolveStashes(campaignData)
    const stash: ItemStash = { id: `stash:${nanoid()}`, name, items: [] }
    updateObject(campaign.id, { data: { ...campaignData, stashes: [...stashes, stash] } as unknown as JSON }).catch(e => console.error(e))
  }
  function renameStash(stashId: string, name: string) {
    const stashes = resolveStashes(campaignData)
    updateObject(campaign.id, { data: { ...campaignData, stashes: stashes.map(s => s.id === stashId ? { ...s, name } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  // Guarded here, not just by InventoryStash's disabled button — a stash's
  // items would otherwise vanish along with it with no undo, and a button
  // being disabled in the UI today is no guarantee some other caller won't
  // reach this function directly later.
  function deleteStash(stashId: string) {
    const stashes = resolveStashes(campaignData)
    const stash = stashes.find(s => s.id === stashId)
    if (!stash || stash.items.length > 0) return
    updateObject(campaign.id, { data: { ...campaignData, stashes: stashes.filter(s => s.id !== stashId) } as unknown as JSON }).catch(e => console.error(e))
  }
  // Campaign Settings — cosmetic, see CampaignData's own comment above.
  function updateBackgroundColor(color: string | undefined) {
    updateObject(campaign.id, { data: { ...campaignData, backgroundColor: color } as unknown as JSON }).catch(e => console.error(e))
  }
  function updateStashStyle(style: CardStyle) {
    updateObject(campaign.id, { data: { ...campaignData, stashStyle: style } as unknown as JSON }).catch(e => console.error(e))
  }
  function updateStashAccentColor(color: string) {
    updateObject(campaign.id, { data: { ...campaignData, stashAccentColor: color } as unknown as JSON }).catch(e => console.error(e))
  }
  function updateRosterCardStyle(style: CardStyle) {
    updateObject(campaign.id, { data: { ...campaignData, rosterCardStyle: style } as unknown as JSON }).catch(e => console.error(e))
  }
  function updateRosterCardAccentColor(color: string) {
    updateObject(campaign.id, { data: { ...campaignData, rosterCardAccentColor: color } as unknown as JSON }).catch(e => console.error(e))
  }
  function addToStash(stashId: string, items: Feature[]) {
    const stashes = resolveStashes(campaignData)
    updateObject(campaign.id, { data: { ...campaignData, stashes: stashes.map(s => s.id === stashId ? { ...s, items: [...s.items, ...items] } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  function removeFromStash(stashId: string, itemId: string) {
    const stashes = resolveStashes(campaignData)
    updateObject(campaign.id, { data: { ...campaignData, stashes: stashes.map(s => s.id === stashId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  // Moving an item between two stashes must be ONE write against the same
  // `stashes` array — see moveItem's comment in InventoryTab. Calling
  // removeFromStash then addToStash back-to-back races two updateObject
  // calls that each independently read this same `campaignData` snapshot,
  // and whichever one's write lands second overwrites the other's change,
  // voiding the item.
  function moveBetweenStashes(fromStashId: string, toStashId: string, item: Feature) {
    const stashes = resolveStashes(campaignData)
    const next = stashes.map(s => {
      if (s.id === fromStashId) return { ...s, items: s.items.filter(i => i.id !== item.id) }
      if (s.id === toStashId) return { ...s, items: [...s.items, item] }
      return s
    })
    updateObject(campaign.id, { data: { ...campaignData, stashes: next } as unknown as JSON }).catch(e => console.error(e))
  }
  function updateStashItem(stashId: string, item: Feature) {
    const stashes = resolveStashes(campaignData)
    updateObject(campaign.id, { data: { ...campaignData, stashes: stashes.map(s => s.id === stashId ? { ...s, items: s.items.map(i => i.id === item.id ? item : i) } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  async function setMemberItems(characterId: string, items: Feature[]) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    try {
      const updated = await updateSharedObject(characterId, { data: { ...charData, items } as unknown as JSON })
      setPartyMembers(prev => prev.map(c => c.id === characterId ? (updated as unknown as SidebarObject) : c))
    } catch (e) { console.error(e) }
  }

  // ── Shops tab (opt-in, cousin of the Inventory tab above) ─────────────────
  // Shops live on campaign.data exactly like stashes — same read-modify-write
  // pattern against `campaignData`. Party members write here too now (a buy
  // on an instant/no-confirmation shop, or a pending request on a
  // confirmation-required one) via the RLS policy added alongside this
  // feature — see ShopOverlay.tsx. Nothing here assumes it's the only writer.
  function toggleShopsEnabled() {
    updateObject(campaign.id, { data: { ...campaignData, shopsEnabled: !campaignData.shopsEnabled } as unknown as JSON }).catch(e => console.error(e))
  }
  function addShop(name: string) {
    const shops = resolveShops(campaignData.shops)
    const shop: Shop = { id: `shop:${nanoid()}`, name, items: [] }
    updateObject(campaign.id, { data: { ...campaignData, shops: [...shops, shop] } as unknown as JSON }).catch(e => console.error(e))
  }
  function renameShop(shopId: string, name: string) {
    const shops = resolveShops(campaignData.shops)
    updateObject(campaign.id, { data: { ...campaignData, shops: shops.map(s => s.id === shopId ? { ...s, name } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  // Guarded the same way deleteStash is — an occupied shop's items would
  // otherwise vanish with no undo.
  function deleteShop(shopId: string) {
    const shops = resolveShops(campaignData.shops)
    const shop = shops.find(s => s.id === shopId)
    if (!shop || shop.items.length > 0) return
    const nextCurrent = campaignData.currentShopId === shopId ? null : campaignData.currentShopId
    updateObject(campaign.id, { data: { ...campaignData, shops: shops.filter(s => s.id !== shopId), currentShopId: nextCurrent } as unknown as JSON }).catch(e => console.error(e))
  }
  // Covers accentColor/cardStyle/portraitUrl/requireConfirmation — one
  // generic patcher instead of four near-identical setters, since (unlike
  // the stash styling in CampaignSettingsModal) these are per-shop, not
  // campaign-wide singletons.
  function updateShopSettings(shopId: string, patch: Partial<Shop>) {
    const shops = resolveShops(campaignData.shops)
    updateObject(campaign.id, { data: { ...campaignData, shops: shops.map(s => s.id === shopId ? { ...s, ...patch } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  // Only one shop is ever "current" (what players see) — null clears it
  // (e.g. the DM closing up shop), same toggle either way.
  function setCurrentShop(shopId: string | null) {
    updateObject(campaign.id, { data: { ...campaignData, currentShopId: shopId } as unknown as JSON }).catch(e => console.error(e))
  }
  function addItemsToShop(shopId: string, items: Feature[]) {
    const shops = resolveShops(campaignData.shops)
    updateObject(campaign.id, { data: { ...campaignData, shops: shops.map(s => s.id === shopId ? { ...s, items: [...s.items, ...items] } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  function removeItemFromShop(shopId: string, itemId: string) {
    const shops = resolveShops(campaignData.shops)
    updateObject(campaign.id, { data: { ...campaignData, shops: shops.map(s => s.id === shopId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  function updateShopItem(shopId: string, item: Feature) {
    const shops = resolveShops(campaignData.shops)
    updateObject(campaign.id, { data: { ...campaignData, shops: shops.map(s => s.id === shopId ? { ...s, items: s.items.map(i => i.id === item.id ? item : i) } : s) } as unknown as JSON }).catch(e => console.error(e))
  }
  function denyShopRequest(shopId: string, requestId: string) {
    const shops = resolveShops(campaignData.shops)
    updateObject(campaign.id, {
      data: {
        ...campaignData,
        shops: shops.map(s => s.id === shopId ? { ...s, pendingRequests: (s.pendingRequests ?? []).filter(r => r.id !== requestId) } : s),
      } as unknown as JSON,
    }).catch(e => console.error(e))
  }
  // The two writes a completed sale needs — same split as an instant
  // purchase (see ShopOverlay.tsx), just triggered by the DM's Approve
  // instead of the buyer's own client: this campaign row (stock + history +
  // clear the request) via the DM's own owned write, and the buyer's row
  // (gold + inventory) via the DM→player write-through already proven by
  // updatePartyMemberHp etc. Re-checks affordability at approval time (the
  // buyer may have spent elsewhere while this sat pending) rather than
  // trusting the snapshot taken when the request was made — if they can no
  // longer afford it, this is a no-op (left pending) rather than silently
  // corrupting either side's data.
  async function approveShopRequest(shopId: string, requestId: string) {
    const shops = resolveShops(campaignData.shops)
    const shop = shops.find(s => s.id === shopId)
    const request = shop?.pendingRequests?.find(r => r.id === requestId)
    const item = shop?.items.find(i => i.id === request?.itemId)
    const buyer = partyMembers.find(m => m.id === request?.characterId)
    if (!shop || !request || !item || !buyer) return

    const buyerData = safeParseJson(buyer.data) as CharData
    const mode = buyerData.currencyMode ?? "classic"
    const unit = request.priceUnit ?? "gp"
    const spend = calcSpend(buyerData.currency ?? {}, request.price * CP_VALUE[unit], orderFor(mode))
    if (!spend.canAfford) { console.warn("Shop purchase approval: buyer can no longer afford it — left pending."); return }
    const nextCoins = { ...(buyerData.currency ?? {}) }
    for (const [k, v] of Object.entries(spend.spent) as [CoinKey, number][]) nextCoins[k] = (nextCoins[k] ?? 0) - v
    for (const [k, v] of Object.entries(spend.change) as [CoinKey, number][]) nextCoins[k] = (nextCoins[k] ?? 0) + v

    const stockTracked = item.trackAmount || item.amount != null
    const nextItemAmount = stockTracked ? Math.max(0, (item.amount ?? 0) - request.quantity) : item.amount

    const record: ShopPurchaseRecord = {
      id: nanoid(), shopId, shopName: shop.name, characterId: buyer.id, characterName: buyer.name,
      itemLabel: request.itemLabel, price: request.price, priceUnit: unit, quantity: request.quantity, at: new Date().toISOString(),
    }
    try {
      const updatedBuyer = await updateSharedObject(buyer.id, {
        data: { ...buyerData, currency: nextCoins, items: [...(buyerData.items ?? []), { ...item, id: nanoid(), amount: request.quantity, shopHidden: undefined, shopDisplayName: undefined }] } as unknown as JSON,
      })
      setPartyMembers(prev => prev.map(c => c.id === buyer.id ? (updatedBuyer as unknown as SidebarObject) : c))
      await updateObject(campaign.id, {
        data: {
          ...campaignData,
          shops: shops.map(s => s.id === shopId ? {
            ...s,
            items: s.items.map(i => i.id === item.id ? { ...i, amount: nextItemAmount } : i),
            pendingRequests: (s.pendingRequests ?? []).filter(r => r.id !== requestId),
          } : s),
          shopHistory: [...(campaignData.shopHistory ?? []), record],
        } as unknown as JSON,
      })
    } catch (e) { console.error(e) }
  }
  // Gold panel — sets the same three fields CurrencyTracker.tsx's own wallet
  // settings modal does, just applied to every current party member at once
  // instead of one character editing their own. Best-effort per member (one
  // failing write shouldn't block the rest).
  async function applyWalletSettingsToAll(mode: CurrencyMode, names: string[]) {
    await Promise.all(partyMembers.map(async m => {
      const d = safeParseJson(m.data) as CharData
      try {
        const updated = await updateSharedObject(m.id, { data: { ...d, currencyMode: mode, currencyNames: names } as unknown as JSON })
        setPartyMembers(prev => prev.map(c => c.id === m.id ? (updated as unknown as SidebarObject) : c))
      } catch (e) { console.error(e) }
    }))
  }

  // Polls every 20s as a safety net on top of the realtime subscription below —
  // if postgres_changes ever misses an event (dropped connection, a realtime
  // config gap on the `objects` table, etc.) the roster still catches up on
  // its own within a few seconds instead of staying stale until someone
  // happens to reload the whole page.
  useEffect(() => {
    if (!partyCode) return
    let cancelled = false
    function fetchRoster() {
      supabase
        .from("objects")
        .select("*")
        .eq("type", "character")
        .filter("data->>partyCode", "eq", partyCode)
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) { console.error("party fetch error:", error); return }
          setPartyMembers((data ?? []) as SidebarObject[])
        })
    }
    fetchRoster()
    const interval = setInterval(fetchRoster, 20000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [partyCode])

  // Keeps the roster live without a page refresh: a player's own edits (HP,
  // AC, conditions, leaving the party — anything on their character sheet)
  // land here the moment they save, instead of only after the DM re-opens
  // the campaign. `objects` has no partyCode column to filter on server-side
  // (it's nested in `data`), so this subscribes broadly to character-row
  // changes and checks data.partyCode client-side once the payload arrives —
  // same trade-off usePartyLatestMessageAt makes for messages.
  useEffect(() => {
    if (!partyCode) return
    const ch = supabase
      .channel(`campaign-roster:${partyCode}:${channelSuffix}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "objects", filter: "type=eq.character",
      }, payload => {
        const row = payload.new as SidebarObject
        const pc = (safeParseJson(row.data) as CharData).partyCode
        setPartyMembers(prev => {
          const wasMember = prev.some(c => c.id === row.id)
          if (pc === partyCode) return wasMember ? prev.map(c => c.id === row.id ? row : c) : [...prev, row]
          // Left this party (partyCode cleared/switched) — drop them. But a
          // position/parent-only update (a sidebar reorder) can arrive with
          // `data` absent from the payload; treating that as "left" is what
          // briefly booted a character from the roster mid-reorder, so only
          // act when partyCode is actually present.
          if (typeof pc === "string" && wasMember) return prev.filter(c => c.id !== row.id)
          return prev
        })
      })
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "objects", filter: "type=eq.character",
      }, payload => {
        const row = payload.new as SidebarObject
        const rowData = safeParseJson(row.data) as CharData
        if (rowData.partyCode !== partyCode) return
        setPartyMembers(prev => prev.some(c => c.id === row.id) ? prev : [...prev, row])
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "objects", filter: "type=eq.character",
      }, payload => {
        const old = payload.old as Partial<SidebarObject>
        if (old?.id) setPartyMembers(prev => prev.filter(c => c.id !== old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partyCode, channelSuffix])

  // DM editing a PC's HP straight from the Initiative tracker — writes through
  // to the player's real character sheet. Needs an RLS policy on `objects`
  // permitting a DM to UPDATE a party member's character row (same caveat as
  // note collaborators — see updateSharedObject's comment in UserContext.tsx).
  async function updatePartyMemberHp(characterId: string, hp: number) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    try {
      const updated = await updateSharedObject(characterId, { data: { ...charData, hp } as unknown as JSON })
      setPartyMembers(prev => prev.map(c => c.id === characterId ? (updated as unknown as SidebarObject) : c))
    } catch (e) { console.error(e) }
  }

  // DM applying/clearing a condition on a player's character — same
  // write-through path as updatePartyMemberHp above.
  async function addConditionToMember(characterId: string, name: string) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    const conditions = charData.conditions ?? []
    if (conditions.some(c => c.name === name)) return
    try {
      const updated = await updateSharedObject(characterId, { data: { ...charData, conditions: [...conditions, { id: nanoid(), name }] } as unknown as JSON })
      setPartyMembers(prev => prev.map(c => c.id === characterId ? (updated as unknown as SidebarObject) : c))
    } catch (e) { console.error(e) }
  }
  async function removeConditionFromMember(characterId: string, conditionId: string) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    const conditions = (charData.conditions ?? []).filter(c => c.id !== conditionId)
    try {
      const updated = await updateSharedObject(characterId, { data: { ...charData, conditions } as unknown as JSON })
      setPartyMembers(prev => prev.map(c => c.id === characterId ? (updated as unknown as SidebarObject) : c))
    } catch (e) { console.error(e) }
  }

  // Kicking just clears the party code on the player's own character — same
  // as if they'd left voluntarily from their Info tab. Uses the same
  // DM-write-through path (and RLS policy) as updatePartyMemberHp above.
  async function kickMember(characterId: string) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    setKicking(true)
    try {
      await updateSharedObject(characterId, { data: { ...charData, partyCode: "" } as unknown as JSON })
      setPartyMembers(prev => prev.filter(c => c.id !== characterId))
    } catch (e) {
      console.error("kick failed:", e)
    } finally {
      setKicking(false)
      setKickConfirmId(null)
    }
  }

  return {
    campaignData, partyCode, partyMembers, kickConfirmId, setKickConfirmId, kicking,
    updateRosterFields, updateDmDeathSaves, updatePartyMemberHp, addConditionToMember, removeConditionFromMember, kickMember,
    toggleHighPressureMode, updateHighPressureDots,
    toggleInventoryEnabled, addStash, renameStash, deleteStash,
    updateBackgroundColor, updateStashStyle, updateStashAccentColor,
    updateRosterCardStyle, updateRosterCardAccentColor,
    addToStash, removeFromStash, moveBetweenStashes, updateStashItem, setMemberItems,
    toggleShopsEnabled, addShop, renameShop, deleteShop, updateShopSettings, setCurrentShop,
    addItemsToShop, removeItemFromShop, updateShopItem, approveShopRequest, denyShopRequest,
    applyWalletSettingsToAll,
  }
}

export function CampaignView({ campaign }: Props) {
  const { user } = useUserContext()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<CampaignTab>("overview")
  const [showSettings, setShowSettings] = useState(false)
  // Items picked/created from the Inventory tab's top-level "+" buttons,
  // waiting to be dragged onto a stash or player — see the floating cluster
  // in the Inventory tab render below. Lifted up here (not local to
  // InventoryTab) so switching to another tab and back doesn't lose them;
  // still lost on an actual page reload, same as any other in-progress,
  // not-yet-saved-anywhere draft.
  const [floatingItems, setFloatingItems] = useState<Feature[]>([])
  const {
    campaignData, partyCode, partyMembers, kickConfirmId, setKickConfirmId, kicking,
    updateRosterFields, updateDmDeathSaves, updatePartyMemberHp, addConditionToMember, removeConditionFromMember, kickMember,
    toggleHighPressureMode, updateHighPressureDots,
    toggleInventoryEnabled, addStash, renameStash, deleteStash,
    updateBackgroundColor, updateStashStyle, updateStashAccentColor,
    updateRosterCardStyle, updateRosterCardAccentColor,
    addToStash, removeFromStash, moveBetweenStashes, updateStashItem, setMemberItems,
    toggleShopsEnabled, addShop, renameShop, deleteShop, updateShopSettings, setCurrentShop,
    addItemsToShop, removeItemFromShop, updateShopItem, approveShopRequest, denyShopRequest,
    applyWalletSettingsToAll,
  } = useCampaignRoster(campaign)

  const stashes = resolveStashes(campaignData)
  const shops = resolveShops(campaignData.shops)
  const rosterCardStyle = categoryAccentStyle(campaignData.rosterCardAccentColor, campaignData.rosterCardStyle)
  // Campaign Settings' background color — applied uniformly to the header,
  // tabs bar, and every plain card in Overview (Party Code, the "no
  // characters" placeholder, Party Activity), not just the root behind
  // them, so picking a background actually recolors the whole view instead
  // of only the strip of it those opaque bg-card/bg-muted surfaces don't
  // cover. Player roster cards and stash shelves keep their own separate
  // style controls (Settings' Party Card / Stash Appearance) rather than
  // picking this up too.
  const customBgStyle = campaignData.backgroundColor ? { backgroundColor: campaignData.backgroundColor } : undefined

  // Inventory and Shops are both opt-in per campaign (GA — any campaign can
  // turn them on, not just MAP_PARTY_CODES) via the toggles in Overview/Campaign Settings.
  const tabs: CampaignTab[] = [
    "overview", "initiative",
    ...(campaignData.inventoryEnabled ? (["inventory"] as const) : []),
    ...(campaignData.shopsEnabled ? (["shops"] as const) : []),
    "chat",
  ]

  // If a DM turns a setting off while sitting on that tab, there'd be no
  // button left to get back to it — bounce to Overview instead of leaving
  // it stranded.
  useEffect(() => {
    if (activeTab === "inventory" && !campaignData.inventoryEnabled) setActiveTab("overview")
    if (activeTab === "shops" && !campaignData.shopsEnabled) setActiveTab("overview")
  }, [activeTab, campaignData.inventoryEnabled, campaignData.shopsEnabled])

  const enabledStatCells = STAT_CELL_FIELDS.filter(f => isRosterFieldOn(campaignData.rosterFields, f.key))
  const showConditions = isRosterFieldOn(campaignData.rosterFields, "conditions")

  const chatLatestMessageAt = usePartyLatestMessageAt(partyCode, user?.id ?? "")
  // Never show the dot while the Chat tab is the one you're looking at — it's
  // definitionally seen. Without this, the dot could linger after opening
  // Chat until some unrelated re-render happened to re-read the "seen"
  // timestamp PartyServer had already written to localStorage.
  const chatUnread = !!partyCode && !!user?.id && activeTab !== "chat" && isPartyUnread(user.id, partyCode, chatLatestMessageAt)

  function copyCode() {
    if (partyCode) navigator.clipboard.writeText(partyCode).catch(() => {})
  }

  if (expandedId) {
    const char = partyMembers.find(c => c.id === expandedId)
    if (char) {
      return (
        <div className="flex flex-col h-full min-h-0">
          <button
            type="button"
            onClick={() => setExpandedId(null)}
            className="flex items-center gap-2 px-4 py-2.5 border-b border-foreground/10 text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-foreground/5 shrink-0 bg-card transition-colors text-left w-full"
          >
            <span className="text-base leading-none">←</span>
            <span>{campaign.name}</span>
          </button>
          <div className="flex-1 min-h-0">
            <CharacterSheet character={char} readOnly={true} />
          </div>
        </div>
      )
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 text-foreground bg-card rounded-xl overflow-hidden"
      style={customBgStyle}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/10 bg-card shrink-0" style={customBgStyle}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tracking-wide truncate">{campaign.name}</p>
          <p className="text-[10px] text-foreground/40 uppercase tracking-widest">Campaign · DM</p>
        </div>
        <button type="button" onClick={() => setShowSettings(true)} title="Campaign Settings"
          className="text-foreground/40 hover:text-foreground text-sm p-1 flex items-center justify-center rounded-md hover:bg-foreground/10 transition-colors ">
          Settings
        </button>
      </div>

      {showSettings && (
        <CampaignSettingsModal
          campaignData={campaignData}
          onToggleInventory={toggleInventoryEnabled}
          onToggleShops={toggleShopsEnabled}
          onChangeBackground={updateBackgroundColor}
          onChangeStashStyle={updateStashStyle}
          onChangeStashAccentColor={updateStashAccentColor}
          onChangeRosterCardStyle={updateRosterCardStyle}
          onChangeRosterCardAccentColor={updateRosterCardAccentColor}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-foreground/10 bg-card shrink-0" style={customBgStyle}>
        {tabs.map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-1.5 text-xs uppercase tracking-widest rounded-full font-semibold transition-colors ${activeTab === tab ? "bg-foreground/20 text-foreground" : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/5"}`}>
            {tab === "overview" ? "Overview" : tab === "initiative" ? "Initiative" : tab === "inventory" ? "Inventory" : tab === "shops" ? "Shops" : "Party Chat"}
            {tab === "chat" && chatUnread && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>

      {/* Initiative tracker */}
      {activeTab === "initiative" && (
        <InitiativeTracker campaign={campaign} partyMembers={partyMembers} onUpdateCharacterHp={updatePartyMemberHp} />
      )}

      {/* Inventory tab (opt-in, see the toggle in Overview) */}
      {activeTab === "inventory" && (
        <InventoryTab
          partyMembers={partyMembers}
          stashes={stashes}
          stashStyle={campaignData.stashStyle}
          stashAccentColor={campaignData.stashAccentColor}
          rosterCardStyle={rosterCardStyle}
          floatingItems={floatingItems}
          setFloatingItems={setFloatingItems}
          userId={user?.id}
          addStash={addStash}
          renameStash={renameStash}
          deleteStash={deleteStash}
          addToStash={addToStash}
          removeFromStash={removeFromStash}
          moveBetweenStashes={moveBetweenStashes}
          updateStashItem={updateStashItem}
          setMemberItems={setMemberItems}
        />
      )}

      {/* Shops tab (opt-in, cousin of Inventory above) */}
      {activeTab === "shops" && (
        <ShopsTab
          shops={shops}
          currentShopId={campaignData.currentShopId ?? null}
          shopHistory={campaignData.shopHistory ?? []}
          partyMembers={partyMembers}
          userId={user?.id}
          defaultAccentColor={campaignData.rosterCardAccentColor}
          rosterCardStyle={rosterCardStyle}
          addShop={addShop}
          renameShop={renameShop}
          deleteShop={deleteShop}
          updateShopSettings={updateShopSettings}
          setCurrentShop={setCurrentShop}
          addItemsToShop={addItemsToShop}
          removeItemFromShop={removeItemFromShop}
          updateShopItem={updateShopItem}
          approveShopRequest={approveShopRequest}
          denyShopRequest={denyShopRequest}
          applyWalletSettingsToAll={applyWalletSettingsToAll}
        />
      )}

      {/* Chat panel */}
      {activeTab === "chat" && partyCode && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <PartyServer
            partyCode={partyCode}
            currentUserId={user?.id ?? ""}
            currentUserName="Dungeon Master"
            isDM={true}
            campaign={campaign}
            partyMembers={partyMembers.map(c => ({ userId: c.owner_id, name: c.name, characterId: c.id }))}
          />
        </div>
      )}
      {activeTab === "chat" && !partyCode && (
        <div className="flex-1 flex items-center justify-center text-sm text-foreground/30 italic">
          No party code — re-create this campaign to enable chat.
        </div>
      )}

      {/* Overview body */}
      {activeTab === "overview" && <div className="flex flex-col gap-4 p-4 overflow-auto flex-1">

        {/* Party Code card */}
        <div className="rounded-xl bg-muted ring-1 ring-border p-4 flex flex-col gap-2" style={customBgStyle}>
          <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">Party Code</span>
          {partyCode ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono tracking-[0.3em] text-foreground select-all">{partyCode}</span>
              <button
                type="button"
                onClick={copyCode}
                className="text-[10px] px-2.5 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground transition-colors"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          ) : (
            <p className="text-xs text-foreground/30 italic">No party code — re-create this campaign to generate one.</p>
          )}
          <p className="text-[10px] text-foreground/40">Share this code with your players. They enter it in the <span className="text-foreground/60">Info</span> tab of their character sheet to link to this campaign.</p>
        </div>

        {/* Party members */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">
              Party Members
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-foreground/30">{partyMembers.length} character{partyMembers.length !== 1 ? "s" : ""}</span>
              {MAP_PARTY_CODES.includes(partyCode) && (
                <button type="button" onClick={toggleHighPressureMode}
                  title="Shows a 3-dot tracker on every character's card"
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                    campaignData.highPressureModeActive ? "bg-foreground text-background" : "bg-foreground/10 text-foreground/50 hover:text-foreground/80"
                  }`}>
                  High Pressure Mode
                </button>
              )}
              <RosterFieldsMenu rosterFields={campaignData.rosterFields} onChange={updateRosterFields} />
            </div>
          </div>

          {partyCode === "" && (
            <p className="text-xs text-foreground/30 italic text-center py-6">This campaign has no party code.</p>
          )}

          {partyCode !== "" && partyMembers.length === 0 && (
            <div className="rounded-xl bg-muted ring-1 ring-border p-4 text-center" style={customBgStyle}>
              <p className="text-xs text-foreground/40 italic">No characters have joined yet.</p>
              <p className="text-[10px] text-foreground/30 mt-1">Share the party code above with your players.</p>
            </div>
          )}

          {partyMembers.map(char => (
            <PartyMemberCard
              key={char.id}
              char={char}
              charData={safeParseJson(char.data) as CharData}
              enabledStatCells={enabledStatCells}
              showConditions={showConditions}
              kickConfirmId={kickConfirmId}
              kicking={kicking}
              dmDeathSaves={campaignData.dmDeathSaves?.[char.id] ?? { successes: 0, failures: 0 }}
              onChangeDmDeathSaves={next => updateDmDeathSaves(char.id, next)}
              highPressureValue={campaignData.highPressureDots?.[char.id]}
              onChangeHighPressure={MAP_PARTY_CODES.includes(partyCode) && campaignData.highPressureModeActive ? next => updateHighPressureDots(char.id, next) : undefined}
              onExpand={() => setExpandedId(char.id)}
              onKickConfirm={() => setKickConfirmId(char.id)}
              onKickCancel={() => setKickConfirmId(null)}
              onKick={() => kickMember(char.id)}
              onAddCondition={name => addConditionToMember(char.id, name)}
              onRemoveCondition={id => removeConditionFromMember(char.id, id)}
              cardStyle={rosterCardStyle}
            />
          ))}
        </div>

        {user?.email === ACTIVITY_STATS_EMAIL && (
          <PartyActivitySection partyCode={partyCode} partyMembers={partyMembers} currentUserId={user?.id ?? ""} cardStyle={customBgStyle} />
        )}
      </div>}
    </div>
  )
}



// ── Campaign Settings modal ──────────────────────────────────────────────
// Cosmetic + feature-flag controls that don't belong cluttering the
// Overview body — Inventory on/off (was a small toggle button buried in the
// Party Members row; moved here so it isn't the one settings control just
// hanging out unlabeled among the roster tools), and the Inventory tab's
// own look (per-stash accent, and the campaign view's own background).
// Label + accent-color swatch + StyleToggle, one self-contained row — the
// exact same shape as a character sheet's own Feature Styling category row
// (SettingsModal.tsx), right down to reusing StyleToggle/ColorSwatchInput
// themselves rather than a DM-only lookalike, since both ultimately just
// pick a CardStyle + color for categoryAccentStyle to apply.
function CardStylePicker({ label, hint, style, color, onChangeStyle, onChangeColor }: {
  label: string
  hint?: string
  style: CardStyle
  color?: string
  onChangeStyle: (style: CardStyle) => void
  onChangeColor: (color: string) => void
}) {
  return (
    <div className="flex flex-col gap-1 px-1 py-1.5 rounded-lg bg-white/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-white/70 shrink-0">{label}</span>
        <label className="flex flex-col items-center gap-0.5 cursor-pointer">
          <ColorSwatchInput value={color ?? DEFAULT_ACCENT_COLOR} title="Accent color" onChange={onChangeColor} />
          <span className="text-[8px] text-white/30">Color</span>
        </label>
      </div>
      <StyleToggle label="Style" value={style} onChange={onChangeStyle} />
      {hint && <p className="text-[10px] text-white/30 pl-2">{hint}</p>}
    </div>
  )
}

function CampaignSettingsModal({ campaignData, onToggleInventory, onToggleShops, onChangeBackground, onChangeStashStyle, onChangeStashAccentColor, onChangeRosterCardStyle, onChangeRosterCardAccentColor, onClose }: {
  campaignData: CampaignData
  onToggleInventory: () => void
  onToggleShops: () => void
  onChangeBackground: (color: string | undefined) => void
  onChangeStashStyle: (style: CardStyle) => void
  onChangeStashAccentColor: (color: string) => void
  onChangeRosterCardStyle: (style: CardStyle) => void
  onChangeRosterCardAccentColor: (color: string) => void
  onClose: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(480px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <p className="text-sm font-bold text-white">Campaign Settings</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-5 overflow-y-auto">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-white">Inventory Tab</p>
              <p className="text-xs text-white/40 mt-0.5">Adds an Inventory tab for sorting and handing out party loot.</p>
            </div>
            <input type="checkbox" checked={!!campaignData.inventoryEnabled} onChange={onToggleInventory}
              className="size-5 accent-violet-500 shrink-0 cursor-pointer" />
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-white">Shops Tab</p>
              <p className="text-xs text-white/40 mt-0.5">Adds a Shops tab: It allows you to sell items to the party for gold or other currency. </p>
            </div>
            <input type="checkbox" checked={!!campaignData.shopsEnabled} onChange={onToggleShops}
              className="size-5 accent-violet-500 shrink-0 cursor-pointer" />
          </label>

          <CardStylePicker label="Stash Appearance" hint="Applies to every stash shelf in the Inventory tab."
            style={campaignData.stashStyle ?? "none"} color={campaignData.stashAccentColor}
            onChangeStyle={onChangeStashStyle} onChangeColor={onChangeStashAccentColor} />

          <CardStylePicker label="Default Card Appearance" hint="Every party member's card in Overview/the roster panel, plus the fallback color for any shop or item that hasn't picked its own — stashes keep their own separate Appearance above."
            style={campaignData.rosterCardStyle ?? "none"} color={campaignData.rosterCardAccentColor}
            onChangeStyle={onChangeRosterCardStyle} onChangeColor={onChangeRosterCardAccentColor} />

          <div className="flex flex-col gap-2 px-1 py-1.5 rounded-lg bg-white/5">
            <span className="text-sm text-white/70">Campaign Background</span>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span>Custom color</span>
              <ColorSwatchInput value={campaignData.backgroundColor ?? "#18181b"} title="Campaign background color"
                onChange={onChangeBackground} />
              {campaignData.backgroundColor && (
                <button type="button" onClick={() => onChangeBackground(undefined)}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-white/50 hover:text-white/80 transition-colors">
                  Reset to default
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function InventoryTab({ partyMembers, stashes, stashStyle, stashAccentColor, rosterCardStyle, floatingItems, setFloatingItems, userId, addStash, renameStash, deleteStash, addToStash, removeFromStash, moveBetweenStashes, updateStashItem, setMemberItems }: {
  partyMembers: SidebarObject[]
  stashes: ItemStash[]
  stashStyle?: CardStyle
  stashAccentColor?: string
  rosterCardStyle?: React.CSSProperties  // Campaign Settings' "Default Card Appearance" — applied to each player's own column here, same as everywhere else a party member's card shows
  floatingItems: Feature[]
  setFloatingItems: React.Dispatch<React.SetStateAction<Feature[]>>
  userId?: string | null
  addStash: (name: string) => void
  renameStash: (stashId: string, name: string) => void
  deleteStash: (stashId: string) => void
  addToStash: (stashId: string, items: Feature[]) => void
  removeFromStash: (stashId: string, itemId: string) => void
  moveBetweenStashes: (fromStashId: string, toStashId: string, item: Feature) => void
  updateStashItem: (stashId: string, item: Feature) => void
  setMemberItems: (characterId: string, items: Feature[]) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  // Non-null while the item-editor modal is open. `creatingItemStashId`
  // says where the item being edited actually lives right now: null = a
  // brand-new draft that hasn't landed anywhere yet (Save adds it to the
  // floating cluster below), "floating" = an existing floating item being
  // tweaked in place, "stash:<id>" = an existing item in that stash. Same
  // blank-Feature-then-edit flow ItemsTab.tsx uses for its own "+ Add
  // Item", just surfaced in a modal here since there's no underlying list
  // card for it to expand into yet.
  const [creatingItem, setCreatingItem] = useState<Feature | null>(null)
  const [creatingItemStashId, setCreatingItemStashId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  // The item mid-drag, kept in a ref rather than state — a drag gesture
  // fires dragover continuously, and re-rendering on every one of those
  // (rather than just when the highlighted column actually changes) would
  // fight the browser's own drag tracking for no benefit.
  const dragRef = useRef<{ item: Feature; from: string } | null>(null)

  const memberItems = (m: SidebarObject) => (safeParseJson(m.data) as CharData).items ?? []
  // Stash ids are always "stash:<nanoid>" (see addStash) — character ids
  // never look like that, so this is enough to tell a drag's endpoint apart
  // without threading a separate "kind" flag through drag state. Floating
  // items use the literal id "floating" — there's only ever one such spot.
  const isStash = (id: string) => id.startsWith("stash:")
  // Character's own Settings → "Allow DM to change your Items" (default on).
  // Returns false for stash/floating ids too, since only a real character id
  // can ever match a partyMembers entry — the lock only ever applies there.
  const isMemberLocked = (id: string) => {
    const m = partyMembers.find(pm => pm.id === id)
    return !!m && (safeParseJson(m.data) as CharData).allowDmItemChanges === false
  }

  function moveItem(item: Feature, from: string, to: string) {
    if (from === to) return
    // Enforced here too, not just by disabling the drag/drop UI below — the
    // one place that actually writes to a character's items should never
    // trust the UI alone to have kept a locked column untouched.
    if (isMemberLocked(from) || isMemberLocked(to)) return
    // Stash → stash goes through the one combined write in moveBetweenStashes
    // instead of removeFromStash + addToStash back-to-back. Those two each
    // independently read `campaignData` and overwrite the whole `stashes`
    // array from that same stale snapshot — firing both races two
    // updateObject calls against each other, and whichever lands second wins
    // outright, discarding the other's change. That's a lost update, not
    // just a rare glitch: the item comes out of `from` in one write and
    // never makes it into `to` in the other (or vice versa), so it just
    // vanishes.
    if (isStash(from) && isStash(to)) {
      moveBetweenStashes(from, to, item)
      return
    }
    if (from === "floating") setFloatingItems(prev => prev.filter(i => i.id !== item.id))
    else if (isStash(from)) removeFromStash(from, item.id)
    else {
      const src = partyMembers.find(m => m.id === from)
      if (src) setMemberItems(from, memberItems(src).filter(i => i.id !== item.id))
    }
    if (isStash(to)) addToStash(to, [item])
    else {
      const dst = partyMembers.find(m => m.id === to)
      if (dst) setMemberItems(to, [...memberItems(dst), item])
    }
  }

  // Mirrors ItemsTab.tsx's addItemFromSuggestion/addPackToInventory exactly
  // (same conversion, same pack-explosion into one Feature per pack item),
  // just landing in the floating cluster instead of a character's own
  // `items` — so a magic weapon/armor picked here carries its full stat
  // block, not just a name.
  function pickToFeatures(s: Suggestion): Feature[] {
    if (s.meta?.item_type === "pack" && s.meta.pack_items) {
      return s.meta.pack_items.map(pi => ({
        id: nanoid(), name: pi.name, category: "item" as const,
        amount: pi.amount, trackAmount: pi.amount > 1,
        weight: pi.weight || undefined, value: pi.value || undefined,
      }))
    }
    const blank: Feature = { id: nanoid(), name: s.name, category: "item" }
    const patch = itemPatchFromSuggestion("item", s, blank)
    return [{ ...blank, description: s.description, ...patch }]
  }

  function openNewItem() {
    setCreatingItem({ id: nanoid(), name: "", category: "item" })
    setCreatingItemStashId(null)
  }
  function openFloatingItem(item: Feature) {
    setCreatingItem(item)
    setCreatingItemStashId("floating")
  }
  function openStashItem(stashId: string, item: Feature) {
    setCreatingItem(item)
    setCreatingItemStashId(stashId)
  }
  function closeItemEditor() {
    setCreatingItem(null)
    setCreatingItemStashId(null)
  }
  function saveItemEditor() {
    if (!creatingItem) return
    if (creatingItemStashId === null) setFloatingItems(prev => [...prev, creatingItem])
    else if (creatingItemStashId === "floating") setFloatingItems(prev => prev.map(i => i.id === creatingItem.id ? creatingItem : i))
    else updateStashItem(creatingItemStashId, creatingItem)
    closeItemEditor()
  }
  function removeFromItemEditor() {
    if (!creatingItem) return
    if (creatingItemStashId === "floating") setFloatingItems(prev => prev.filter(i => i.id !== creatingItem.id))
    else if (creatingItemStashId) removeFromStash(creatingItemStashId, creatingItem.id)
    // null (never saved anywhere) — nothing to remove, just close.
    closeItemEditor()
  }

  function startDrag(item: Feature, from: string) {
    dragRef.current = { item, from }
  }
  function endDrag() {
    dragRef.current = null
    setDragOverCol(null)
  }
  function dropOn(colId: string) {
    const d = dragRef.current
    dragRef.current = null
    setDragOverCol(null)
    if (d) moveItem(d.item, d.from, colId)
  }

  const stashCardStyle = categoryAccentStyle(stashAccentColor, stashStyle)

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto p-4 gap-4">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold block">Party Inventory</span>
          <p className="text-[10px] text-foreground/30 mt-0.5">
            Drag an item between a stash and a player's column to give, take, or trade it — changes write straight to each player's real Items tab.
            Only use this if your players consent to playing with these rules; otherwise, having items appear or vanish without warning can feel intrusive.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => setShowPicker(true)}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground/80 font-semibold transition-colors">
            + From Documentation
          </button>
          <button type="button" onClick={openNewItem}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground/80 font-semibold transition-colors">
            + Custom Item
          </button>
        </div>
      </div>

      {/* Stashes — sortable groupings ("Shop", "Vault", "Quest Rewards"),
          not just one flat pile — wrap onto multiple lines rather than
          scrolling, since there's no fixed count of these the way there is
          for players. */}
      <div className="flex flex-wrap items-start gap-3 shrink-0">
        {stashes.map(stash => (
          <InventoryStash key={stash.id} stash={stash} cardStyle={stashCardStyle}
            isDragOver={dragOverCol === stash.id} onDragOverCol={setDragOverCol} onDrop={dropOn}
            onStartDrag={startDrag} onEndDrag={endDrag}
            onEdit={openStashItem} onRename={renameStash} onDelete={deleteStash} />
        ))}
        <button type="button" onClick={() => addStash(`Stash ${stashes.length + 1}`)}
          className="w-64 h-24 rounded-xl ring-1 ring-dashed ring-border flex items-center justify-center text-xs text-foreground/40 hover:text-foreground/70 hover:ring-foreground/30 transition-colors">
          + New Stash
        </button>
      </div>

      <div className="flex items-start gap-3 overflow-x-auto shrink-0 pb-2">
        {partyMembers.map(m => (
          <InventoryColumn key={m.id} id={m.id} title={m.name} items={memberItems(m)}
            locked={isMemberLocked(m.id)} cardStyle={rosterCardStyle}
            isDragOver={dragOverCol === m.id} onDragOverCol={setDragOverCol} onDrop={dropOn}
            onStartDrag={startDrag} onEndDrag={endDrag} />
        ))}
      </div>

      {/* Floating cluster — where "+ From Documentation"/"+ Custom Item"
          actually land. Not attached to any stash or player yet; drag one
          of these chips onto a stash or player to place it, which is the
          only thing that actually persists it (the cluster itself lives
          only in CampaignView's component state — see floatingItems). */}
      {floatingItems.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 p-3 rounded-xl bg-popover text-popover-foreground border border-border shadow-2xl w-64">
          <p className="text-[10px] text-foreground/50">Drag onto a stash or player to place {floatingItems.length > 1 ? "them" : "it"}.</p>
          <div className="flex flex-col gap-1.5">
            {floatingItems.map(item => (
              <div key={item.id} className="relative">
                <InventoryItemRow item={item} from="floating" onStartDrag={startDrag} onEndDrag={endDrag}
                  onEdit={openFloatingItem} />
                <button type="button" onClick={() => setFloatingItems(prev => prev.filter(i => i.id !== item.id))}
                  title="Discard" className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-background border border-border text-foreground/50 hover:text-red-400 flex items-center justify-center text-[9px] leading-none">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPicker && (
        <FeatureSuggestionPickerModal
          label="Item" suggestionSource="item" userId={userId}
          existingNames={floatingItems.map(f => f.name)}
          onPick={s => setFloatingItems(prev => [...prev, ...pickToFeatures(s)])}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Custom item creation/editing — the exact same editor a character's
          own Items tab uses (FeatureEntry), so weapon/armor stats, weight,
          value, attunement, everything is available here too, not a
          trimmed-down lookalike. `pb`/`statMods` are neutral placeholders
          (this item isn't attached to any character yet, so there's no real
          to-hit/damage to preview) and `allFeatures`/link-options are empty
          for the same reason — nothing else exists yet to link or trigger. */}
      {creatingItem && (() => {
        const isNew = creatingItemStashId === null
        const targetStash = creatingItemStashId && creatingItemStashId !== "floating" ? stashes.find(s => s.id === creatingItemStashId) : null
        const title = isNew ? "New Item" : creatingItemStashId === "floating" ? "Edit Item (unplaced)" : `Edit Item${targetStash ? ` — ${targetStash.name}` : ""}`
        return (
          <Modal onClose={closeItemEditor}>
            <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(560px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                <p className="text-sm font-bold text-white">{title}</p>
                <button type="button" onClick={closeItemEditor}
                  className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
              </div>
              <div className="p-4 overflow-y-auto">
                <FeatureEntry
                  feature={creatingItem}
                  onChange={patch => setCreatingItem(f => f ? { ...f, ...patch } : f)}
                  onRemove={removeFromItemEditor}
                  onLinkToggle={() => {}}
                  allFeatures={[]}
                  theme={THEMES[DEFAULT_THEME]}
                  pb={2} statMods={{}}
                  showItemExtras showAttunement
                  suggestionSource="item" userId={userId}
                  autoEdit onAutoEditConsumed={() => {}}
                />
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/10 shrink-0">
                <button type="button" onClick={closeItemEditor}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white">Cancel</button>
                <button type="button" disabled={!creatingItem.name.trim()} onClick={saveItemEditor}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/80 hover:bg-violet-500 text-white disabled:opacity-40">
                  {isNew ? "Add" : "Save Changes"}
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

// A named, wide wrapping shelf of item chips rather than InventoryColumn's
// narrow vertical list — stashes wrap onto their own row(s) above the
// players instead of sharing their (horizontally-scrolling, fixed-count)
// row. Its name is editable in place (commits on blur, same pattern as
// MysteriousPagesOverlay's page title); the delete button only ever
// actually works while empty — moving/deleting every item first avoids
// silently discarding loot along with the grouping.
function InventoryStash({ stash, cardStyle, isDragOver, onDragOverCol, onDrop, onStartDrag, onEndDrag, onEdit, onRename, onDelete }: {
  stash: ItemStash
  cardStyle?: React.CSSProperties
  isDragOver: boolean
  onDragOverCol: (id: string | null) => void
  onDrop: (id: string) => void
  onStartDrag: (item: Feature, from: string) => void
  onEndDrag: () => void
  onEdit: (stashId: string, item: Feature) => void
  onRename: (stashId: string, name: string) => void
  onDelete: (stashId: string) => void
}) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOverCol(stash.id) }}
      onDrop={e => { e.preventDefault(); onDrop(stash.id) }}
      // While actively dragged over, the highlight ring needs to win —
      // cardStyle's own ring color is an inline style, which would
      // otherwise always beat the ring-primary utility class on specificity
      // alone, masking the drop feedback with whatever accent was picked.
      style={isDragOver ? undefined : cardStyle}
      className={`w-64 shrink-0 rounded-xl bg-muted ring-1 p-2 flex flex-col gap-1.5 transition-colors ${isDragOver ? "ring-primary" : cardStyle ? "" : "ring-border"}`}
    >
      <div className="flex items-center gap-1 pb-0.5">
        <input
          key={stash.id} defaultValue={stash.name}
          onBlur={e => { const v = e.currentTarget.value.trim(); if (v && v !== stash.name) onRename(stash.id, v) }}
          onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
          className="flex-1 min-w-0 bg-transparent text-[10px] uppercase tracking-widest font-semibold text-foreground/50 outline-none border-b border-transparent focus:border-border py-0.5"
        />
        <span className="text-[9px] text-foreground/30 tabular-nums shrink-0">{stash.items.length}</span>
        <button type="button" onClick={() => onDelete(stash.id)} disabled={stash.items.length > 0}
          title={stash.items.length > 0 ? "Empty this stash before deleting it" : "Delete this stash"}
          className="shrink-0 size-5 flex items-center justify-center rounded text-foreground/30 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-foreground/30 transition-colors">
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-14 max-h-40 overflow-y-auto">
        {stash.items.length === 0 ? (
          <p className="text-[10px] italic text-foreground/25 py-2 px-1">Empty — drag an item here to place it.</p>
        ) : stash.items.map(item => (
          <div key={item.id} className="w-40">
            <InventoryItemRow item={item} from={stash.id} onStartDrag={onStartDrag} onEndDrag={onEndDrag}
              onEdit={item => onEdit(stash.id, item)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function InventoryColumn({ id, title, items, locked, cardStyle, isDragOver, onDragOverCol, onDrop, onStartDrag, onEndDrag }: {
  id: string
  title: string
  items: Feature[]
  locked?: boolean  // this character's own Settings → "Allow DM to change your Items" is off — no drop in, no drag out, just a 🔒 next to their name
  cardStyle?: React.CSSProperties  // Campaign Settings' "Default Card Appearance" — see InventoryStash's own cardStyle for the identical reasoning
  isDragOver: boolean
  onDragOverCol: (id: string | null) => void
  onDrop: (id: string) => void
  onStartDrag: (item: Feature, from: string) => void
  onEndDrag: () => void
}) {
  return (
    <div
      onDragOver={e => { if (locked) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOverCol(id) }}
      onDrop={e => { if (locked) return; e.preventDefault(); onDrop(id) }}
      title={locked ? `${title} has turned off "Allow DM to change your Items" in Settings` : undefined}
      // Drag-over highlight wins over cardStyle's own inline ring color, same
      // reasoning as InventoryStash — an inline style always beats a
      // ring-primary utility class on specificity alone.
      style={isDragOver ? undefined : cardStyle}
      className={`flex flex-col gap-1.5 w-56 shrink-0 max-h-80 rounded-xl bg-muted ring-1 p-2 transition-colors ${isDragOver ? "ring-primary" : "ring-border"} ${locked ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between px-1 pb-1 gap-1 shrink-0">
        <span className="flex items-center gap-1 min-w-0">
          {locked && <span className="text-[10px] shrink-0" aria-hidden>🔒</span>}
          <span className="text-[10px] uppercase tracking-widest font-semibold text-foreground/50 truncate">{title}</span>
        </span>
        <span className="text-[9px] text-foreground/30 tabular-nums shrink-0">{items.length}</span>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-h-16 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-[10px] italic text-foreground/25 text-center py-4">Empty</p>
        ) : items.map(item => (
          <InventoryItemRow key={item.id} item={item} from={id} locked={locked} onStartDrag={onStartDrag} onEndDrag={onEndDrag} />
        ))}
      </div>
    </div>
  )
}

// `onEdit` is only ever passed for stash items (InventoryStash) — editing a
// player's real item straight from this overview, without going through the
// take-to-stash drag first, wasn't asked for, so InventoryColumn (player
// items) just omits it and the row falls back to drag-only. Deleting a stash
// item now lives only inside that edit modal (FeatureEntry's own remove
// icon — see InventoryTab's onRemove wiring), not as a second button here.
function InventoryItemRow({ item, from, locked, onStartDrag, onEndDrag, onEdit }: {
  item: Feature
  from: string
  locked?: boolean  // this row's own column is locked (see InventoryColumn) — not draggable out
  onStartDrag: (item: Feature, from: string) => void
  onEndDrag: () => void
  onEdit?: (item: Feature) => void
}) {
  // Same weapon-damage/armor-AC quick facts the character sheet's own item
  // cards show (FeatureEntry.tsx) — statMods deliberately empty and pb 0
  // here since this item isn't attached to any one character's stats yet;
  // only its own intrinsic dice/bonus show, not a wielder-specific to-hit.
  const meta = item.itemMeta ?? {}
  const isWeapon = item.equipKind === "weapon"
  const dmgSegments = isWeapon ? computeWeaponDamageSegments(meta, {}, 0) : []
  const acBase = item.category === "armor" && (item.equipKind ?? "armor") === "armor" && meta.armorMode === "base" && meta.armorBaseAc != null
  const acBonus = item.category === "armor" && (item.equipKind ?? "armor") === "armor" && (meta.armorMode ?? "bonus") === "bonus" && !!meta.acBonus
  const hasQuickFacts = dmgSegments.length > 0 || acBase || acBonus

  return (
    <div
      draggable={!locked}
      onDragStart={locked ? undefined : e => { onStartDrag(item, from); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.name) }}
      onDragEnd={onEndDrag}
      onClick={() => onEdit?.(item)}
      title={locked ? "Locked — this player has turned off \"Allow DM to change your Items\" in Settings" : onEdit ? "Click to edit — drag onto another column to give, take, or trade" : "Drag onto another column to give, take, or trade"}
      className={`flex flex-col gap-1 px-2 py-1.5 rounded-lg bg-foreground/5 transition-colors ${locked ? "cursor-default" : `hover:bg-foreground/10 cursor-grab active:cursor-grabbing ${onEdit ? "cursor-pointer" : ""}`}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="flex-1 min-w-0 text-xs text-foreground truncate">{item.name || "Unnamed item"}</span>
        {(item.amount ?? 1) > 1 && <span className="text-[9px] text-foreground/40 tabular-nums shrink-0">×{item.amount}</span>}
        {item.value ? <span className="text-[9px] text-foreground/30 tabular-nums shrink-0">{item.value}gp</span> : null}
      </div>
      {hasQuickFacts && (
        <div className="flex items-center gap-1 flex-wrap">
          {acBase && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/60 shrink-0">
              AC {meta.armorBaseAc}{meta.armorDexMode === "none" ? " (no dex)" : meta.armorDexMode === "half" ? " (½ dex)" : ""}
            </span>
          )}
          {acBonus && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/60 shrink-0">+{meta.acBonus} AC</span>
          )}
          <DamagePills segments={dmgSegments} size="xs" />
        </div>
      )}
    </div>
  )
}

// ── Roster sidebar ────────────────────────────────────────────────────────
// The compact "characters only" dock, opened from the ⓘ context menu on a
// campaign in the left sidebar (see app-sidebar.tsx) and rendered alongside
// the main pane workspace in Dashboard.tsx. Deliberately excludes the party
// code card and the Initiative/Chat tabs — just the roster, so it's small
// enough to keep visible while you work on something else.
// Starting geometry: docked toward the top-right, roughly where the old
// fixed sidebar used to sit, so converting to a floating panel doesn't also
// relocate it out of habit — narrower than the shared FloatingPanel default
// (compact party cards don't need 420px) but still free to resize wider.
const ROSTER_PANEL_W = 260
const ROSTER_PANEL_H = 420

export function CampaignRosterSidebar({ campaign, onClose, onOpenCharacter }: {
  campaign: SidebarObject
  onClose: () => void
  onOpenCharacter: (characterId: string) => void
}) {
  const {
    campaignData, partyCode, partyMembers,
    updateRosterFields, updateDmDeathSaves, addConditionToMember, removeConditionFromMember,
    updateHighPressureDots,
  } = useCampaignRoster(campaign)

  // Ephemeral position/size, same convention as CharacterSheet.tsx's
  // familiar pop-outs (see FloatingPanel.tsx) — resets to this docked
  // starting spot each time the roster panel is reopened rather than
  // persisting across sessions.
  const [pos, setPos] = useState(() => {
    const w = Math.min(ROSTER_PANEL_W, window.innerWidth - 16)
    const h = Math.min(ROSTER_PANEL_H, window.innerHeight - 16)
    return { x: Math.max(8, window.innerWidth - w - 16), y: 80, w, h }
  })

  const enabledStatCells = STAT_CELL_FIELDS.filter(f => isRosterFieldOn(campaignData.rosterFields, f.key))
  const showConditions = isRosterFieldOn(campaignData.rosterFields, "conditions")

  return (
    <FloatingPanel
      title={campaign.name}
      headerExtra={<RosterFieldsMenu rosterFields={campaignData.rosterFields} onChange={updateRosterFields} />}
      x={pos.x} y={pos.y} width={pos.w} height={pos.h}
      onMove={(x, y) => setPos(p => ({ ...p, x, y }))}
      onResize={(w, h, x) => setPos(p => ({ ...p, w, h, x }))}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1.5">
        {partyCode === "" && (
          <p className="text-[10px] text-foreground/30 italic text-center py-6">This campaign has no party code.</p>
        )}
        {partyCode !== "" && partyMembers.length === 0 && (
          <div className="rounded-xl bg-muted ring-1 ring-border p-3 text-center">
            <p className="text-[10px] text-foreground/40 italic">No characters have joined yet.</p>
          </div>
        )}
        {partyMembers.map(char => (
          <PartyMemberCard
            key={char.id}
            char={char}
            charData={safeParseJson(char.data) as CharData}
            enabledStatCells={enabledStatCells}
            showConditions={showConditions}
            compact
            dmDeathSaves={campaignData.dmDeathSaves?.[char.id] ?? { successes: 0, failures: 0 }}
            onChangeDmDeathSaves={next => updateDmDeathSaves(char.id, next)}
            highPressureValue={campaignData.highPressureDots?.[char.id]}
            onChangeHighPressure={MAP_PARTY_CODES.includes(partyCode) && campaignData.highPressureModeActive ? next => updateHighPressureDots(char.id, next) : undefined}
            onExpand={() => onOpenCharacter(char.id)}
            onAddCondition={name => addConditionToMember(char.id, name)}
            onRemoveCondition={id => removeConditionFromMember(char.id, id)}
            cardStyle={categoryAccentStyle(campaignData.rosterCardAccentColor, campaignData.rosterCardStyle)}
          />
        ))}
      </div>
    </FloatingPanel>
  )
}

// A DM-only death save tally, independent of whatever the player rolls and
// tracks on their own sheet — see CampaignData.dmDeathSaves. Deliberately
// simple (no auto-stabilize/dead transitions like the player's own
// DeathSavingThrows panel) since this is just the DM's private bookkeeping,
// not a mechanic that should silently change the character's real state.
function DmDeathSaveTracker({ saves, onChange }: { saves: DmDeathSaves; onChange: (next: DmDeathSaves) => void }) {
  const { successes, failures } = saves
  function toggle(kind: "successes" | "failures", i: number) {
    const current = saves[kind]
    const filled = i < current
    const next = filled && i === current - 1 ? current - 1 : Math.min(3, current + 1)
    onChange({ ...saves, [kind]: next })
  }
  return (
    <div className="flex items-center gap-2 flex-wrap px-3 py-1.5 border-t border-foreground/5" onClick={e => e.stopPropagation()}>
      <span className="text-[8px] text-foreground/35 uppercase tracking-widest shrink-0">DM Death Saves</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <button key={i} type="button" onClick={() => toggle("successes", i)}
            className={`size-3.5 rounded-full border flex items-center justify-center text-[7px] leading-none transition-colors ${
              i < successes ? "bg-emerald-500/25 border-emerald-400 text-emerald-300" : "border-foreground/20 text-transparent hover:border-emerald-400/50"
            }`}>
            ♥
          </button>
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <button key={i} type="button" onClick={() => toggle("failures", i)}
            className={`size-3.5 rounded-full border flex items-center justify-center text-[7px] leading-none transition-colors ${
              i < failures ? "bg-red-500/25 border-red-400 text-red-300" : "border-foreground/20 text-transparent hover:border-red-400/50"
            }`}>
            ☠
          </button>
        ))}
      </div>
    </div>
  )
}

// "High Pressure Mode" — MAP_PARTY_CODES campaigns only (see constants.ts).
// Deliberately plain/neutral (no color-coding, no glyph) unlike
// DmDeathSaveTracker above — just 3 dots, filled or empty, same toggle
// semantics (click fills one more; clicking the last filled dot un-fills it).
function HighPressureTracker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  function toggle(i: number) {
    const filled = i < value
    const next = filled && i === value - 1 ? value - 1 : Math.min(3, value + 1)
    onChange(next)
  }
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()} title="High Pressure">
      {Array.from({ length: 3 }).map((_, i) => (
        <button key={i} type="button" onClick={() => toggle(i)}
          className={`size-3 rounded-full border transition-colors ${
            i < value ? "bg-foreground border-foreground" : "border-foreground/25 hover:border-foreground/50"
          }`} />
      ))}
    </div>
  )
}

function PartyMemberCard({
  char, charData, enabledStatCells, showConditions,
  kickConfirmId, kicking,
  dmDeathSaves, onChangeDmDeathSaves,
  highPressureValue, onChangeHighPressure,
  onExpand, onKickConfirm, onKickCancel, onKick,
  onAddCondition, onRemoveCondition,
  cardStyle,
  compact = false,
}: {
  char: SidebarObject
  charData: CharData
  enabledStatCells: typeof STAT_CELL_FIELDS
  showConditions: boolean
  kickConfirmId?: string | null
  kicking?: boolean
  dmDeathSaves: DmDeathSaves
  onChangeDmDeathSaves: (next: DmDeathSaves) => void
  highPressureValue?: number  // omit (rather than false) to hide the tracker — only shown when the campaign has High Pressure Mode active
  onChangeHighPressure?: (next: number) => void
  onExpand: () => void
  onKickConfirm?: () => void
  onKickCancel?: () => void
  onKick?: () => void
  onAddCondition: (name: string) => void
  onRemoveCondition: (id: string) => void
  cardStyle?: React.CSSProperties  // Campaign Settings' "Party Card Appearance" — see categoryAccentStyle
  compact?: boolean
}) {
  const [showConditionMenu, setShowConditionMenu] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(showConditionMenu, triggerRef)
  useClickOutside(showConditionMenu, () => setShowConditionMenu(false), triggerRef, contentRef)

  const level     = charData.level ?? 1
  const hpPercent = charData.maxHp ? Math.round((charData.hp ?? 0) / charData.maxHp * 100) : 0
  const hpColor   = hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500"
  const conditions = charData.conditions ?? []

  return (
    <div style={cardStyle}
      className={`rounded-xl bg-muted ring-1 hover:ring-border transition-all overflow-hidden ${cardStyle ? "" : "ring-border"}`}>
      {/* Top row — name + arrow (portrait/kick only in the full, non-compact card) */}
      <div className={`${compact ? "p-2 gap-2" : "p-3 gap-3"} flex items-center cursor-pointer`} onClick={onExpand}>
        {!compact && (
          <div className="size-10 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
            {charData.portrait ? (
              <img src={charData.portrait} alt={char.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg leading-none select-none">🧙</span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-foreground truncate`}>{char.name}</p>
            {onChangeHighPressure && (
              <HighPressureTracker value={highPressureValue ?? 0} onChange={onChangeHighPressure} />
            )}
          </div>
          {!compact && (
            <p className="text-[10px] text-foreground/50 uppercase tracking-wider truncate">
              {charData.race && `${charData.race} · `}{charData.class && charData.class}{charData.level && ` Lv ${charData.level}`}
            </p>
          )}
          {charData.maxHp ? (
            <div className={`${compact ? "mt-1" : "mt-1.5"} flex items-center gap-2`}>
              <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPercent}%` }} />
              </div>
              <span className="text-[9px] text-foreground/40 shrink-0">{charData.hp ?? 0}/{charData.maxHp} HP</span>
            </div>
          ) : null}
        </div>

        {!compact && (
          kickConfirmId === char.id ? (
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                disabled={kicking}
                onClick={onKick}
                className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-40"
              >
                {kicking ? "Kicking…" : "Confirm kick"}
              </button>
              <button
                type="button"
                disabled={kicking}
                onClick={onKickCancel}
                className="text-[10px] px-2 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/50 hover:text-foreground transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onKickConfirm?.() }}
              title="Remove from party"
              className="text-[10px] px-2 py-1 rounded-full bg-foreground/5 hover:bg-red-500/20 text-foreground/40 hover:text-red-300 transition-colors shrink-0"
            >
              Kick
            </button>
          )
        )}

        {!compact && <span className="text-foreground/30 text-xs shrink-0">→</span>}
      </div>

      {/* Stat row — only the fields turned on in the ⚙ menu above, in a
          flex row so it stays evenly spaced whether that's 1 field or 6. */}
      {enabledStatCells.length > 0 && (
        <div className="flex border-t border-foreground/5 divide-x divide-foreground/5">
          {enabledStatCells.map(f => (
            <StatCell key={f.key} label={f.shortLabel} value={rosterFieldValue(f.key, charData, level)} compact={compact} />
          ))}
        </div>
      )}

      {/* DM's own death save tally — only surfaces once the character is
          actually down, and never touches the player's own tracked saves. */}
      {charData.maxHp != null && (charData.hp ?? 0) <= 0 && (
        <DmDeathSaveTracker saves={dmDeathSaves} onChange={onChangeDmDeathSaves} />
      )}

      {/* Conditions row — DM can add/remove conditions right from the roster */}
      {showConditions && (
        <div className={`flex flex-wrap items-center gap-1 ${compact ? "px-2 py-1.5" : "px-3 py-2"} border-t border-foreground/5`} onClick={e => e.stopPropagation()}>
          {conditions.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => onRemoveCondition(c.id)}
              title="Click to remove"
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300/80 font-medium hover:bg-red-500/30 transition-colors"
            >
              {c.name} ✕
            </button>
          ))}
          <button
            type="button"
            ref={triggerRef}
            onClick={() => setShowConditionMenu(v => !v)}
            className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            + Condition
          </button>
          {showConditionMenu && pos && createPortal(
            <div
              ref={contentRef}
              style={{ position: "fixed", top: pos.top, right: pos.right }}
              className="z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl overflow-hidden w-56 p-2 grid grid-cols-2 gap-1 animate-in fade-in zoom-in-95 duration-150"
            >
              {ALL_CONDITIONS.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onAddCondition(name); setShowConditionMenu(false) }}
                  disabled={conditions.some(c => c.name === name)}
                  className={`text-xs px-2 py-1.5 rounded-lg text-left transition-colors ${conditions.some(c => c.name === name) ? "text-foreground/25 cursor-default" : "text-foreground/80 hover:bg-foreground/10"}`}
                >
                  {name}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`flex-1 min-w-0 flex flex-col items-center ${compact ? "py-1" : "py-2"} gap-0.5`}>
      <span className="text-[9px] text-foreground/30 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
}

// ── Shops tab ────────────────────────────────────────────────────────────────
// Cousin of the Inventory tab above — same campaign-object read-modify-write
// pattern, and the item add/edit modal reuses FeatureEntry exactly like
// InventoryTab's own item editor does (showShopFields is the one addition
// FeatureEntry itself needed, mirroring showAttunement/showInfusedToggle).
// Unlike stashes, a shop item's price/quantity ARE the item's own
// value/amount fields — no separate shop-specific price field.
function ShopsTab({
  shops, currentShopId, shopHistory, partyMembers, userId, defaultAccentColor, rosterCardStyle,
  addShop, renameShop, deleteShop, updateShopSettings, setCurrentShop,
  addItemsToShop, removeItemFromShop, updateShopItem, approveShopRequest, denyShopRequest,
  applyWalletSettingsToAll,
}: {
  shops: Shop[]
  currentShopId: string | null
  shopHistory: ShopPurchaseRecord[]
  partyMembers: SidebarObject[]
  userId?: string | null
  defaultAccentColor?: string  // Campaign Settings' "Default Card Appearance" — fallback color for any shop/item that hasn't picked its own
  rosterCardStyle?: React.CSSProperties  // same "Default Card Appearance", pre-resolved to real CSS (respecting none/outline/galaxy) — applied to History/Party Wallets, the two generic (not per-shop) cards here, same as InventoryColumn/InventoryStash
  addShop: (name: string) => void
  renameShop: (shopId: string, name: string) => void
  deleteShop: (shopId: string) => void
  updateShopSettings: (shopId: string, patch: Partial<Shop>) => void
  setCurrentShop: (shopId: string | null) => void
  addItemsToShop: (shopId: string, items: Feature[]) => void
  removeItemFromShop: (shopId: string, itemId: string) => void
  updateShopItem: (shopId: string, item: Feature) => void
  approveShopRequest: (shopId: string, requestId: string) => void
  denyShopRequest: (shopId: string, requestId: string) => void
  applyWalletSettingsToAll: (mode: CurrencyMode, names: string[]) => void
}) {
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [renamingShopId, setRenamingShopId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [addingShop, setAddingShop] = useState(false)
  const [newShopName, setNewShopName] = useState("")
  const [creatingItemShopId, setCreatingItemShopId] = useState<string | null>(null)
  const [creatingItem, setCreatingItem] = useState<Feature | null>(null)
  const [settingsShopId, setSettingsShopId] = useState<string | null>(null)
  const [bulkImportShopId, setBulkImportShopId] = useState<string | null>(null)
  const [showWalletSettings, setShowWalletSettings] = useState(false)
  const [playerViewShopId, setPlayerViewShopId] = useState<string | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const dragSensors = useDragSensors()

  // Dropping directly over a section's own DropZone always wins (even
  // though it visually overlaps the item cards inside it) — otherwise
  // dropping on empty space within a section would fall through to
  // whatever item card is nearest, which might be in a different section.
  function shopItemCollision(args: Parameters<CollisionDetection>[0]) {
    const within = pointerWithin(args)
    const zone = within.find(c => typeof c.id === "string" && c.id.startsWith("shopSection:"))
    if (zone) return [zone]
    return closestCenter(args)
  }

  // Drop onto a section's own zone (including its "Other" bucket) → that
  // section. Drop onto another item card → inherit THAT item's section
  // (the natural "drop it next to this one" gesture). Either way this is a
  // pure re-tag, not a reorder — items within a section aren't sorted.
  function handleItemDragEnd(shop: Shop, event: DragEndEvent) {
    setDraggingItemId(null)
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return
    const zoneMatch = /^shopSection:(.+)$/.exec(overId)
    let targetSectionId: string | undefined
    if (zoneMatch) {
      targetSectionId = zoneMatch[1] === "none" ? undefined : zoneMatch[1]
    } else {
      const overItem = shop.items.find(i => i.id === overId)
      if (!overItem) return
      targetSectionId = overItem.shopSectionId
    }
    const activeItem = shop.items.find(i => i.id === activeId)
    if (!activeItem || activeItem.shopSectionId === targetSectionId) return
    updateShopItem(shop.id, { ...activeItem, shopSectionId: targetSectionId })
  }

  const allPendingRequests = shops.flatMap(s => (s.pendingRequests ?? []).map(r => ({ shop: s, request: r })))
  const selectedShop = shops.find(s => s.id === selectedShopId)
  const playerViewShop = shops.find(s => s.id === playerViewShopId)

  function submitNewShop() {
    const name = newShopName.trim()
    if (!name) return
    addShop(name)
    setNewShopName("")
    setAddingShop(false)
  }
  function cancelNewShop() {
    setNewShopName("")
    setAddingShop(false)
  }
  function submitRename() {
    if (renamingShopId && renameValue.trim()) renameShop(renamingShopId, renameValue.trim())
    setRenamingShopId(null)
  }
  function openNewItem(shopId: string) {
    setCreatingItemShopId(shopId)
    setCreatingItem({ id: nanoid(), name: "", category: "item" })
  }
  function openEditItem(shopId: string, item: Feature) {
    setCreatingItemShopId(shopId)
    setCreatingItem(item)
  }
  function closeItemEditor() {
    setCreatingItemShopId(null)
    setCreatingItem(null)
  }
  function saveItemEditor() {
    if (!creatingItemShopId || !creatingItem) return
    const isNew = !shops.find(s => s.id === creatingItemShopId)?.items.some(i => i.id === creatingItem.id)
    if (isNew) addItemsToShop(creatingItemShopId, [creatingItem])
    else updateShopItem(creatingItemShopId, creatingItem)
    closeItemEditor()
  }
  // Sections are just Shop.sections — no dedicated campaign-level mutator
  // needed since updateShopSettings already patches any Shop field.
  const SECTION_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"]
  function addSection(shopId: string) {
    const name = newSectionName.trim()
    if (!name) return
    const shop = shops.find(s => s.id === shopId)
    const sections = shop?.sections ?? []
    const color = SECTION_COLORS[sections.length % SECTION_COLORS.length]
    updateShopSettings(shopId, { sections: [...sections, { id: `section:${nanoid()}`, name, color }] })
    setNewSectionName("")
    setAddingSection(false)
  }
  function updateSection(shopId: string, sectionId: string, patch: Partial<ShopSection>) {
    const shop = shops.find(s => s.id === shopId)
    if (!shop) return
    updateShopSettings(shopId, { sections: (shop.sections ?? []).map(s => s.id === sectionId ? { ...s, ...patch } : s) })
  }
  function deleteSection(shopId: string, sectionId: string) {
    const shop = shops.find(s => s.id === shopId)
    if (!shop) return
    updateShopSettings(shopId, { sections: (shop.sections ?? []).filter(s => s.id !== sectionId) })
    // Items in the deleted section fall back to "Other" automatically
    // (groupItemsBySection treats any unmatched shopSectionId that way) —
    // no need to touch the items themselves.
  }
  function removeFromItemEditor() {
    if (!creatingItemShopId || !creatingItem) return
    removeItemFromShop(creatingItemShopId, creatingItem.id)
    closeItemEditor()
  }

  const visibleHistory = [...shopHistory].reverse().slice(0, historyExpanded ? undefined : 5)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">Shops</span>
      </div>

      {/* History (left, wider) + Party Wallets (right, skinny) side by side
          on a wide screen — stacked full-width on mobile instead, where a
          fixed 208px sidebar squeezed next to a flex-1 column left almost no
          room for either (a purchase row's name/timestamp were getting
          crushed down to a couple of characters). Wallets stay always
          visible — each character's own full coin breakdown, never summed
          into one "party total" — and dense/compact either way. */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">History</span>
            {shopHistory.length > 5 && (
              <button type="button" onClick={() => setHistoryExpanded(v => !v)}
                className="flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors">
                {historyExpanded ? <>Show recent only <ChevronUp className="size-3" /></> : <>Show older purchases <ChevronDown className="size-3" /></>}
              </button>
            )}
          </div>
          {shopHistory.length === 0 ? (
            <p className="text-[11px] text-foreground/30 italic py-1">No purchases yet.</p>
          ) : (
            <div className={`rounded-xl bg-muted ring-1 ring-border overflow-hidden overflow-y-auto ${historyExpanded ? "max-h-96" : "max-h-40"}`} style={rosterCardStyle}>
              {visibleHistory.map(r => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 px-3 py-1.5 text-[11px] border-b border-border/30 last:border-0">
                  <span className="flex-1 min-w-0 text-foreground/60 truncate">
                    <span className="font-semibold text-foreground/80">{r.characterName}</span> bought <span className="font-semibold">{r.itemLabel}</span> from {r.shopName} for {formatPrice(r.price * r.quantity, r.priceUnit ?? "gp", "classic")}
                  </span>
                  <span className="text-foreground/30 shrink-0">{new Date(r.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full sm:w-52 shrink-0 rounded-lg bg-muted ring-1 ring-border p-2 flex flex-col gap-1" style={rosterCardStyle}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-semibold">Party Wallets</span>
            <button type="button" onClick={() => setShowWalletSettings(true)} title="Wallet settings for everyone"
              className="size-4 flex items-center justify-center rounded text-foreground/30 hover:text-foreground/70 transition-colors">
              <Settings2 className="size-3" />
            </button>
          </div>
          {partyMembers.length === 0 ? (
            <p className="text-[11px] text-foreground/30 italic py-0.5">No party members yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {partyMembers.map(m => {
                const d = safeParseJson(m.data) as CharData
                return (
                  <div key={m.id} className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-foreground/70 truncate">{m.name}</span>
                    <WalletChips coins={d.currency ?? {}} mode={d.currencyMode ?? "classic"} names={d.currencyNames} dense />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pending purchase requests — only shops with requireConfirmation ever populate this */}
      {allPendingRequests.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-3 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-amber-300/80 font-semibold">Pending Purchases</span>
          {allPendingRequests.map(({ shop, request }) => (
            <div key={request.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1 min-w-0 text-foreground/80 truncate">
                <span className="font-semibold">{request.characterName}</span> wants <span className="font-semibold">{request.itemLabel}</span> from {shop.name} for {formatPrice(request.price * request.quantity, request.priceUnit ?? "gp", "classic")}
              </span>
              <button type="button" onClick={() => approveShopRequest(shop.id, request.id)}
                className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors">Approve</button>
              <button type="button" onClick={() => denyShopRequest(shop.id, request.id)}
                className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors">Deny</button>
            </div>
          ))}
        </div>
      )}

      {shops.length === 0 && !addingShop && (
        <p className="text-xs text-foreground/30 italic text-center py-6">No shops yet — add one below.</p>
      )}

      {/* Shop bubbles — click one to manage it below, instead of an
          ever-taller stack of accordion rows. A "+" bubble opens a small
          inline add-shop form instead of a permanent full-width input. */}
      <div className="flex flex-wrap gap-2 items-center">
        {shops.map(shop => {
          const isCurrent = currentShopId === shop.id
          const selected = selectedShopId === shop.id
          const color = shop.accentColor ?? defaultAccentColor
          return (
            <button key={shop.id} type="button" onClick={() => setSelectedShopId(selected ? null : shop.id)}
              onDoubleClick={() => { setRenamingShopId(shop.id); setRenameValue(shop.name) }}
              title="Click to manage, double-click to rename"
              className={`flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full ring-1 transition-colors ${selected ? "ring-foreground/40 bg-foreground/10" : "ring-border bg-muted hover:bg-foreground/10"}`}
              style={selected ? undefined : categoryAccentStyle(color, "galaxy")}>
              <span className="relative size-10 rounded-full overflow-hidden bg-foreground/10 flex items-center justify-center shrink-0"
                style={color ? { backgroundColor: `${color}55` } : undefined}>
                {shop.portraitUrl ? <img src={shop.portraitUrl} alt="" className="size-full object-cover" /> : <Store className="size-4.5 text-foreground/50" />}
              </span>
              {renamingShopId === shop.id ? (
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onBlur={submitRename} onKeyDown={e => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenamingShopId(null) }}
                  className="text-sm font-semibold bg-transparent outline-none border-b border-foreground/30 text-foreground w-24" />
              ) : (
                <span className="text-sm font-semibold text-foreground">{shop.name}</span>
              )}
              {isCurrent && (
                <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">Live</span>
              )}
            </button>
          )
        })}

        {addingShop ? (
          <div className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full ring-1 ring-foreground/30 bg-muted">
            <input autoFocus value={newShopName} onChange={e => setNewShopName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitNewShop(); if (e.key === "Escape") cancelNewShop() }}
              placeholder="Shop name…"
              className="text-sm bg-transparent outline-none text-foreground placeholder:text-foreground/30 w-28" />
            <button type="button" onClick={submitNewShop} disabled={!newShopName.trim()} title="Create"
              className="size-6 flex items-center justify-center rounded-full text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-30 transition-colors">
              <Check className="size-3.5" />
            </button>
            <button type="button" onClick={cancelNewShop} title="Cancel"
              className="size-6 flex items-center justify-center rounded-full text-foreground/40 hover:bg-foreground/10 transition-colors">✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingShop(true)} title="New shop"
            className="size-10 flex items-center justify-center rounded-full ring-1 ring-dashed ring-border text-foreground/40 hover:text-foreground/70 hover:ring-foreground/40 transition-colors">
            <Plus className="size-4" />
          </button>
        )}
      </div>

      {/* Selected shop's management panel */}
      {selectedShop && (
        <div className="rounded-xl bg-muted ring-1 ring-border p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{selectedShop.name}</span>
            <button type="button" onClick={() => setPlayerViewShopId(selectedShop.id)} title="See exactly what party members would see in this shop"
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground transition-colors shrink-0">
              <Eye className="size-3" /> Player View
            </button>
            <button type="button" onClick={() => setCurrentShop(currentShopId === selectedShop.id ? null : selectedShop.id)}
              title={currentShopId === selectedShop.id ? "Stop showing this shop to players" : "Show this shop to players"}
              className={`text-[10px] px-2 py-1 rounded-full shrink-0 transition-colors ${currentShopId === selectedShop.id ? "bg-foreground/15 text-foreground/70 hover:bg-foreground/20" : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"}`}>
              {currentShopId === selectedShop.id ? "Close Shop" : "Open Shop"}
            </button>
            <button type="button" onClick={() => setSettingsShopId(selectedShop.id)} title="Appearance & Display settings"
              className="size-6 flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-colors shrink-0">
              <Settings2 className="size-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => openNewItem(selectedShop.id)}
              className="text-[10px] px-2.5 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground transition-colors">+ Item</button>
            <button type="button" onClick={() => setBulkImportShopId(selectedShop.id)}
              className="text-[10px] px-2.5 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground transition-colors">Bulk Import</button>
            {selectedShop.items.length === 0 && (
              <button type="button" onClick={() => { deleteShop(selectedShop.id); setSelectedShopId(null) }}
                className="text-[10px] px-2 py-1 rounded-full text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto">Delete</button>
            )}
          </div>

          {/* Sections — purely organizational groups with their own color,
              so a shop full of potions/weapons/scrolls reads as distinct
              colored bands instead of one flat wall of bubbles. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(selectedShop.sections ?? []).map(section => (
              <div key={section.id} className="flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full bg-foreground/10">
                <ColorSwatchInput value={section.color ?? DEFAULT_ACCENT_COLOR} size="size-5" title="Section color"
                  onChange={color => updateSection(selectedShop.id, section.id, { color })} />
                <input value={section.name} onChange={e => updateSection(selectedShop.id, section.id, { name: e.target.value })}
                  className="text-[10px] bg-transparent outline-none border-b border-transparent focus:border-foreground/30 text-foreground/70 w-16" />
                <button type="button" onClick={() => deleteSection(selectedShop.id, section.id)} title="Delete section (items fall back to Other)"
                  className="text-foreground/30 hover:text-red-400 transition-colors">✕</button>
              </div>
            ))}
            {addingSection ? (
              <div className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-foreground/10">
                <input autoFocus value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addSection(selectedShop.id); if (e.key === "Escape") { setAddingSection(false); setNewSectionName("") } }}
                  placeholder="Section name…" className="text-[10px] bg-transparent outline-none text-foreground placeholder:text-foreground/30 w-20" />
                <button type="button" onClick={() => addSection(selectedShop.id)} disabled={!newSectionName.trim()}
                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30"><Check className="size-3" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingSection(true)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-foreground/40 hover:text-foreground/70 hover:bg-foreground/10 transition-colors">
                <Plus className="size-3" /> Section
              </button>
            )}
          </div>

          {selectedShop.items.length === 0 ? (
            <p className="text-[11px] text-foreground/30 italic py-2">No items yet.</p>
          ) : (
            <DndContext sensors={dragSensors} collisionDetection={shopItemCollision}
              onDragStart={e => setDraggingItemId(String(e.active.id))}
              onDragEnd={e => handleItemDragEnd(selectedShop, e)}
              onDragCancel={() => setDraggingItemId(null)}>
              <div className="flex flex-col gap-2">
                {groupItemsBySection(selectedShop).map(group => (
                  <div key={group.id} className="flex flex-col gap-1">
                    {group.name && (
                      <span className="text-[9px] uppercase tracking-widest font-semibold flex items-center gap-1.5"
                        style={{ color: group.color ?? "var(--color-foreground)", opacity: group.color ? 1 : 0.4 }}>
                        {group.color && <span className="size-1.5 rounded-full" style={{ backgroundColor: group.color }} />}
                        {group.name}
                      </span>
                    )}
                    {/* Drag onto this zone (its header, its empty space, or
                        any item card already inside it) to move an item
                        into this section — see handleItemDragEnd above. */}
                    <DropZone id={`shopSection:${group.id === "__other" ? "none" : group.id}`}>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                        {group.items.map(item => (
                          <ShopItemCard key={item.id} shop={selectedShop} item={item} defaultAccentColor={defaultAccentColor}
                            onEdit={() => openEditItem(selectedShop.id, item)}
                            onUpdate={patch => updateShopItem(selectedShop.id, { ...item, ...patch })} />
                        ))}
                      </div>
                    </DropZone>
                  </div>
                ))}
              </div>
              <DragOverlay>
                {(() => {
                  const activeItem = draggingItemId ? selectedShop.items.find(i => i.id === draggingItemId) : undefined
                  return activeItem ? (
                    <DragOverlayCard>
                      <div className="w-32">
                        <ShopItemCardBody shop={selectedShop} item={activeItem} defaultAccentColor={defaultAccentColor} onEdit={() => {}} onUpdate={() => {}} />
                      </div>
                    </DragOverlayCard>
                  ) : null
                })()}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      {/* Item editor modal — the exact same FeatureEntry flow InventoryTab
          uses for its own items, plus showShopFields for the hidden/reveal
          toggle, price denomination, and per-item display overrides. */}
      {creatingItem && creatingItemShopId && (() => {
        const isNew = !shops.find(s => s.id === creatingItemShopId)?.items.some(i => i.id === creatingItem.id)
        return (
          <Modal onClose={closeItemEditor}>
            <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(560px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                <p className="text-sm font-bold text-white">{isNew ? "New Item" : "Edit Item"}</p>
                <button type="button" onClick={closeItemEditor}
                  className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
              </div>
              <div className="p-4 overflow-y-auto">
                <FeatureEntry
                  feature={creatingItem}
                  onChange={patch => setCreatingItem(f => f ? { ...f, ...patch } : f)}
                  onRemove={removeFromItemEditor}
                  onLinkToggle={() => {}}
                  allFeatures={[]}
                  theme={THEMES[DEFAULT_THEME]}
                  pb={2} statMods={{}}
                  showItemExtras showAttunement showShopFields
                  suggestionSource="item" userId={userId}
                  autoEdit onAutoEditConsumed={() => {}}
                />
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/10 shrink-0">
                <button type="button" onClick={closeItemEditor}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white">Cancel</button>
                <button type="button" disabled={!creatingItem.name.trim()} onClick={saveItemEditor}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/80 hover:bg-violet-500 text-white disabled:opacity-40">
                  {isNew ? "Add" : "Save Changes"}
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {settingsShopId && (() => {
        const shop = shops.find(s => s.id === settingsShopId)
        return shop ? (
          <ShopSettingsModal
            shop={shop}
            userId={userId}
            onChange={patch => updateShopSettings(settingsShopId, patch)}
            onClose={() => setSettingsShopId(null)}
          />
        ) : null
      })()}

      {bulkImportShopId && (
        <BulkImportModal
          userId={userId}
          onImport={items => addItemsToShop(bulkImportShopId, items)}
          onClose={() => setBulkImportShopId(null)}
        />
      )}

      {showWalletSettings && (
        <WalletSettingsModal onApplyToAll={applyWalletSettingsToAll} onClose={() => setShowWalletSettings(false)} />
      )}

      {playerViewShop && (
        <ShopPlayerPreview shop={playerViewShop} isLive={playerViewShop.id === currentShopId} partyMembers={partyMembers}
          defaultAccentColor={defaultAccentColor} onClose={() => setPlayerViewShopId(null)} />
      )}
    </div>
  )
}

// The actual card content — pure presentation, no drag behavior — shared by
// the real (draggable) grid card below and the floating DragOverlay clone,
// so the clone is pixel-identical to the row it was picked up from.
function ShopItemCardBody({ shop, item, defaultAccentColor, onEdit, onUpdate }: {
  shop: Shop
  item: Feature
  defaultAccentColor?: string
  onEdit: () => void
  onUpdate: (patch: Partial<Feature>) => void
}) {
  const color = resolveItemColor(shop, item, defaultAccentColor)
  return (
    <div className="rounded-md ring-1 ring-border bg-foreground/5 p-1.5 flex flex-col gap-1 text-[10px]" style={shopCardStyle(color)}>
      <div className="flex items-center gap-1">
        <span className="flex-1 min-w-0 font-semibold text-foreground/80 truncate text-[11px]">{item.name || "Unnamed"}</span>
        <button type="button" onClick={onEdit} title="Open full editor"
          className="shrink-0 text-foreground/30 hover:text-foreground/70 transition-colors">
          <Pencil className="size-3" />
        </button>
      </div>
      {(shop.sections ?? []).length > 0 && (
        <select value={item.shopSectionId ?? ""} onChange={e => onUpdate({ shopSectionId: e.target.value || undefined })}
          className="bg-zinc-800 rounded px-1 py-0.5 outline-none text-white text-[9px]">
          <option value="" className="bg-zinc-800 text-white">No section</option>
          {(shop.sections ?? []).map(s => <option key={s.id} value={s.id} className="bg-zinc-800 text-white">{s.name}</option>)}
        </select>
      )}
      {item.shopHidden ? (
        <div className="flex items-center gap-0.5">
          <input value={item.shopDisplayName ?? ""} placeholder="Shown as…"
            onChange={e => onUpdate({ shopDisplayName: e.target.value })}
            className="flex-1 min-w-0 text-[9px] bg-foreground/10 rounded px-1 py-0.5 outline-none text-foreground/70 placeholder:text-foreground/30" />
          <button type="button" onClick={() => onUpdate({ shopHidden: false })}
            title="Un-hide — players will see the real name" className="shrink-0 text-[9px] text-amber-400 hover:text-amber-300 whitespace-nowrap">
            Un-hide
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => onUpdate({ shopHidden: true })}
          className="text-[9px] text-foreground/40 hover:text-foreground/70 transition-colors self-start">
          Show as…
        </button>
      )}
      <div className="flex items-center gap-0.5 flex-wrap text-foreground/40">
        <input type="number" min={0} step="0.01" value={item.value ?? ""}
          onChange={e => onUpdate({ value: e.target.value ? parseFloat(e.target.value) || 0 : undefined })}
          placeholder="0" className="w-9 bg-foreground/10 rounded px-1 py-0.5 text-center outline-none text-foreground" />
        <select value={item.priceUnit ?? "gp"}
          onChange={e => onUpdate({ priceUnit: e.target.value as Feature["priceUnit"] })}
          className="w-11 shrink-0 bg-zinc-800 rounded px-0.5 py-0.5 outline-none text-white">
          {(["cp", "sp", "ep", "gp", "pp"] as const).map(u => <option key={u} value={u} className="bg-zinc-800 text-white">{u}</option>)}
        </select>
        <label className="flex items-center gap-1 shrink-0" title="Current stock">
          Qty
          <input type="number" min={0} value={item.amount ?? ""} placeholder="∞"
            onChange={e => onUpdate({ amount: e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : undefined, trackAmount: e.target.value !== "" })}
            className="w-9 bg-foreground/10 rounded px-1 py-0.5 text-center outline-none text-foreground" />
        </label>
        <label className="flex items-center gap-1 shrink-0" title="Original stock count — shows as current/max instead of just current">
          /
          <input type="number" min={0} value={item.shopMaxAmount ?? ""} placeholder="∞"
            onChange={e => onUpdate({ shopMaxAmount: e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : undefined })}
            className="w-9 bg-foreground/10 rounded px-1 py-0.5 text-center outline-none text-foreground" />
        </label>
        {item.shopMaxAmount != null && (
          <button type="button" onClick={() => onUpdate({ amount: item.shopMaxAmount, trackAmount: true })}
            title="Restock to max" className="text-foreground/30 hover:text-emerald-400 transition-colors">
            Restock
          </button>
        )}
      </div>
    </div>
  )
}

// Wraps the card body in a drag source — grabbing anywhere on the card
// except its own inputs/selects (useDragSensors' RowPointerSensor excludes
// text-edit targets) picks it up; dropping it on a section's DropZone or
// another item's card re-tags its shopSectionId (see handleItemDragEnd).
function ShopItemCard(props: { shop: Shop; item: Feature; defaultAccentColor?: string; onEdit: () => void; onUpdate: (patch: Partial<Feature>) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.item.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{ opacity: isDragging ? 0.35 : 1, touchAction: "pan-y" }}
      className="cursor-grab active:cursor-grabbing select-none">
      <ShopItemCardBody {...props} />
    </div>
  )
}

// Shopkeeper portrait + bubble accent color + the Display section (what
// players see by default) — same upload flow MarkdownTextarea.tsx's image
// button uses (loadUserImages/uploadUserImage + a hidden file input), just
// landing in Shop.portraitUrl instead of markdown. No none/outline/galaxy
// picker here — a shop's color always renders via categoryAccentStyle's
// "galaxy"/Background formula (see ShopItemCardBody, ShopFront.tsx), the
// same solid-fill look every other "card style" in the app uses; "outline"
// never did anything worth exposing as its own option here.
function ShopSettingsModal({ shop, userId, onChange, onClose }: {
  shop: Shop
  userId?: string | null
  onChange: (patch: Partial<Shop>) => void
  onClose: () => void
}) {
  // One shared picker for both images (portrait, background) — which field a
  // chosen/uploaded image lands in depends on which button opened it.
  const [picker, setPicker] = useState<"portrait" | "background" | null>(null)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function openPicker(target: "portrait" | "background") {
    setPicker(target)
    if (!userId) return
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(userId))
    setGalleryLoading(false)
  }
  async function handleFile(file: File) {
    if (!userId || !picker) return
    const url = await uploadUserImage(userId, file)
    if (url) onChange(picker === "portrait" ? { portraitUrl: url } : { backgroundImageUrl: url })
    setPicker(null)
  }

  return (
    <Modal onClose={onClose}>
      {/* Deliberately plain — tinting/texturing this dialog with the shop's
          own material looked cluttered against the form controls inside it.
          The texture swatches below already preview each material directly. */}
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(420px,92vw)] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <p className="text-sm font-bold text-white">{shop.name} — Settings</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
        </div>
        <div className="p-5 flex flex-col gap-5 overflow-y-auto">
          <div className="flex items-center gap-3">
            {shop.portraitUrl ? (
              <img src={shop.portraitUrl} alt="" className="size-14 rounded-full object-cover border border-white/15" />
            ) : (
              <div className="size-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
                <ImageIcon className="size-5" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => openPicker("portrait")}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors self-start">
                {shop.portraitUrl ? "Change Portrait" : "Set Shopkeeper Portrait"}
              </button>
              {shop.portraitUrl && (
                <button type="button" onClick={() => onChange({ portraitUrl: undefined })}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors self-start">Remove</button>
              )}
            </div>
            <label className="flex flex-col items-center gap-0.5 cursor-pointer ml-auto">
              <ColorSwatchInput value={shop.accentColor ?? DEFAULT_ACCENT_COLOR} title="Bubble color" onChange={color => onChange({ accentColor: color })} />
              <span className="text-[8px] text-white/30">Bubble Color</span>
            </label>
          </div>
          <p className="text-[10px] text-white/30 -mt-3">Tints this shop's own bubble, and every item in it that isn't in a colored Section (set from the shop's own panel).</p>

          <div className="flex items-center gap-3">
            {shop.backgroundImageUrl ? (
              <img src={shop.backgroundImageUrl} alt="" className="size-14 rounded-lg object-cover border border-white/15" />
            ) : (
              <div className="size-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
                <ImageIcon className="size-5" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-white/70">Shop Background</span>
              <button type="button" onClick={() => openPicker("background")}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors self-start">
                {shop.backgroundImageUrl ? "Change Background" : "Set Background Image"}
              </button>
              {shop.backgroundImageUrl && (
                <button type="button" onClick={() => onChange({ backgroundImageUrl: undefined })}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors self-start">Remove</button>
              )}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer select-none px-1 py-1.5 rounded-lg bg-white/5">
            <div>
              <p className="text-xs font-semibold text-white/70">Require DM confirmation</p>
              <p className="text-[10px] text-white/30 mt-0.5">A buy only requests the purchase — nothing changes until you approve it from the Shops tab.</p>
            </div>
            <input type="checkbox" checked={!!shop.requireConfirmation}
              onChange={e => onChange({ requireConfirmation: e.target.checked })}
              className="size-4 accent-violet-500 cursor-pointer shrink-0" />
          </label>

          <div className="flex flex-col gap-2 px-1 py-1.5 rounded-lg bg-white/5">
            <span className="text-sm text-white/70">Display</span>
            <p className="text-[10px] text-white/30">What players see by default in this shop — any item can override these individually from its own editor.</p>
            {([
              ["showPrices", "Show Prices"],
              ["showStock", "Show Stock"],
              ["showDescriptions", "Show Descriptions"],
            ] as const).map(([field, fieldLabel]) => (
              <label key={field} className="flex items-center justify-between gap-3 cursor-pointer select-none">
                <span className="text-xs text-white/60">{fieldLabel}</span>
                <input type="checkbox" checked={shop.display?.[field] ?? true}
                  onChange={e => onChange({ display: { ...shop.display, [field]: e.target.checked } })}
                  className="size-4 accent-violet-500 cursor-pointer" />
              </label>
            ))}
          </div>
        </div>
      </div>

      {picker && (
        <PortraitModal
          title={picker === "portrait" ? "Shopkeeper Portrait" : "Shop Background"}
          currentPortrait={picker === "portrait" ? shop.portraitUrl : shop.backgroundImageUrl}
          galleryImages={galleryImages}
          galleryLoading={galleryLoading}
          onChoose={url => { onChange(picker === "portrait" ? { portraitUrl: url } : { backgroundImageUrl: url }); setPicker(null) }}
          onUploadClick={() => fileInputRef.current?.click()}
          onClose={() => setPicker(null)}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </Modal>
  )
}

// Pulls a denomination (cp/sp/ep/gp/pp, case-insensitive) out of a pasted
// price like "10 gp" or "3sp" — defaults to gp when none is written, same as
// every price before priceUnit existed.
const COIN_UNIT_RE = /\b(cp|sp|ep|gp|pp)\b/i
function parsePriceAndUnit(raw?: string): { price?: number; unit: CoinKey } {
  if (!raw) return { unit: "gp" }
  const unit = (raw.match(COIN_UNIT_RE)?.[1].toLowerCase() as CoinKey | undefined) ?? "gp"
  const price = parseFloat(raw.replace(/[^0-9.]/g, "")) || undefined
  return { price, unit }
}

// Paste "Name: Price: Quantity" lines → Feature[]. A name that exactly
// matches a Documentation "item" entry auto-fills its full stats/description
// via the same getSuggestions/itemPatchFromSuggestion path the item-editor's
// own suggestion picker uses — this is a direct lookup instead of the
// interactive picker, so an exact (case-insensitive) name match is required.
function BulkImportModal({ userId, onImport, onClose }: {
  userId?: string | null
  onImport: (items: Feature[]) => void
  onClose: () => void
}) {
  const [text, setText] = useState("")
  const [importing, setImporting] = useState(false)

  async function submit() {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) { onClose(); return }
    setImporting(true)
    try {
      const suggestions = await getSuggestions("item", userId)
      const byName = new Map(suggestions.map(s => [s.name.toLowerCase(), s]))
      const items: Feature[] = lines.map(line => {
        const [rawName, rawPrice, rawQty] = line.split(":").map(p => p.trim())
        const name = rawName ?? line
        const { price, unit } = parsePriceAndUnit(rawPrice)
        const qty = rawQty ? parseInt(rawQty.replace(/[^0-9]/g, ""), 10) || undefined : undefined
        const blank: Feature = { id: nanoid(), name, category: "item", value: price, priceUnit: unit, amount: qty, trackAmount: !!qty }
        const match = byName.get(name.toLowerCase())
        if (!match) return blank
        const patch = itemPatchFromSuggestion("item", match, blank)
        // Price/quantity/unit from the pasted line always win over the
        // reference item's own listed cost — a shop's price is deliberately
        // independent of an item's "real" value (that's the whole point of a
        // shop).
        return { ...blank, description: match.description, ...patch, value: price ?? patch.value, priceUnit: unit, amount: qty, trackAmount: !!qty }
      })
      onImport(items)
      onClose()
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(480px,92vw)] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <p className="text-sm font-bold text-white">Bulk Import Items</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
        </div>
        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          <p className="text-xs text-white/40">
            One item per line: <span className="font-mono text-white/60">Name: Price: Quantity</span>. Include a denomination in the price (cp/sp/ep/gp/pp) — plain numbers default to gp.
            A name that exactly matches an item in Documentation imports its full stats/description automatically.
          </p>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={10}
            placeholder={"Big Belt: 50 gp: 3\nPotion of Healing: 10 gp: 2\nTorch: 1 sp: 5"}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-white/30 placeholder:text-white/20 resize-none" />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/10 shrink-0">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white">Cancel</button>
          <button type="button" disabled={!text.trim() || importing} onClick={submit}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/80 hover:bg-violet-500 text-white disabled:opacity-40">
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Bulk-apply control for wallet mode/names — sets currencyMode/currencyNames
// on every current party member at once, same fields CurrencyTracker.tsx's
// own per-character Wallet Settings modal writes, just fanned out DM-side.
// Balances themselves now show inline, always, in ShopsTab's own Party
// Wallets panel — this modal is just the (rarely used) bulk-apply action.
function WalletSettingsModal({ onApplyToAll, onClose }: {
  onApplyToAll: (mode: CurrencyMode, names: string[]) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<CurrencyMode>("classic")
  const [names, setNames] = useState<string[]>([...DEFAULT_NAMES])

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(380px,92vw)] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <p className="text-sm font-bold text-white">Wallet Settings</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
        </div>
        <div className="p-5 flex flex-col gap-2 overflow-y-auto">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Set Wallet System For Everyone</span>
          <div className="flex gap-2">
            {(["classic", "simple", "custom"] as CurrencyMode[]).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${mode === m ? "bg-amber-500/20 border border-amber-500/40 text-amber-300" : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10"}`}>
                {m}
              </button>
            ))}
          </div>
          {mode === "custom" && (
            <div className="flex flex-col gap-1.5 mt-1">
              {names.map((n, i) => (
                <input key={i} value={n} onChange={e => setNames(prev => prev.map((x, xi) => xi === i ? e.target.value : x))}
                  className="bg-white/8 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-amber-500/40" />
              ))}
            </div>
          )}
          <button type="button" onClick={() => onApplyToAll(mode, names)}
            className="text-xs px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold transition-colors mt-1">
            Apply to All Players
          </button>
          <p className="text-[10px] text-white/30">Overwrites every current party member's own wallet setting — they won't need to change it themselves.</p>
        </div>
      </div>
    </Modal>
  )
}
